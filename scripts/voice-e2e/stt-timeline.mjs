// When does AssemblyAI's streaming STT tell us what was said, relative to the true end of speech?
// Streams a cached sim-human clip in real time (50 ms chunks, then silence + faint noise) and prints every Turn message with its
// arrival offset from the last loud sample. Shows whether a partial with the final words arrives before end_of_turn.
// Usage: node scripts/voice-e2e/stt-timeline.mjs [clip-substring=landlord] [extra query e.g. min_turn_silence=50]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const dir = path.join(os.tmpdir(), 'stay-sim-human');
const want = process.argv[2] || 'landlord';
const extra = new URLSearchParams(process.argv[3] || '');
const txt = fs.readdirSync(dir).filter((f) => f.endsWith('.txt')).find((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes(want));
if (!txt) throw new Error('no cached clip containing ' + want + ' (run sim-human once first)');
const pcm = fs.readFileSync(path.join(dir, txt.replace('.txt', '.pcm')));
let lastLoud = 0;
for (let i = 0; i + 1 < pcm.length; i += 2) if (Math.abs(pcm.readInt16LE(i)) > 800) lastLoud = i;
const speechMs = lastLoud / 48;
const key = process.env.ASSEMBLYAI_API_KEY;
const tok = (await (await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=120&max_session_duration_seconds=300', { headers: { Authorization: key } })).json()).token;
const q = new URLSearchParams({ sample_rate: '24000', encoding: 'pcm_s16le', speech_model: 'universal-3-6-pro', token: tok });
for (const [k, v] of extra) q.set(k, v);
const ws = new WebSocket('wss://streaming.assemblyai.com/v3/ws?' + q);
let t0 = 0;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === 'Begin') { void stream(); return; }
  if (m.type !== 'Turn') { if (m.type === 'Error') console.log('ERROR', e.data); return; }
  const off = Math.round(performance.now() - t0 - speechMs);
  console.log(String(off).padStart(6), 'ms vs speech end |', m.end_of_turn ? 'END_OF_TURN' : 'partial    ', m.turn_is_formatted ? 'fmt' : '   ', '|', m.transcript);
};
async function stream() {
  t0 = performance.now();
  const CH = 2400; // 50 ms of 24 kHz s16
  const total = pcm.length + 24000 * 2 * 3; // + 3 s of silence
  for (let i = 0; i * CH < total; i++) {
    const target = t0 + i * 50;
    const wait = target - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const chunk = Buffer.alloc(CH);
    if (i * CH < pcm.length) pcm.copy(chunk, 0, i * CH, Math.min(pcm.length, (i + 1) * CH));
    ws.send(chunk);
  }
  setTimeout(() => { ws.send(JSON.stringify({ type: 'Terminate' })); process.exit(0); }, 800);
}
console.log('clip', txt, 'speech ends at', Math.round(speechMs), 'ms of', Math.round(pcm.length / 48), 'ms', extra.toString() ? 'extra ' + extra : '');
