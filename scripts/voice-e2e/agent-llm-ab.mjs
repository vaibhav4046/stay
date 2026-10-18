// Does a faster LLM on a stored agent cut reply latency vs the managed default? Creates a temporary agent per model,
// measures end of speech -> first reply audio on one spoken sentence, then deletes the agent.
// Usage: node scripts/voice-e2e/agent-llm-ab.mjs <dir with en.pcm> [model1,model2,...]
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
const pcm = fs.readFileSync(path.join(process.argv[2], 'en.pcm'));
const models = (process.argv[3] || 'managed,qwen3.5-4b-32k-fast,claude-haiku-4-5,gpt-5-mini,gemini-2.5-flash').split(',');
const CHUNK = 2400 * 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROMPT = `You are Stay, a calm friend who helps an adult with ADHD start a task. Reply in one or two short sentences, at most 15 words. Name one tiny first move and ask if it feels doable. No medication advice.`;

async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${KEY}` } });
  return (await r.json()).token;
}

async function createAgent(model) {
  const body = { name: `stay-lat-${Date.now()}`, system_prompt: PROMPT, greeting: 'Hi.', voice: { voice_id: 'anna' } };
  if (model !== 'managed') body.llm = [{ base_url: 'https://llm-gateway.assemblyai.com/v1', model, api_key: KEY }];
  const r = await fetch('https://agents.assemblyai.com/v1/agents', { method: 'POST', headers: { Authorization: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (r.status !== 201) throw new Error(`create ${r.status} ${JSON.stringify(j).slice(0, 160)}`);
  return j.id;
}
const deleteAgent = (id) => fetch(`https://agents.assemblyai.com/v1/agents/${id}`, { method: 'DELETE', headers: { Authorization: KEY } }).catch(() => {});

function run(agentId) {
  return new Promise(async (resolve) => {
    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(await mint())}`);
    const o = { sentDone: 0, firstAudio: 0, text: '', err: '' };
    let finished = false, streaming = false;
    const finish = () => { if (finished) return; finished = true; try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {} setTimeout(() => { try { ws.close(); } catch {} resolve(o); }, 200); };
    const hard = setTimeout(finish, 30000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { agent_id: agentId } }));
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data), now = Date.now();
      if (m.type === 'session.error') { o.err = `${m.code}:${String(m.message).slice(0, 80)}`; }
      if (m.type === 'session.ready') {
        setTimeout(async () => {
          streaming = true;
          for (let i = 0; i < pcm.length; i += CHUNK) { ws.send(JSON.stringify({ type: 'input.audio', audio: pcm.subarray(i, i + CHUNK).toString('base64') })); await sleep(100); }
          o.sentDone = Date.now();
          const sil = Buffer.alloc(CHUNK).toString('base64');
          for (let i = 0; i < 120 && !finished; i++) { ws.send(JSON.stringify({ type: 'input.audio', audio: sil })); await sleep(100); }
        }, 2500);
      }
      if (!streaming) return;
      if (m.type === 'reply.audio' && !o.firstAudio && o.sentDone) o.firstAudio = now;
      if (m.type === 'transcript.agent' && o.sentDone) { o.text = m.text; clearTimeout(hard); finish(); }
    };
  });
}

for (const model of models) {
  let id;
  try {
    id = await createAgent(model);
  } catch (e) {
    console.log(`${model.padEnd(24)} CREATE FAILED ${e.message}`);
    continue;
  }
  const lags = [];
  let sample = '', err = '';
  for (let i = 0; i < 2; i++) {
    const r = await run(id);
    lags.push(r.firstAudio && r.sentDone ? r.firstAudio - r.sentDone : null);
    sample = r.text || sample;
    err = r.err || err;
    await sleep(2500);
  }
  await deleteAgent(id);
  console.log(`${model.padEnd(24)} first audio after speech: ${lags.map((l) => (l === null ? 'none' : l + 'ms')).join(', ')} ${err ? 'ERR ' + err : ''}  ${JSON.stringify(sample.slice(0, 70))}`);
}
process.exit(0);
