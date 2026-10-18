// Replicates the app's exact Voice Agent session and removes one piece at a time, to find what delays the reply.
// Measures per variant: speech.stopped -> reply.started -> first reply audio (ms), 2 runs each.
// Usage: node scripts/voice-e2e/session-ab.mjs <dir with en.pcm>
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
const pcm = Buffer.concat([Buffer.alloc(33600), fs.readFileSync(path.join(process.argv[2], 'en.pcm'))]);
const CHUNK = 2400 * 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT = `You are Stay, a calm friend who helps an adult with ADHD start tasks. Voice: Lady Lavender. Soft and calm. Slows everything down when you are overwhelmed.
Speak one or two short sentences, at most 15 words. Never read lists aloud. Never talk over a pause or an um.
Use the app tool when asked to open, change, start, stop, remember or forget something, then confirm in a few words.
If they ramble several tasks, keep it brief and name ONE two-minute physical first step.
Match the language they speak. You are not a therapist and never advise on medication.`;
const KEYTERMS = ['Stay', 'ADHD', 'micro-step', 'parking lot', 'Crumpet', 'Chaiwala', 'Sprocket', 'Lavender', 'Fettuccine', 'Tornado', 'Pretzel', 'Waffle', 'Outback', 'Croissant', 'Bagel', 'Maple Moose', 'Matcha', 'Viking Velvet', 'Goblin Mode', 'Pumpkin Pixel'];
const TOOL = { type: 'function', name: 'app', description: 'Control the Stay app. Call when the user asks to open, change, start, stop, remember, forget or show something. One action per call.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['open', 'ground', 'timer_start', 'timer_stop', 'outcome', 'plan', 'shape', 'color', 'language', 'voice', 'memory_add', 'memory_forget', 'memory_show', 'quiet', 'game', 'pause', 'export_data', 'delete_data'] }, value: { type: 'string' }, minutes: { type: 'number' }, step: { type: 'string' } }, required: ['action'] } };
const GREETING = 'Lady Lavender here. What are you putting off?';

const V = {
  'app exact (keyterms20 + tool + greeting + context msg)': { ctxMsg: true, keyterms: KEYTERMS, tools: [TOOL], greeting: GREETING },
  'no context message': { ctxMsg: false, keyterms: KEYTERMS, tools: [TOOL], greeting: GREETING },
  'keyterms 2 instead of 20': { ctxMsg: true, keyterms: ['Stay', 'ADHD'], tools: [TOOL], greeting: GREETING },
  'no tool': { ctxMsg: true, keyterms: KEYTERMS, tools: [], greeting: GREETING },
  'greeting Hi.': { ctxMsg: true, keyterms: KEYTERMS, tools: [TOOL], greeting: 'Hi.' },
};

async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${KEY}` } });
  return (await r.json()).token;
}

function run(v) {
  return new Promise(async (resolve) => {
    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(await mint())}`);
    const o = { stopped: 0, started: 0, audio: 0, sentDone: 0 };
    let finished = false, streaming = false;
    const finish = () => { if (finished) return; finished = true; try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {} setTimeout(() => { try { ws.close(); } catch {} resolve(o); }, 200); };
    const hard = setTimeout(finish, 30000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: PROMPT, greeting: v.greeting, input: { keyterms: v.keyterms, voice_focus: 'near-field' }, ...(v.tools.length ? { tools: v.tools } : {}), output: { voice: 'anna' } } }));
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data), now = Date.now();
      if (m.type === 'session.ready') {
        if (v.ctxMsg) ws.send(JSON.stringify({ type: 'conversation.message', role: 'system', content: 'User care context: self_managing. Never give medication advice.' }));
        setTimeout(async () => {
          streaming = true;
          for (let i = 0; i < pcm.length; i += CHUNK) { ws.send(JSON.stringify({ type: 'input.audio', audio: pcm.subarray(i, i + CHUNK).toString('base64') })); await sleep(100); }
          o.sentDone = Date.now();
          const sil = Buffer.alloc(CHUNK).toString('base64');
          for (let i = 0; i < 120 && !finished; i++) { ws.send(JSON.stringify({ type: 'input.audio', audio: sil })); await sleep(100); }
        }, 6500); // let the greeting finish first so this measures the reply to the user, not the greeting
      }
      if (!streaming) return;
      if (m.type === 'input.speech.stopped' && !o.stopped) o.stopped = now;
      if (m.type === 'reply.started' && o.stopped && !o.started) o.started = now;
      if (m.type === 'reply.audio' && o.stopped && !o.audio) o.audio = now;
      if (m.type === 'tool.call') ws.send(JSON.stringify({ type: 'tool.result', call_id: m.call_id, result: '{"ok":true}' }));
      if (m.type === 'transcript.agent' && o.stopped) { clearTimeout(hard); finish(); }
    };
  });
}

for (const [name, v] of Object.entries(V)) {
  const rows = [];
  for (let i = 0; i < 2; i++) {
    const r = await run(v);
    rows.push(`stopped->reply.started ${r.started && r.stopped ? r.started - r.stopped : '-'}ms, ->first audio ${r.audio && r.stopped ? r.audio - r.stopped : '-'}ms`);
    await sleep(2500);
  }
  console.log(`${name}\n   ${rows.join('\n   ')}`);
}
process.exit(0);
