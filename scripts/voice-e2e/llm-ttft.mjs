// Time to response headers / first spoken-content token / total, straight against Groq, for the real Stay prompt and tool.
// Interleaves the configs so drift hits all of them equally. Usage: node scripts/voice-e2e/llm-ttft.mjs [runs=8]
import fs from 'node:fs';
for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || '').split(',')[0].trim();
const RUNS = Number(process.argv[2] || 8);
const SYSTEM = [
  'You are Stay, a calm friend who helps an adult with ADHD start tasks. Voice: Lady Lavender. Soft and calm. Slows everything down when you are overwhelmed.',
  'One or two short sentences, at most 15 words. Never read lists aloud. Never talk over a pause.',
  'Call the app tool when asked to open a screen, start or stop a timer, change voice or language, remember, forget, show memory, add to their list, brain dump, start a routine, check in later, or park a thought ("park it: call the dentist" = action park, value the thought). Never for ordinary talk. Confirm briefly.',
  'If they ramble, name ONE two-minute first step; park the rest only if asked.',
  'Match their language. Not a therapist; never advise on medication.',
].join('\n');
const TOOL = { type: 'function', function: { name: 'app', description: 'Control the Stay app. Call only when the user explicitly asks to open, change, start, stop, remember, forget, park or show something. One action per call. Never save feelings, worries or what they are struggling with unless they say remember.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['open', 'ground', 'timer_start', 'timer_stop', 'outcome', 'plan', 'shape', 'color', 'language', 'voice', 'memory_add', 'memory_forget', 'memory_show', 'park', 'park_show', 'dump', 'list_add', 'list_show', 'routine', 'remind', 'quiet', 'game', 'pause', 'export_data', 'delete_data'] }, value: { type: 'string', description: 'Target or text: screen, language, voice name, colour, object for the orb, fact to remember, thought to park, item for the list, routine name, task, outcome, game, on/off' }, minutes: { type: 'number' }, step: { type: 'string', description: 'The first tiny step, when planning or starting a timer' } }, required: ['action'] } } };
const TURNS = ['Um, I keep putting off replying to my landlord about the renewal.', 'I do not even know what to write, it feels huge.', 'Okay, maybe. What would the first sentence even be?'];
const EXTRA = JSON.parse(process.env.LLM_CONFIGS || 'null');
const CONFIGS = EXTRA || [
  { name: '120b low +tools (now)', model: 'openai/gpt-oss-120b', effort: 'low', tools: true },
  { name: '120b low no-tools', model: 'openai/gpt-oss-120b', effort: 'low', tools: false },
  { name: '20b low +tools', model: 'openai/gpt-oss-20b', effort: 'low', tools: true },
  { name: '20b low no-tools', model: 'openai/gpt-oss-20b', effort: 'low', tools: false },
];
const med = (xs) => { xs = xs.filter((x) => x != null).sort((a, b) => a - b); return xs.length ? Math.round(xs[Math.floor(xs.length / 2)]) : null; };
async function one(c, userText) {
  const t0 = performance.now();
  const body = { model: c.model, stream: true, temperature: 0.5, max_tokens: c.maxTokens || 220, messages: [{ role: 'system', content: c.system || SYSTEM }, { role: 'user', content: userText }], ...(c.tools ? { tools: [TOOL], tool_choice: 'auto' } : {}), ...(c.effort ? { reasoning_effort: c.effort, include_reasoning: false } : {}), ...(c.extra || {}) };
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const tHdr = performance.now() - t0;
  if (!res.ok) return { err: res.status + ' ' + (await res.text()).slice(0, 120) };
  const dec = new TextDecoder(); let buf = '', tTok = null, text = '';
  for await (const chunk of res.body) {
    buf += dec.decode(chunk, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop();
    for (const l of lines) { if (!l.startsWith('data: ') || l.includes('[DONE]')) continue; try { const d = JSON.parse(l.slice(6)).choices?.[0]?.delta; if (d?.content) { if (tTok == null) tTok = performance.now() - t0; text += d.content; } } catch { /* partial */ } }
  }
  return { hdr: tHdr, tok: tTok, total: performance.now() - t0, text };
}
await one(CONFIGS[0], 'hi'); // warm the connection path
const out = CONFIGS.map(() => ({ hdr: [], tok: [], total: [], err: 0, sample: '' }));
const GAP = Number(process.env.GAP_MS || 0);
for (let r = 0; r < RUNS; r++) for (let i = 0; i < CONFIGS.length; i++) {
  if (GAP) await new Promise((res) => setTimeout(res, GAP));
  const x = await one(CONFIGS[i], TURNS[r % TURNS.length]);
  if (x.err) { out[i].err++; out[i].sample = x.err; continue; }
  out[i].hdr.push(x.hdr); out[i].tok.push(x.tok); out[i].total.push(x.total); out[i].sample = x.text.slice(0, 70);
}
console.log('config'.padEnd(26), 'hdr p50', 'first-tok p50', 'range(first-tok)', 'total p50', 'errs');
CONFIGS.forEach((c, i) => { const o = out[i]; const t = o.tok.filter(Boolean).sort((a, b) => a - b); console.log(c.name.padEnd(26), String(med(o.hdr)).padStart(7), String(med(o.tok)).padStart(13), `${Math.round(t[0] ?? 0)}-${Math.round(t.at(-1) ?? 0)}`.padStart(16), String(med(o.total)).padStart(9), o.err, o.err ? o.sample : `| "${o.sample}"`); });
