// Live protocol probe: connects to the AssemblyAI Voice Agent API with candidate session.update payloads
// and prints only event types / error codes (never keys or tokens). Costs a few seconds of session time.
// Usage: node scripts/probe-voice-protocol.mjs
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
if (!KEY) {
  console.error('ASSEMBLYAI_API_KEY missing');
  process.exit(1);
}

const tools = [
  {
    type: 'function',
    name: 'start_focus_timer',
    description: 'Start the focus timer.',
    parameters: { type: 'object', properties: { minutes: { type: 'integer' } }, required: ['minutes'] },
  },
];

const CASES = {
  'NEW documented schema (en, voice anna)': {
    system_prompt: 'You are Stay.',
    greeting: 'Hi.',
    input: { keyterms: ['ADHD', 'Stay'], voice_focus: 'near-field', turn_detection: { interrupt_response: true } },
    tools,
    output: { voice: 'anna' },
  },
  'NEW + language_codes [es] + voice lola': {
    system_prompt: 'You are Stay.',
    greeting: 'Hola.',
    input: { language_codes: ['es'] },
    output: { voice: 'lola' },
  },
  'OLD invented voice id (oliver)': {
    system_prompt: 'You are Stay.',
    greeting: 'Hi.',
    output: { voice: 'oliver' },
  },
  'OLD invented session fields': {
    system_prompt: 'You are Stay.',
    greeting: 'Hi.',
    speech_model: 'u3-rt-pro',
    language_detection: true,
    speaker_isolation: true,
    voice_focus: true,
    keyterms: ['ADHD'],
    output: { type: 'audio', voice: 'anna', format: { encoding: 'audio/pcm', sample_rate: 24000 } },
  },
  'OLD wrapped tool shape': {
    system_prompt: 'You are Stay.',
    greeting: 'Hi.',
    tools: [{ type: 'function', function: tools[0] }],
    output: { voice: 'anna' },
  },
  'language_codes [hi] (unsupported by Voice Agent)': {
    system_prompt: 'You are Stay.',
    greeting: 'Hi.',
    input: { language_codes: ['hi'] },
    output: { voice: 'anna' },
  },
};

async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`token HTTP ${r.status}`);
  return (await r.json()).token;
}

function runCase(name, session) {
  return new Promise(async (resolve) => {
    const events = [];
    let ws;
    try {
      const token = await mint();
      ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(token)}`);
    } catch (e) {
      return resolve({ name, events: [`mint/connect failed: ${e.message}`] });
    }
    const done = (why) => {
      try {
        ws.send(JSON.stringify({ type: 'session.end' }));
      } catch {}
      setTimeout(() => {
        try {
          ws.close();
        } catch {}
        resolve({ name, events: [...new Set(events)], why });
      }, 300);
    };
    const timer = setTimeout(() => done('timeout'), 6000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session }));
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.type === 'session.error') events.push(`session.error code=${m.code} msg="${String(m.message).slice(0, 90)}"`);
      else if (m.type !== 'reply.audio' && m.type !== 'transcript.agent.delta') events.push(m.type);
      if (m.type === 'session.ready') setTimeout(() => { clearTimeout(timer); done('ready'); }, 1200);
      if (m.type === 'session.error') setTimeout(() => { clearTimeout(timer); done('error'); }, 800);
    };
    ws.onclose = (e) => {
      events.push(`close ${e.code}`);
    };
  });
}

for (const [name, session] of Object.entries(CASES)) {
  const r = await runCase(name, session);
  console.log(`\n# ${r.name}\n  ${r.events.join('\n  ')}`);
}
process.exit(0);
