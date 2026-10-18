// A/B the knobs that decide voice latency against the live Voice Agent, using one spoken sentence.
// Measures: end of user speech -> first reply audio, and how long the reply runs. Prints numbers only.
// Usage: node scripts/voice-e2e/latency-ab.mjs <audio_dir_with_en.pcm> [reps]
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
const dir = process.argv[2];
const reps = Number(process.argv[3] || 2);
const pcm = fs.readFileSync(path.join(dir, 'en.pcm'));
const CHUNK = 2400 * 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const LONG_PROMPT = fs.readFileSync(path.join(process.cwd(), 'scripts/voice-e2e/long-prompt.txt'), 'utf8');
const SHORT_PROMPT = `You are Stay, a calm friend who helps an adult with ADHD start a task. Reply in one or two short sentences, at most 15 words. Never lecture. Name one tiny first move and ask if it feels doable. Match the user's language. No medication advice.`;

const T = (name, description, props = {}) => ({ type: 'function', name, description, parameters: { type: 'object', properties: Object.fromEntries(Object.keys(props).map((k) => [k, { type: 'string' }])), required: Object.keys(props) } });
const TOOLS9 = [
  T('propose_coaching_plan', 'Decompose an overwhelming task into ONE micro-step (<60s) with a personalized strategy.', { taskText: 1, firstStep: 1 }),
  T('start_focus_timer', 'Start a bounded focus timer.', { minutes: 1, firstStep: 1 }),
  T('record_session_outcome', 'Log whether the user started, partly started, or did not start.', { outcome: 1 }),
  T('show_shape', 'Make the orb take the shape of a simple object that resonates with the topic.', { object: 1 }),
  T('predict_task_reality', 'Calculate realistic initiation duration vs perceived time.', { taskText: 1 }),
  T('brainstorm_starter_angles', 'Brainstorm 3 zero-friction starter angles.', { taskText: 1 }),
  T('synthesize_task_path', 'Synthesize a 3-phase execution path.', { taskText: 1 }),
  T('set_language', 'Switch the spoken language.', { language: 1 }),
  T('open_screen', 'Open an app screen.', { screen: 1 }),
];

const LONG_GREETING = "Hey! I'm Stay, sitting right here with you. What's one thing hanging over your head right now? We'll make the first move ridiculously easy.";
const VARIANTS = {
  'F app-like: long prompt + 9 tools + interrupt_response only': { prompt: LONG_PROMPT, tools: TOOLS9, input: { turn_detection: { interrupt_response: true } } },
  'G app-like + long greeting': { prompt: LONG_PROMPT, tools: TOOLS9, greeting: LONG_GREETING, input: { turn_detection: { interrupt_response: true } }, wait: 1500 },
  'A current-size prompt + 9 tools': { prompt: LONG_PROMPT, tools: TOOLS9, input: {} },
  'B short prompt + 9 tools': { prompt: SHORT_PROMPT, tools: TOOLS9, input: {} },
  'C short prompt + 4 tools': { prompt: SHORT_PROMPT, tools: TOOLS9.slice(0, 4), input: {} },
  'D short prompt, no tools': { prompt: SHORT_PROMPT, tools: [], input: {} },
  'E short + 4 tools + min_latency STT': { prompt: SHORT_PROMPT, tools: TOOLS9.slice(0, 4), input: { transcription_mode: 'min_latency' } },
};

// (v.wait lets a long greeting overlap the user's speech, like the real app)
async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${KEY}` } });
  return (await r.json()).token;
}

function run(v) {
  return new Promise(async (resolve) => {
    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(await mint())}`);
    const out = { stopped: 0, firstAudio: 0, lastAudio: 0, words: 0, text: '' };
    let sentDone = 0, finished = false, streaming = false, greetingDone = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {}
      setTimeout(() => { try { ws.close(); } catch {} resolve(out); }, 200);
    };
    const hard = setTimeout(finish, 40000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'session.update', session: { system_prompt: v.prompt, greeting: v.greeting || 'Hi.', input: { keyterms: ['ADHD', 'Stay'], voice_focus: 'near-field', ...v.input }, ...(v.tools.length ? { tools: v.tools } : {}), output: { voice: 'anna' } } }));
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      const now = Date.now();
      if (m.type === 'session.ready') {
        setTimeout(async () => {
          streaming = true;
          for (let i = 0; i < pcm.length; i += CHUNK) { ws.send(JSON.stringify({ type: 'input.audio', audio: pcm.subarray(i, i + CHUNK).toString('base64') })); await sleep(100); }
          sentDone = Date.now();
          const sil = Buffer.alloc(CHUNK).toString('base64');
          for (let i = 0; i < 150 && !finished; i++) { ws.send(JSON.stringify({ type: 'input.audio', audio: sil })); await sleep(100); }
        }, v.wait ?? 2500);
      }
      if (!streaming) return;
      if (m.type === 'input.speech.stopped' && !out.stopped) out.stopped = now;
      if (m.type === 'reply.audio') { if (sentDone && !out.firstAudio) out.firstAudio = now; if (out.firstAudio) out.lastAudio = now; }
      if (m.type === 'tool.call') ws.send(JSON.stringify({ type: 'tool.result', call_id: m.call_id, result: '{"ok":true}' }));
      if (m.type === 'transcript.agent' && sentDone) { out.text = m.text; out.words = m.text.split(/\s+/).length; clearTimeout(hard); finish(); }
    };
    out.sentDoneRef = () => sentDone;
    out.mark = () => sentDone;
    ws.onclose = () => { out.endedAt = Date.now(); };
    const poll = setInterval(() => { if (finished) { out.sentDone = sentDone; clearInterval(poll); } }, 100);
  });
}

for (const [name, v] of Object.entries(VARIANTS).filter(([n])=>/^(F|G) /.test(n)||process.env.ALL)) {
  const rows = [];
  for (let i = 0; i < reps; i++) {
    const r = await run(v);
    const sd = r.sentDone || 0;
    rows.push({ stopMs: r.stopped ? r.stopped - sd : null, ttfa: r.firstAudio ? r.firstAudio - sd : null, speakS: r.lastAudio && r.firstAudio ? ((r.lastAudio - r.firstAudio) / 1000).toFixed(1) : null, words: r.words, text: r.text });
    await sleep(3000); // stay under the provider's rate limits
  }
  console.log(`${name}\n  ` + rows.map((r) => `stop+${r.stopMs}ms  first-audio+${r.ttfa}ms  speaks ${r.speakS}s  ${r.words}w`).join('\n  ') + `\n  e.g. ${JSON.stringify(rows[0].text.slice(0, 110))}`);
}
process.exit(0);
