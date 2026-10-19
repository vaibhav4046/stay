// Measures the two legs of an own-built voice cascade that are documented, plus a probe of the undocumented TTS endpoint:
//   1. AssemblyAI streaming STT: time from the end of real speech to the end-of-turn event.
//   2. LLM first token (streaming) on the shared Groq key: gpt-oss-20b and gpt-oss-120b.
//   3. Is wss://streaming-tts.assemblyai.com/v1/ws reachable with this key, and what does it say.
// Usage: node scripts/voice-e2e/cascade-bench.mjs <dir with en.pcm> [runs]
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const AAI = process.env.ASSEMBLYAI_API_KEY;
const GROQ = process.env.GROQ_API_KEY;
const RUNS = Number(process.argv[3] || 6);
const pcm = fs.readFileSync(path.join(process.argv[2], 'en.pcm'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sleepUntil = (t) => sleep(Math.max(0, t - Date.now())); // pace against the clock: a fixed sleep drifts and inflates every latency
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const summary = (a) => (a.length ? `n=${a.length} p50=${pct(a, 0.5)}ms p90=${pct(a, 0.9)}ms min=${Math.min(...a)} max=${Math.max(...a)}` : 'no samples');

// where real speech ends inside the file (16 kHz, 16-bit mono = 32 bytes per ms)
let lastLoud = 0;
for (let i = 0; i + 1 < pcm.length; i += 2) if (Math.abs(pcm.readInt16LE(i)) > 600) lastLoud = i;
const speechEndMs = Math.round(lastLoud / 32);
console.log(`audio ${(pcm.length / 32000).toFixed(2)}s, last speech at ${speechEndMs}ms`);

async function sttRun() {
  const tr = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=120', { headers: { Authorization: AAI } });
  const { token } = await tr.json();
  const params = new URLSearchParams({ sample_rate: '16000', encoding: 'pcm_s16le', speech_model: 'universal-3-6-pro', token });
  for (const [k, v] of new URLSearchParams(process.env.STT_EXTRA || '')) params.set(k, v);
  return new Promise((resolve) => {
    const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${params}`);
    let t0 = 0, done = false, firstPartial = 0, text = '';
    const fin = (v) => { if (done) return; done = true; try { ws.send(JSON.stringify({ type: 'Terminate' })); } catch {} setTimeout(() => { try { ws.close(); } catch {} resolve(v); }, 100); };
    const hard = setTimeout(() => fin({ error: 'timeout', text }), 25000);
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'Begin') {
        t0 = Date.now();
        const CH = 3200; // 100 ms
        let k = 0;
        for (let i = 0; i < pcm.length && !done; i += CH) { ws.send(pcm.subarray(i, i + CH)); await sleepUntil(t0 + ++k * 100); }
        const sil = Buffer.alloc(CH);
        for (let i = 0; i < 80 && !done; i++) { ws.send(sil); await sleepUntil(t0 + ++k * 100); }
      }
      if (m.type === 'Turn') {
        text = m.transcript || text;
        const rel = Date.now() - t0;
        if (!firstPartial && m.transcript) firstPartial = rel;
        if (m.end_of_turn && rel > speechEndMs - 300) { clearTimeout(hard); fin({ endOfTurnAfterSpeechMs: rel - speechEndMs, firstPartialMs: firstPartial, text: m.transcript }); }
      }
    };
    ws.onerror = () => fin({ error: 'ws error', text });
  });
}

async function llmRun(model) {
  const t0 = Date.now();
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, stream: true, temperature: 0.4, max_tokens: 200, reasoning_effort: 'low', include_reasoning: false,
      messages: [
        { role: 'system', content: 'You are Stay, a calm friend who helps an adult with ADHD start tasks. Speak one or two short sentences, at most 15 words.' },
        { role: 'user', content: 'I keep putting off replying to my landlord about the renewal.' },
      ],
    }),
  });
  if (!res.ok) return { error: `http ${res.status}` };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let first = 0, buf = '', words = 0, total = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    for (const line of buf.split('\n').slice(0, -1)) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try { const d = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content; if (d) { if (!first) first = Date.now() - t0; total += d; } } catch {}
    }
    buf = buf.slice(buf.lastIndexOf('\n') + 1);
  }
  words = total.trim().split(/\s+/).length;
  return first ? { firstTokenMs: first, totalMs: Date.now() - t0, words } : { error: 'no content' };
}

async function ttsProbe() {
  const out = [];
  for (const url of ['wss://streaming-tts.assemblyai.com/v1/ws', `wss://streaming-tts.assemblyai.com/v1/ws?token=${encodeURIComponent(AAI)}`]) {
    out.push(await new Promise((resolve) => {
      let ws; const log = [];
      try { ws = new WebSocket(url.replace(AAI, '<key>') === url ? url : url); } catch (e) { return resolve({ url: url.replace(AAI, '<key>'), error: String(e) }); }
      const t = setTimeout(() => { try { ws.close(); } catch {} resolve({ url: url.replace(AAI, '<key>'), log, note: 'timeout' }); }, 6000);
      ws.onopen = () => { log.push('open'); ws.send(JSON.stringify({ text: 'Hello there.' })); };
      ws.onmessage = (e) => { log.push(String(e.data).slice(0, 160)); };
      ws.onerror = () => log.push('error');
      ws.onclose = (e) => { clearTimeout(t); log.push(`close ${e.code} ${e.reason || ''}`); resolve({ url: url.replace(AAI, '<key>'), log }); };
    }));
  }
  return out;
}

const stt = [], first20 = [], first120 = [];
for (let i = 0; i < RUNS; i++) {
  const r = await sttRun();
  if (r.endOfTurnAfterSpeechMs != null) stt.push(r.endOfTurnAfterSpeechMs);
  console.log(`stt run ${i + 1}:`, JSON.stringify(r));
  await sleep(500);
}
for (let i = 0; i < (process.env.SKIP_LLM ? 0 : RUNS); i++) {
  const a = await llmRun('openai/gpt-oss-20b'); if (a.firstTokenMs) first20.push(a.firstTokenMs);
  const b = await llmRun('openai/gpt-oss-120b'); if (b.firstTokenMs) first120.push(b.firstTokenMs);
  console.log(`llm run ${i + 1}: 20b=${JSON.stringify(a)} 120b=${JSON.stringify(b)}`);
  await sleep(1500); // stay under the free tier's tokens-per-minute limit
}
console.log('\nSTT end-of-speech -> end_of_turn:', summary(stt));
console.log('LLM first token gpt-oss-20b :', summary(first20));
console.log('LLM first token gpt-oss-120b:', summary(first120));
console.log('\nTTS endpoint probe:', JSON.stringify(await ttsProbe(), null, 1));
process.exit(0);
