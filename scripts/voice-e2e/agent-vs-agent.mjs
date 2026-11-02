#!/usr/bin/env node
/**
 * Agent-vs-agent conversation test. A language model plays a human persona (tests/fixtures/eval/personas.json) and talks to Stay's real
 * chat route for several turns, with Stay's app tools switched on as in a live call. The transcript is then checked by rules for the
 * failures seen in the 2 Nov 2026 field test: a repeated opening, a canned line, a timer nobody asked for, claiming to have opened or
 * closed something, an unanswered question, a reply too long to speak.
 *
 *   node scripts/voice-e2e/agent-vs-agent.mjs http://localhost:3120 [turns=5]
 *
 * Needs GROQ_API_KEY in .env.local (for the persona) and the app running (for Stay). Label (H8): live-model, typed text; it tests the
 * words and the tool use, not the voice. Raw conversations: docs/evidence/loop/agent-vs-agent-<date>.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const BASE = (process.argv[2] || 'http://localhost:3120').replace(/\/$/, '');
const TURNS = Number(process.argv[3] || 5);
const KEY = (process.env.GROQ_API_KEY || '').trim();
const personas = JSON.parse(readFileSync('tests/fixtures/eval/personas.json', 'utf8')).personas;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (!KEY) { console.log('NOT_RUN: no GROQ_API_KEY for the persona model'); process.exit(0); }

/** the persona: one short spoken line */
async function humanSays(persona, transcript) {
  const messages = [
    { role: 'system', content: `${persona.brief}\nYou are the HUMAN. Reply with only what you say out loud, one or two short sentences, no stage directions, no quotes.` },
    ...transcript.map((t) => ({ role: t.who === 'human' ? 'assistant' : 'user', content: t.text })),
  ];
  for (let tries = 0; tries < 4; tries++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-oss-120b', messages, max_tokens: 80, temperature: 0.9, reasoning_effort: 'low', include_reasoning: false }),
    });
    if (res.status === 429) { await sleep(15_000); continue; }
    const j = await res.json();
    return (j.choices?.[0]?.message?.content || '').trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

/** Stay: its real reply and any tool it would call */
async function stayReplies(history) {
  for (let tries = 0; tries < 4; tries++) {
    const res = await fetch(`${BASE}/api/voice/chat`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ messages: history, withTools: true }) });
    if (res.status === 503) { await sleep(20_000); continue; }
    const raw = await res.text();
    if ((res.headers.get('content-type') || '').includes('application/json')) { const j = JSON.parse(raw); return { text: j.message || '', tools: [], safety: j.safety }; }
    let text = '';
    const calls = new Map();
    for (const m of raw.matchAll(/data: (\{.*\})/g)) {
      const d = JSON.parse(m[1]).choices?.[0]?.delta;
      text += d?.content || '';
      for (const tc of d?.tool_calls || []) { const c = calls.get(tc.index) || { name: '', args: '' }; calls.set(tc.index, { name: tc.function?.name || c.name, args: c.args + (tc.function?.arguments || '') }); }
    }
    return { text: text.trim(), tools: [...calls.values()].filter((c) => c.name).map((c) => `${c.name}(${c.args})`) };
  }
  return { text: '', tools: [], failed: true };
}

const CANNED = /\b(?:i hear you|i hear that|i'?m right here with you|it sounds like|sure thing|hey there|great question|i understand)\b/i;
const TIMER_ASKED = /\b(?:timers?|countdown|stopwatch|pomodoro|focus (?:block|session)|time me|\d+[- ]?min(?:ute)?s?|(?:one|two|three|four|five|ten|fifteen|twenty|thirty)[- ]?min(?:ute)?s?)\b/i;
const CLAIMS_DONE = /\b(?:i(?:'ve| have)? (?:opened|closed|launched|started the netflix)|(?:it'?s|netflix is) (?:open|closed)|done, (?:opened|closed))\b/i;

/** Rule checks on one finished conversation. Each failure is named so it can be read. */
export function score(turns) {
  const fails = [];
  const stay = turns.filter((t) => t.who === 'stay');
  const openers = stay.map((t) => t.text.split(/\s+/).slice(0, 3).join(' ').toLowerCase().replace(/[.,!?]+$/, ''));
  openers.forEach((o, i) => { if (o && openers.indexOf(o) !== i) fails.push(`repeated_opening: "${o}"`); });
  turns.forEach((t, i) => {
    if (t.who !== 'stay') return;
    const said = turns[i - 1]?.text || '';
    if (CANNED.test(t.text)) fails.push(`canned_line: "${t.text.slice(0, 50)}"`);
    if (t.tools.some((c) => /timer_start/.test(c)) && !TIMER_ASKED.test(said)) fails.push(`timer_not_asked: after "${said.slice(0, 40)}"`);
    if (CLAIMS_DONE.test(t.text)) fails.push(`claims_to_have_opened_or_closed: "${t.text.slice(0, 50)}"`);
    if (!t.text && t.tools.length === 0) fails.push('no_reply');
    if (t.text.split(/\s+/).filter(Boolean).length > 70) fails.push(`too_long_to_speak: ${t.text.split(/\s+/).length} words`);
  });
  return fails;
}

const out = [];
for (const p of personas) {
  const turns = [];
  let said = p.opening;
  for (let i = 0; i < TURNS; i++) {
    turns.push({ who: 'human', text: said, tools: [] });
    const history = turns.map((t) => ({ role: t.who === 'human' ? 'user' : 'assistant', content: t.text || '(no reply)' }));
    const r = await stayReplies(history);
    turns.push({ who: 'stay', text: r.text, tools: r.tools });
    console.log(`[${p.id}] YOU:  ${said}\n[${p.id}] STAY: ${r.text || '(none)'}${r.tools.length ? `  TOOL ${r.tools.join(' ')}` : ''}`);
    await sleep(3000);
    said = await humanSays(p, turns);
    if (!said) break;
    await sleep(2000);
  }
  const failures = score(turns);
  console.log(`[${p.id}] ${failures.length ? 'FAIL ' + failures.join(' | ') : 'ok'}\n`);
  out.push({ persona: p.id, turns, failures });
}
const total = out.reduce((n, c) => n + c.failures.length, 0);
const file = `docs/evidence/loop/agent-vs-agent-${new Date().toISOString().slice(0, 10)}.json`;
mkdirSync('docs/evidence/loop', { recursive: true });
writeFileSync(file, JSON.stringify({ labels: ['live-model', 'typed-text', 'persona-model'], base: BASE, at: new Date().toISOString(), turnsPerConversation: TURNS, conversations: out.length, failures: total, results: out }, null, 2));
console.log(`agent-vs-agent: ${out.length} conversations, ${total} rule failures. ${file}`);
process.exit(total === 0 ? 0 : 1);
