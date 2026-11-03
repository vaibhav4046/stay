#!/usr/bin/env node
/**
 * A stand-in for the chat model, for soak runs that test the voice pipeline (speech in, speech out, reconnects, memory over time) without
 * spending the free-tier token budget. It speaks the OpenAI-compatible streaming protocol the server already uses, answers in short plain
 * spoken sentences, calls the app tool when the words plainly ask for one and the tool is offered, and confirms after a tool result.
 * Replies are canned: this tests plumbing and timing, never the quality of the real model. Label any run that uses it as such.
 *
 *   node scripts/voice-e2e/stub-llm.mjs 3199
 *   STAY_TEST_LLM_BASE=http://127.0.0.1:3199 GROQ_API_KEY=stub GROQ_API_KEYS=stub npx next start -p 3122
 */
import http from 'node:http';

const PORT = Number(process.argv[2] || 3199);
const FIRST_TOKEN_MS = 260;
const WORD_MS = 22;

const ENGLISH = [
  'Pick one small thing and do only that for two minutes.',
  'That sounds heavy. Name the first thing you could touch, and start there.',
  'Open the file and read the first line. Nothing else yet.',
  'Good. Stay with it for one more minute, then tell me how it feels.',
  'It is fine that it was messy. A messy start still counts.',
  'What is the smallest next step you could take right now?',
  'Put your phone face down for five minutes. I will be here.',
  'You do not need a plan. You need a first move. What is one?',
  'Take a breath. Then write one sentence, any sentence.',
  'Noted. Let us keep it to one thing at a time.',
  'That is a fair question. The short answer is yes.',
  'Stand up, drink some water, then come back and tell me what you see.',
];
const SPANISH = [
  'Empecemos con un paso pequeño. Abre el documento y lee la primera línea.',
  'Está bien no saber por dónde empezar. Elige una sola cosa para hoy.',
  'Muy bien. Ahora respira y escribe una sola frase.',
  'Entiendo. Hagamos solo un paso, el más pequeño que se te ocurra.',
];
const HINDI = [
  'ठीक है। बस एक छोटा सा कदम उठाइए, ईमेल का पहला वाक्य लिखिए।',
  'कोई बात नहीं। पहले एक गहरी सांस लीजिए, फिर एक ही काम चुनिए।',
];

const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const lastOf = (msgs, role) => [...msgs].reverse().find((m) => m.role === role);

const offered = (body) => new Set(body.tools?.[0]?.function?.parameters?.properties?.action?.enum ?? []);

/** The one tool call these words plainly ask for, if the tool is offered with that action. */
function toolFor(text, actions) {
  const t = text.toLowerCase();
  const pick = (action, value) => (actions.has(action) ? { action, value } : null);
  let m;
  if ((m = /remember (?:that )?(.+)/.exec(t))) return pick('memory_add', m[1].replace(/[.!?]+$/, ''));
  if ((m = /add (.+?) to my list/.exec(t))) return pick('list_add', m[1]);
  if ((m = /park (?:it|that|this)[:,]? ?(.*)/.exec(t))) return pick('park', m[1].replace(/[.!?]+$/, '') || 'a thought');
  if (/\b(open|show)\b.*\b(history)\b/.test(t)) return pick('open', 'history');
  if (/\b(open|show)\b.*\b(memory)\b/.test(t)) return pick('open', 'memory');
  if (/\b(open|show)\b.*\b(report)\b/.test(t)) return pick('open', 'report');
  if (/\b(open|show)\b.*\bsettings\b/.test(t)) return pick('open', 'settings');
  if (/\btimer\b/.test(t)) return pick('timer_start', '5');
  return null;
}

function replyFor(text) {
  if (/[ऀ-ॿ]/.test(text)) return HINDI[hash(text) % HINDI.length];
  if (/[¿¡ñ]|\b(?:no sé|empezar|declaración|impuestos|por dónde|necesito|quiero|hola|gracias)\b/i.test(text)) return SPANISH[hash(text) % SPANISH.length];
  return ENGLISH[hash(text) % ENGLISH.length];
}

const chunk = (delta, extra = {}) => `data: ${JSON.stringify({ id: 'stub', object: 'chat.completion.chunk', choices: [{ index: 0, delta, finish_reason: null }], ...extra })}\n\n`;

http
  .createServer(async (req, res) => {
    if (req.method !== 'POST' || !req.url.endsWith('/chat/completions')) {
      res.writeHead(404).end();
      return;
    }
    let raw = '';
    for await (const c of req) raw += c;
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      res.writeHead(400).end('{}');
      return;
    }
    const msgs = body.messages ?? [];
    const lastUser = lastOf(msgs, 'user');
    const text = typeof lastUser?.content === 'string' ? lastUser.content : '';
    const afterTool = msgs.at(-1)?.role === 'tool';
    res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' });
    await new Promise((r) => setTimeout(r, FIRST_TOKEN_MS));
    const call = !afterTool && body.tools?.length ? toolFor(text, offered(body)) : null;
    if (call) {
      const args = JSON.stringify(call);
      res.write(chunk({ role: 'assistant', tool_calls: [{ index: 0, id: `stub-${Date.now()}`, type: 'function', function: { name: 'app', arguments: args } }] }));
    } else {
      const reply = afterTool ? 'Done. What is next?' : replyFor(text);
      for (const w of reply.split(/(?<=\s)/)) {
        res.write(chunk({ content: w }));
        await new Promise((r) => setTimeout(r, WORD_MS));
      }
    }
    res.write(chunk({}, { usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }).replace('"finish_reason":null', '"finish_reason":"stop"'));
    res.write('data: [DONE]\n\n');
    res.end();
  })
  .listen(PORT, '127.0.0.1', () => console.log(`stub model on http://127.0.0.1:${PORT}`));
