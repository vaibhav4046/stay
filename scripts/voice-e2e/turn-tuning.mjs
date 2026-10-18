// Finds turn_detection values that are fast AND patient: for each candidate config, measures
//  (1) normal sentence: end of speech -> first reply audio, and
//  (2) a sentence with a 1.3 s mid-sentence pause: does the agent answer during the pause (talks over the user)?
// Usage: node scripts/voice-e2e/turn-tuning.mjs <dir with en.pcm> <dir with pause.pcm + pause.json>
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
const [enDir, pauseDir] = process.argv.slice(2);
const normal = fs.readFileSync(path.join(enDir, 'en.pcm'));
const paused = fs.readFileSync(path.join(pauseDir, 'pause.pcm'));
const part2StartMs = JSON.parse(fs.readFileSync(path.join(pauseDir, 'pause.json'), 'utf8')).part2StartMs;
const CHUNK = 2400 * 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROMPT = `You are Stay, a calm friend who helps an adult with ADHD start a task. Reply in one or two short sentences, at most 15 words. Name one tiny first move and ask if it feels doable. No medication advice.`;

const CONFIGS = {
  'none (provider defaults)': null,
  'min_silence 400': { min_silence: 400 },
  'min_silence 700': { min_silence: 700 },
  'min_silence 1000': { min_silence: 1000 },
  'min_silence 1400 max 4000': { min_silence: 1400, max_silence: 4000 },
  'min 700 + vad 0.6': { min_silence: 700, vad_threshold: 0.6 },
};

async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${KEY}` } });
  return (await r.json()).token;
}

function run(td, pcm, isPause) {
  return new Promise(async (resolve) => {
    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(await mint())}`);
    const o = { streamStart: 0, sentDone: 0, firstReplyStarted: 0, firstAudio: 0, userTurns: 0, text: '' };
    let finished = false, streaming = false;
    const finish = () => { if (finished) return; finished = true; try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {} setTimeout(() => { try { ws.close(); } catch {} resolve(o); }, 200); };
    const hard = setTimeout(finish, 30000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: PROMPT, greeting: 'Hi.', input: { voice_focus: 'near-field', ...(td ? { turn_detection: td } : {}) }, output: { voice: 'anna' } } }));
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data), now = Date.now();
      if (m.type === 'session.ready') {
        setTimeout(async () => {
          streaming = true; o.streamStart = Date.now();
          for (let i = 0; i < pcm.length; i += CHUNK) { ws.send(JSON.stringify({ type: 'input.audio', audio: pcm.subarray(i, i + CHUNK).toString('base64') })); await sleep(100); }
          o.sentDone = Date.now();
          const sil = Buffer.alloc(CHUNK).toString('base64');
          for (let i = 0; i < 120 && !finished; i++) { ws.send(JSON.stringify({ type: 'input.audio', audio: sil })); await sleep(100); }
        }, 2500);
      }
      if (!streaming) return;
      if (m.type === 'transcript.user') o.userTurns++;
      if (m.type === 'reply.started' && !o.firstReplyStarted) o.firstReplyStarted = now;
      if (m.type === 'reply.audio' && !o.firstAudio) o.firstAudio = now;
      if (m.type === 'transcript.agent' && o.sentDone) { o.text = m.text; clearTimeout(hard); finish(); }
    };
  });
}

for (const [name, td] of Object.entries(CONFIGS)) {
  const n = await run(td, normal, false);
  await sleep(2500);
  const p = await run(td, paused, true);
  await sleep(2500);
  const lag = n.firstAudio && n.sentDone ? n.firstAudio - n.sentDone : null;
  const earlyAt = p.firstReplyStarted ? p.firstReplyStarted - p.streamStart : null;
  const talkedOver = earlyAt !== null && earlyAt < part2StartMs + 1500; // answered before the second half could finish
  console.log(`${name.padEnd(28)} lag after speech ${String(lag).padStart(5)}ms | pause test: first reply at +${earlyAt}ms (2nd half starts +${part2StartMs}ms) user turns=${p.userTurns} ${talkedOver ? 'TALKED OVER' : 'waited'}`);
}
process.exit(0);
