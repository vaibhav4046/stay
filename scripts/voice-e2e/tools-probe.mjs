// Validates the compact `app` control tool live: spoken commands -> does the agent call the right action, once,
// and confirm briefly? Also reports the extra latency the tool adds.
// Usage: node scripts/voice-e2e/tools-probe.mjs <work_dir>   (needs edge-tts via uv, ffmpeg, keys in .env.local)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
const work = process.argv[2];
fs.mkdirSync(work, { recursive: true });
const CHUNK = 2400 * 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const APP_TOOL = {
  type: 'function',
  name: 'app',
  description: 'Control the Stay app for the user. Call it whenever they ask you to open, change, start, stop, remember, forget or show something. One action per call.',
  ...(process.env.HOLD === '1' ? { execution_mode: 'hold' } : {}),
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['open', 'ground', 'timer_start', 'timer_stop', 'outcome', 'plan', 'shape', 'color', 'language', 'voice', 'memory_add', 'memory_forget', 'memory_show', 'quiet', 'game', 'pause', 'export_data', 'delete_data'] },
      value: { type: 'string', description: 'The target or text: screen (today, history, report, checkin, settings, privacy), language name, voice name or gender or accent, colour theme (aurora, sunset, ocean, cyber, emerald, default), object to draw, fact to remember, task, outcome (started, partly_started, not_started, paused), game (memory, focus, words), on or off' },
      minutes: { type: 'number' },
      step: { type: 'string', description: 'The first tiny step, when planning or starting a timer' },
    },
    required: ['action'],
  },
};

const PROMPT = `You are Stay, a calm friend helping an adult with ADHD start tasks. Reply in one or two short sentences, at most 15 words. Use the app tool to act on requests; after it, confirm in a few words. Never give medication advice.`;

const CASES = [
  ['open history', 'Can you open my history please.', 'open', 'history'],
  ['language', 'Switch to Spanish.', 'language', 'spanish'],
  ['voice by name', 'Change your voice to Noodle.', 'voice', 'noodle'],
  ['voice by trait', 'Can I have a male British voice?', 'voice', null],
  ['remember', 'Remember that my dog is called Biscuit.', 'memory_add', 'biscuit'],
  ['forget', 'Forget what I said about my dog.', 'memory_forget', null],
  ['show memory', 'What do you remember about me?', 'memory_show', null],
  ['colour', 'Make the orb sunset coloured.', 'color', 'sunset'],
  ['shape', 'Turn into a rocket ship.', 'shape', 'rocket'],
  ['timer', 'Start a twenty minute timer to open the tax folder.', 'timer_start', null],
  ['outcome', 'I did it, I started.', 'outcome', null],
  ['ground', 'I am overwhelmed, help me ground myself.', 'ground', null],
  ['game', 'I want to play a memory game on hard.', 'game', null],
  ['quiet', 'Go quiet, I only want to type.', 'quiet', null],
  ['delete', 'Delete all my data.', 'delete_data', null],
  ['chat only', 'I have been avoiding my taxes.', null, null],
];

function makePcm(id, text) {
  const mp3 = path.join(work, id + '.mp3'), pcm = path.join(work, id + '.pcm'), txt = path.join(work, id + '.txt');
  if (fs.existsSync(pcm) && fs.existsSync(txt) && fs.readFileSync(txt, 'utf8') === text) return pcm;
  // the sentence goes through a file: passing it as a shell argument splits it at spaces and synthesizes one word
  fs.writeFileSync(txt, text);
  const a = spawnSync('uv', ['run', '--with', 'edge-tts', 'python', path.join(process.cwd(), 'scripts/voice-e2e/tts_one.py'), mp3, txt]);
  const b = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '24000', '-ac', '1', '-f', 's16le', pcm]);
  if (a.status !== 0 || b.status !== 0) throw new Error('tts failed for ' + id);
  return pcm;
}

async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${KEY}` } });
  return (await r.json()).token;
}

function run(pcm) {
  return new Promise(async (resolve) => {
    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(await mint())}`);
    const o = { heard: '', calls: [], replies: 0, text: '', sentDone: 0, firstAudio: 0, err: '' };
    let finished = false, streaming = false, lastActivity = Date.now();
    const finish = () => { if (finished) return; finished = true; try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {} setTimeout(() => { try { ws.close(); } catch {} resolve(o); }, 200); };
    const hard = setTimeout(finish, 30000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: PROMPT, greeting: 'Hi.', input: { voice_focus: 'near-field' }, tools: [APP_TOOL], output: { voice: 'anna' } } }));
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data), now = Date.now();
      if (m.type === 'session.error') o.err = `${m.code}: ${String(m.message).slice(0, 70)}`;
      if (m.type === 'session.ready') {
        setTimeout(async () => {
          streaming = true;
          for (let i = 0; i < pcm.length; i += CHUNK) { ws.send(JSON.stringify({ type: 'input.audio', audio: pcm.subarray(i, i + CHUNK).toString('base64') })); await sleep(100); }
          o.sentDone = Date.now();
          const sil = Buffer.alloc(CHUNK).toString('base64');
          for (let i = 0; i < 200 && !finished; i++) { ws.send(JSON.stringify({ type: 'input.audio', audio: sil })); await sleep(100); }
        }, 2500);
      }
      if (!streaming) return;
      if (m.type === 'tool.call') {
        o.calls.push({ action: m.arguments?.action, value: m.arguments?.value, minutes: m.arguments?.minutes, step: m.arguments?.step, at: now - o.sentDone });
        ws.send(JSON.stringify({ type: 'tool.result', call_id: m.call_id, result: JSON.stringify({ ok: true }) }));
      }
      if (m.type === 'transcript.user') o.heard = (o.heard + ' ' + m.text).trim();
      if (m.type === 'reply.started' && o.sentDone) o.replies++;
      if (m.type === 'reply.audio' && o.sentDone && !o.firstAudio) o.firstAudio = now;
      if (m.type === 'transcript.agent' && o.sentDone) {
        o.text = m.text;
        lastActivity = now;
        // wait a little for a possible second reply after the tool result
        setTimeout(() => { if (Date.now() - lastActivity >= 3500) { clearTimeout(hard); finish(); } }, 3600);
      }
    };
  });
}

let ok = 0;
const only = process.argv[3] ? process.argv[3].split(',') : null;
for (const [id, text, wantAction, wantValue] of CASES.filter(([id]) => !only || only.includes(id))) {
  // 700 ms of room tone before speech, like a real microphone: without it the first consonant is clipped
  const pcm = Buffer.concat([Buffer.alloc(33600), fs.readFileSync(makePcm(id.replace(/\W+/g, '_'), text))]);
  const r = await run(pcm);
  const c = r.calls[0];
  const actionOk = wantAction === null ? r.calls.length === 0 : c?.action === wantAction;
  const valueOk = !wantValue || String(c?.value || '').toLowerCase().includes(wantValue);
  const pass = actionOk && valueOk && r.calls.length <= 1;
  if (pass) ok++;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id.padEnd(14)} calls=${r.calls.length} ${c ? `${c.action}(${[c.value, c.minutes, c.step].filter((x) => x != null).join(' | ')})` : '-'}  replies=${r.replies}  first-audio+${r.firstAudio ? r.firstAudio - r.sentDone : '-'}ms  ${r.err}\n      heard: ${JSON.stringify(r.heard.slice(0, 80))}
      says:  ${JSON.stringify(r.text.slice(0, 90))}`);
  await sleep(2500);
}
console.log(`\n${ok}/${CASES.length} correct on the first try`);
process.exit(0);
