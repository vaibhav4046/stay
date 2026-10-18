// Live checks against the AssemblyAI Voice Agent: (1) flat client tools fire tool.call from speech,
// (2) barge-in produces reply.done status=interrupted and how fast. Prints event names/latencies only.
// Usage: node scripts/voice-lang-probe/probe-tools-bargein.mjs <audio_dir>
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
const dir = process.argv[2];
const CHUNK = 2400 * 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tools = [
  {
    type: 'function',
    name: 'start_focus_timer',
    description: 'Start the focus timer once the user agrees to begin.',
    parameters: {
      type: 'object',
      properties: { minutes: { type: 'integer' }, firstStep: { type: 'string' } },
      required: ['minutes', 'firstStep'],
    },
  },
];

async function open() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const token = (await r.json()).token;
  const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(token)}`);
  const log = [];
  const t0 = Date.now();
  const state = { ready: false };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const at = Date.now() - t0;
    if (m.type === 'session.ready') state.ready = true;
    if (m.type !== 'reply.audio' && m.type !== 'transcript.agent.delta' && m.type !== 'transcript.user.delta') log.push({ at, m });
    else if (m.type === 'reply.audio') log.push({ at, m: { type: 'reply.audio' } });
    state.onEvent?.(m, at);
  };
  return { ws, log, t0, state };
}

async function stream(ws, file) {
  const pcm = fs.readFileSync(path.join(dir, file));
  for (let i = 0; i < pcm.length; i += CHUNK) {
    ws.send(JSON.stringify({ type: 'input.audio', audio: pcm.subarray(i, i + CHUNK).toString('base64') }));
    await sleep(100);
  }
  const sil = Buffer.alloc(CHUNK).toString('base64');
  for (let i = 0; i < 15; i++) {
    ws.send(JSON.stringify({ type: 'input.audio', audio: sil }));
    await sleep(100);
  }
}
const until = async (cond, ms) => {
  const s = Date.now();
  while (Date.now() - s < ms) {
    if (cond()) return true;
    await sleep(50);
  }
  return false;
};

// ---- Test 1: tool call from speech
{
  const { ws, log, state } = await open();
  await until(() => ws.readyState === 1, 5000);
  ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You are Stay, a brief ADHD companion. When the user agrees to start, call start_focus_timer.', greeting: 'Hi.', tools, output: { voice: 'anna' } } }));
  await until(() => state.ready, 8000);
  await sleep(2500);
  let call = null;
  state.onEvent = (m) => {
    if (m.type === 'tool.call') {
      call = m;
      ws.send(JSON.stringify({ type: 'tool.result', call_id: m.call_id, result: JSON.stringify({ ok: true }) }));
    }
  };
  await stream(ws, 'timer.pcm');
  await until(() => call, 12000);
  console.log('\n[TOOL] tool.call received:', call ? `${call.name} args=${JSON.stringify(call.arguments)}` : 'NO');
  ws.send(JSON.stringify({ type: 'session.end' }));
  await sleep(300);
  ws.close();
}

// ---- Test 2: barge-in
{
  const { ws, state } = await open();
  await until(() => ws.readyState === 1, 5000);
  ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You are Stay. Give long, detailed, multi-sentence answers.', greeting: 'Hi.', input: { turn_detection: JSON.parse(process.env.TD || '{"interrupt_response":true}') }, output: { voice: 'anna' } } }));
  await until(() => state.ready, 8000);
  await sleep(2500);
  let audioChunks = 0;
  let interruptedAt = 0;
  let speechStartedAt = 0;
  let armed = false;
  let firstAudioAt = 0;
  state.onEvent = (m, at) => {
    if (m.type === 'reply.audio') {
      audioChunks++;
      firstAudioAt ||= at;
    }
    if (m.type === 'input.speech.started' && armed) speechStartedAt ||= Date.now();
    if (m.type === 'reply.done' && m.status === 'interrupted') interruptedAt ||= Date.now();
  };
  const asking = stream(ws, 'ask.pcm');
  await asking;
  await until(() => audioChunks > 5, 15000);
  const bargeStart = Date.now();
  armed = true;
  stream(ws, 'stop.pcm');
  const ok = await until(() => interruptedAt, 10000);
  console.log('[BARGE-IN] reply audio chunks before barge-in:', audioChunks, '| input.speech.started:', speechStartedAt ? `${speechStartedAt - bargeStart} ms after user began speaking` : 'NO', '| reply.done interrupted:', ok ? `${interruptedAt - bargeStart} ms` : 'NO');
  ws.send(JSON.stringify({ type: 'session.end' }));
  await sleep(300);
  ws.close();
}
process.exit(0);
