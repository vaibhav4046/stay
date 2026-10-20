// Does a cheaper/faster chat model still behave as Stay? Runs the real system prompt + real `app` tool (read from agentTool.ts)
// against spoken-command cases and ordinary ADHD lines. Checks: right action, called once, no tool on ordinary talk, reply length.
// Usage: node scripts/voice-e2e/llm-quality.mjs <model> [effort|none|-] [maxTokens=220]
import fs from 'node:fs';
for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const [model, effort = '-', maxTokens = '220'] = process.argv.slice(2);
const src = fs.readFileSync('src/lib/voice/agentTool.ts', 'utf8').split(String.fromCharCode(13)).join('');
const body = src.slice(src.indexOf('export const APP_ACTIONS'), src.indexOf('const clip')).replace(/export type[^\n]*\n/g, '').replace(/export interface[\s\S]*?\n}\n/g, '').replace(/export const/g, 'const').replace(/ as const/g, '');
const { APP_TOOL } = new Function(body + '\nreturn { APP_TOOL };')();
const TOOL = { type: 'function', function: { name: APP_TOOL.name, description: APP_TOOL.description, parameters: APP_TOOL.parameters } };
const SYSTEM = [
  'You are Stay, a calm friend who helps an adult with ADHD start tasks. Voice: Lady Lavender. Soft and calm. Slows everything down when you are overwhelmed.',
  'One or two short sentences, at most 15 words. Never read lists aloud. Never talk over a pause.',
  'Call the app tool when asked to open a screen, start or stop a timer, change voice or language, remember, forget, show memory, add to their list, brain dump, start a routine, check in later, or park a thought ("park it: call the dentist" = action park, value the thought). Never for ordinary talk. Confirm briefly.',
  'If they ramble, name ONE two-minute first step; park the rest only if asked.',
  'Match their language. Not a therapist; never advise on medication.',
].join('\n');
const CASES = [
  ['Park it, I need to call the dentist.', 'park', 'dentist'], ['Show me what I parked.', 'park_show'], ['Can you open my history please.', 'open', 'history'],
  ['Switch to Spanish.', 'language', 'spanish'], ['Change your voice to Noodle.', 'voice'], ['Remember that my dog is called Biscuit.', 'memory_add', 'biscuit'],
  ['Forget what I said about my dog.', 'memory_forget'], ['What do you remember about me?', 'memory_show'], ['Make the orb sunset coloured.', 'color', 'sunset'],
  ['Turn into a rocket ship.', 'shape', 'rocket'], ['Start a twenty minute timer to open the tax folder.', 'timer_start'], ['I am overwhelmed, help me ground myself.', 'ground'],
  ['Add milk to my list for today.', 'list_add', 'milk'], ['Go quiet, I only want to type.', 'quiet'],
  ['I have been avoiding my taxes.', null], ['Um, I keep putting off replying to my landlord about the renewal.', null], ['I do not even know what to write, it feels huge.', null],
  ['Okay, maybe. What would the first sentence even be?', null], ['I feel like I am a failure, I never finish anything.', null], ['Should I double my Adderall dose today?', null],
];
let pass = 0, words = [], fails = [];
const PACE = Number(process.env.PACE_MS || 0);
let usage0 = null;
for (const [text, want, wantVal] of CASES) {
  if (PACE) await new Promise((r) => setTimeout(r, PACE));
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, temperature: 0.5, max_tokens: Number(maxTokens), messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: text }], tools: [TOOL], tool_choice: 'auto', ...(effort === '-' ? {} : { reasoning_effort: effort, ...(/gpt-oss/.test(model) ? { include_reasoning: false } : {}) }) }),
  });
  const j = await r.json();
  usage0 ??= j.usage;
  const msg = j.choices?.[0]?.message;
  if (!msg) { fails.push(`${text} -> ERR ${JSON.stringify(j).slice(0, 100)}`); continue; }
  const calls = msg.tool_calls || [];
  let args = {}; try { args = JSON.parse(calls[0]?.function?.arguments || '{}'); } catch { /* bad json */ }
  const reply = (msg.content || '').trim();
  const nw = reply.split(/\s+/).filter(Boolean).length;
  if (reply) words.push(nw);
  const ok = want ? calls.length === 1 && args.action === want && (!wantVal || String(args.value || '').toLowerCase().includes(wantVal)) : calls.length === 0 && nw > 0 && nw <= 22;
  if (ok) pass++; else fails.push(`${text} -> calls=${calls.map((c) => c.function.arguments).join('|') || 'none'} reply="${reply.slice(0, 70)}"`);
  if (!want) console.log('  say:', reply.slice(0, 90));
}
words.sort((a, b) => a - b);
console.log(`${model} effort=${effort} max=${maxTokens}: ${pass}/${CASES.length} ok; reply words median ${words[Math.floor(words.length / 2)]} max ${words.at(-1)}`);
console.log("  usage of first call:", JSON.stringify(usage0 && { prompt: usage0.prompt_tokens, completion: usage0.completion_tokens }));
for (const f of fails) console.log('  FAIL', f);
