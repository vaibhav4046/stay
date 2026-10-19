// Can the app end a turn sooner than AssemblyAI's own end-of-turn detection? The documented ForceEndpoint message ends the
// current turn immediately. This probe streams the same real-time speech, sends ForceEndpoint a chosen time after the speech
// really ends, and times the final transcript (true end of speech -> final Turn with end_of_turn).
// Usage: node scripts/voice-e2e/force-endpoint-probe.mjs <dir with en.pcm 16 kHz> [forceAfterMs=250] [runs=5]
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const AAI = process.env.ASSEMBLYAI_API_KEY;
const pcm = fs.readFileSync(path.join(process.argv[2], 'en.pcm'));
const FORCE_AFTER = Number(process.argv[3] ?? 250);
const RUNS = Number(process.argv[4] ?? 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// pace chunks against the clock, not with a fixed sleep: a fixed sleep drifts and made every earlier timing look slower
const sleepUntil = (t) => sleep(Math.max(0, t - Date.now()));
let lastLoud = 0;
for (let i = 0; i + 1 < pcm.length; i += 2) if (Math.abs(pcm.readInt16LE(i)) > 600) lastLoud = i;
const speechEndMs = Math.round(lastLoud / 32);

async function run(force) {
  const { token } = await (await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=120', { headers: { Authorization: AAI } })).json();
  const q = new URLSearchParams({ sample_rate: '16000', encoding: 'pcm_s16le', speech_model: 'universal-3-6-pro', token });
  return new Promise((resolve) => {
    const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${q}`);
    let t0 = 0, done = false, forced = false, lastPartial = '';
    const fin = (v) => { if (done) return; done = true; try { ws.send(JSON.stringify({ type: 'Terminate' })); } catch {} setTimeout(() => { try { ws.close(); } catch {} resolve(v); }, 100); };
    const hard = setTimeout(() => fin({ error: 'timeout' }), 20000);
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'Begin') {
        t0 = Date.now();
        const CH = 1600; // 50 ms, what the app sends
        let k = 0;
        for (let i = 0; i < pcm.length && !done; i += CH) {
          ws.send(pcm.subarray(i, i + CH));
          await sleepUntil(t0 + ++k * 50);
          const streamed = Math.round(Math.min(i + CH, pcm.length) / 32);
          // only force when the partial already reads like a finished sentence (what the app would require)
          if (force && !forced && streamed >= speechEndMs + FORCE_AFTER && /[.?!]$/.test(lastPartial.trim())) { forced = true; ws.send(JSON.stringify({ type: 'ForceEndpoint' })); }
        }
        const sil = Buffer.alloc(CH);
        for (let i = 0; i < 100 && !done; i++) {
          ws.send(sil); await sleepUntil(t0 + ++k * 50);
          const streamed = Math.round(pcm.length / 32) + (i + 1) * 50;
          if (force && !forced && streamed >= speechEndMs + FORCE_AFTER && /[.?!]$/.test(lastPartial.trim())) { forced = true; ws.send(JSON.stringify({ type: 'ForceEndpoint' })); }
        }
      }
      if (m.type === 'Turn') {
        if (m.transcript) lastPartial = m.transcript;
        const rel = Date.now() - t0;
        if (m.end_of_turn && rel > speechEndMs - 300) { clearTimeout(hard); fin({ ms: rel - speechEndMs, forced, text: m.transcript }); }
      }
    };
    ws.onerror = () => fin({ error: 'ws error' });
  });
}

for (const force of [false, true]) {
  const ms = [];
  for (let i = 0; i < RUNS; i++) { const r = await run(force); if (r.ms != null) ms.push(r.ms); else console.log('  run failed:', r.error); await sleep(400); }
  ms.sort((a, b) => a - b);
  console.log(`${force ? `ForceEndpoint ${FORCE_AFTER} ms after speech ends, only if the partial ends . ? !` : 'AssemblyAI default end of turn'}: n=${ms.length} p50=${ms[Math.floor(ms.length / 2)]} ms  [${ms.join(', ')}]`);
}
process.exit(0);
