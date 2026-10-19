// What does AssemblyAI streaming speech-to-text do with non-English speech under different connection settings?
// Usage: node scripts/voice-e2e/stt-lang-probe.mjs <dir with es.pcm fr.pcm de.pcm ... (16 kHz s16le)> [langs=es,fr,de]
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const AAI = process.env.ASSEMBLYAI_API_KEY;
const dir = process.argv[2];
const langs = (process.argv[3] || 'es,fr,de').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sleepUntil = (t) => sleep(Math.max(0, t - Date.now()));

const VARIANTS = {
  'default (universal-3-6-pro)': (l) => ({ speech_model: 'universal-3-6-pro' }),
  'language_codes=["xx"]': (l) => ({ speech_model: 'universal-3-6-pro', language_codes: JSON.stringify([l]) }),
  'language_code=xx': (l) => ({ speech_model: 'universal-3-6-pro', language_code: l }),
  'language_detection=true': (l) => ({ speech_model: 'universal-3-6-pro', language_detection: 'true' }),
  'universal-streaming-multilingual': (l) => ({ speech_model: 'universal-streaming-multilingual' }),
};

async function run(l, extra) {
  const pcm = fs.readFileSync(path.join(dir, `${l}.pcm`));
  const { token } = await (await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=120', { headers: { Authorization: AAI } })).json();
  const q = new URLSearchParams({ sample_rate: '16000', encoding: 'pcm_s16le', token, ...extra });
  return new Promise((resolve) => {
    const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${q}`);
    let done = false, text = '', err = '';
    const fin = () => { if (done) return; done = true; try { ws.send(JSON.stringify({ type: 'Terminate' })); } catch {} setTimeout(() => { try { ws.close(); } catch {} resolve({ text, err }); }, 100); };
    const hard = setTimeout(fin, 25000);
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'Error' || m.error) err = JSON.stringify(m).slice(0, 120);
      if (m.type === 'Begin') {
        const t0 = Date.now(); let k = 0;
        for (let i = 0; i < pcm.length && !done; i += 1600) { ws.send(pcm.subarray(i, i + 1600)); await sleepUntil(t0 + ++k * 50); }
        for (let i = 0; i < 40 && !done; i++) { ws.send(Buffer.alloc(1600)); await sleepUntil(t0 + ++k * 50); }
        fin();
      }
      if (m.type === 'Turn' && m.transcript) text = m.transcript;
      if (m.type === 'Turn' && m.end_of_turn) { clearTimeout(hard); text = m.transcript; fin(); }
    };
    ws.onerror = () => { err = err || 'ws error'; fin(); };
    ws.onclose = () => { if (!done) { err = err || 'closed early'; fin(); } };
  });
}

for (const [name, mk] of Object.entries(VARIANTS)) {
  console.log(`\n== ${name}`);
  for (const l of langs) {
    const r = await run(l, mk(l));
    console.log(`  ${l}: ${r.err ? `ERROR ${r.err}` : JSON.stringify(r.text.slice(0, 90))}`);
    await sleep(500);
  }
}
process.exit(0);
