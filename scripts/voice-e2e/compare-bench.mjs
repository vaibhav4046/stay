// Side-by-side: time from the end of real speech to the first reply audio, same spoken sentence, same real-time streaming.
//   stay   = AssemblyAI Voice Agent (what Stay uses today). Runs with ASSEMBLYAI_API_KEY.
//   openai = OpenAI Realtime API.   Runs only with OPENAI_API_KEY (model: OPENAI_REALTIME_MODEL, default gpt-realtime).
//   gemini = Gemini Live API.       Runs only with GEMINI_API_KEY (model: GEMINI_LIVE_MODEL).
// Providers without a key are skipped and reported as NOT MEASURED. Nothing here is a claim until it has run.
// NOTE: the openai and gemini legs follow each vendor's documented event names but have not been run by the author
// (no keys were available); treat their first real run as a test of this script too.
// Usage: node scripts/voice-e2e/compare-bench.mjs <dir with en.pcm (16 kHz s16le mono)> [runs]
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const RUNS = Number(process.argv[3] || 5);
const pcm16 = fs.readFileSync(path.join(process.argv[2], 'en.pcm'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sleepUntil = (t) => sleep(Math.max(0, t - Date.now())); // pace against the clock: a fixed sleep drifts and inflates every latency
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

// where real speech ends in the file (32 bytes per ms at 16 kHz)
let lastLoud = 0;
for (let i = 0; i + 1 < pcm16.length; i += 2) if (Math.abs(pcm16.readInt16LE(i)) > 600) lastLoud = i;
const speechEndMs = Math.round(lastLoud / 32);

function resampleTo24k(buf) {
  const inN = buf.length / 2, outN = Math.floor((inN * 24000) / 16000), out = Buffer.alloc(outN * 2);
  for (let i = 0; i < outN; i++) {
    const pos = (i * 16000) / 24000, i0 = Math.floor(pos), f = pos - i0;
    const a = buf.readInt16LE(Math.min(i0, inN - 1) * 2), b = buf.readInt16LE(Math.min(i0 + 1, inN - 1) * 2);
    out.writeInt16LE(Math.round(a + (b - a) * f), i * 2);
  }
  return out;
}

/** Streams audio in real time (100 ms chunks) then silence; resolves with ms from end of speech to first reply audio. */
async function streamAndTime({ send, bytesPerMs, audio, isFirstAudio, setHandler, ready }) {
  await ready;
  return new Promise(async (resolve) => {
    let t0 = 0, done = false;
    const hard = setTimeout(() => { if (!done) { done = true; resolve({ error: 'timeout' }); } }, 30000);
    setHandler((ev) => {
      if (!done && t0 && isFirstAudio(ev)) { done = true; clearTimeout(hard); resolve({ ms: Date.now() - t0 - speechEndMs }); }
    });
    const chunk = Math.round(bytesPerMs * 100);
    t0 = Date.now();
    let k = 0;
    for (let i = 0; i < audio.length && !done; i += chunk) { send(audio.subarray(i, i + chunk)); await sleepUntil(t0 + ++k * 100); }
    const sil = Buffer.alloc(chunk);
    for (let i = 0; i < 100 && !done; i++) { send(sil); await sleepUntil(t0 + ++k * 100); }
  });
}

async function runStay() {
  const key = process.env.ASSEMBLYAI_API_KEY;
  const tok = (await (await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=120&max_session_duration_seconds=300', { headers: { Authorization: `Bearer ${key}` } })).json()).token;
  const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(tok)}`);
  let handler = () => {}, resolveReady; const ready = new Promise((r) => (resolveReady = r));
  ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You are Stay, a calm friend who helps an adult with ADHD start tasks. Reply in one or two short sentences, at most 15 words.', greeting: 'Hi.', input: { voice_focus: 'near-field' }, output: { voice: 'anna' } } }));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'session.ready') setTimeout(resolveReady, 4500); handler(m); }; // let the greeting finish
  const r = await streamAndTime({ send: (b) => ws.send(JSON.stringify({ type: 'input.audio', audio: b.toString('base64') })), bytesPerMs: 32, audio: pcm16, isFirstAudio: (m) => m.type === 'reply.audio', setHandler: (h) => (handler = h), ready });
  try { ws.send(JSON.stringify({ type: 'session.end' })); ws.close(); } catch {}
  return r;
}

async function runOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, ['realtime', `openai-insecure-api-key.${key}`]);
  let handler = () => {}, resolveReady; const ready = new Promise((r) => (resolveReady = r));
  ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { type: 'realtime', instructions: 'You are a calm friend who helps an adult with ADHD start tasks. Reply in one or two short sentences, at most 15 words.', output_modalities: ['audio'], audio: { input: { format: { type: 'audio/pcm', rate: 24000 }, turn_detection: { type: 'semantic_vad' } }, output: { format: { type: 'audio/pcm', rate: 24000 } } } } }));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === 'session.updated') resolveReady(); handler(m); };
  ws.onerror = () => resolveReady();
  const r = await streamAndTime({ send: (b) => ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: b.toString('base64') })), bytesPerMs: 48, audio: resampleTo24k(pcm16), isFirstAudio: (m) => m.type === 'response.output_audio.delta' || m.type === 'response.audio.delta', setHandler: (h) => (handler = h), ready });
  try { ws.close(); } catch {}
  return r;
}

async function runGemini() {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.5-flash-native-audio-preview-09-2025';
  const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`);
  let handler = () => {}, resolveReady; const ready = new Promise((r) => (resolveReady = r));
  ws.onopen = () => ws.send(JSON.stringify({ setup: { model, generationConfig: { responseModalities: ['AUDIO'] }, systemInstruction: { parts: [{ text: 'You are a calm friend who helps an adult with ADHD start tasks. Reply in one or two short sentences, at most 15 words.' }] } } }));
  ws.onmessage = async (e) => {
    const text = typeof e.data === 'string' ? e.data : e.data instanceof Blob ? await e.data.text() : Buffer.from(e.data).toString();
    let m; try { m = JSON.parse(text); } catch { return; }
    if (m.setupComplete) resolveReady();
    handler(m);
  };
  ws.onerror = () => resolveReady();
  const r = await streamAndTime({ send: (b) => ws.send(JSON.stringify({ realtimeInput: { audio: { data: b.toString('base64'), mimeType: 'audio/pcm;rate=16000' } } })), bytesPerMs: 32, audio: pcm16, isFirstAudio: (m) => Boolean(m.serverContent?.modelTurn?.parts?.some((p) => p.inlineData?.data)), setHandler: (h) => (handler = h), ready });
  try { ws.close(); } catch {}
  return r;
}

const LEGS = [
  ['stay (AssemblyAI Voice Agent)', 'ASSEMBLYAI_API_KEY', runStay],
  ['openai realtime', 'OPENAI_API_KEY', runOpenAI],
  ['gemini live', 'GEMINI_API_KEY', runGemini],
];
console.log(`sentence ends at ${speechEndMs} ms; ${RUNS} runs per provider; real-time streaming; each provider's own end-of-turn detection\n`);
for (const [name, envKey, fn] of LEGS) {
  if (!process.env[envKey]) { console.log(`${name.padEnd(30)} NOT MEASURED (no ${envKey})`); continue; }
  const ms = [], errors = [];
  for (let i = 0; i < RUNS; i++) {
    try { const r = await fn(); if (r.ms != null) ms.push(r.ms); else errors.push(r.error); } catch (e) { errors.push(String(e).slice(0, 60)); }
    await sleep(2500);
  }
  console.log(`${name.padEnd(30)} ${ms.length ? `n=${ms.length} p50=${pct(ms, 0.5)} ms  p90=${pct(ms, 0.9)} ms  min=${Math.min(...ms)}  max=${Math.max(...ms)}` : 'no successful runs'}${errors.length ? `  (failed runs: ${errors.length}, ${errors[0]})` : ''}`);
}
process.exit(0);
