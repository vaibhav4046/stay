#!/usr/bin/env node
/**
 * Conversation probe: sends lines to the running app's real chat route (real model, tools ON, as a live call does) and prints what
 * Stay would say and which app tool it would call. Use it to see a behaviour before and after a change.
 *
 *   node scripts/voice-e2e/probe-chat.mjs http://localhost:3120 [file.json]
 *
 * file.json: an array of conversations, each an array of user lines (or {role,content}). Default: the lines from the 2 Nov 2026 field test.
 * Label (H8): live-model, typed text. It tests the words, not the voice.
 */
import { readFileSync } from 'node:fs';

const BASE = (process.argv[2] || 'http://localhost:3120').replace(/\/$/, '');
const FILE = process.argv[3];
const FIELD_TEST = [
  ['Hi.', 'Hello.'],
  ['Why are you picking this voice?'],
  ["What the fuck? You're not listening to me."],
  ['Okay, what more can you do, and what is your speciality? Why should I use you and not ChatGPT or Claude?'],
  ["What's your main differentiator?"],
  ['Open Netflix for five minutes.'],
  ['Open Netflix for five minutes.', 'Close it now.'],
  ['Set a five minute timer.'],
  ['I need to reply to my landlord and I keep avoiding it.'],
  ['I am so angry, this is so broken, nothing works.'],
];
const convs = FILE ? JSON.parse(readFileSync(FILE, 'utf8')) : FIELD_TEST;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function turn(messages) {
  let res;
  for (let tries = 0; tries < 4; tries++) {
    res = await fetch(`${BASE}/api/voice/chat`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify({ messages, withTools: true }) });
    if (res.status !== 503) break;
    await sleep(20_000); // the model provider's own limit: wait, then ask again
  }
  const raw = await res.text();
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    const j = JSON.parse(raw);
    return { text: j.message || '', safety: j.safety, tools: [], status: res.status };
  }
  let text = '';
  const calls = new Map();
  for (const m of raw.matchAll(/data: (\{.*\})/g)) {
    const d = JSON.parse(m[1]).choices?.[0]?.delta;
    text += d?.content || '';
    for (const tc of d?.tool_calls || []) {
      const c = calls.get(tc.index) || { name: '', args: '' };
      calls.set(tc.index, { name: tc.function?.name || c.name, args: c.args + (tc.function?.arguments || '') });
    }
  }
  return { text: text.trim(), tools: [...calls.values()].filter((c) => c.name).map((c) => `${c.name}(${c.args})`), status: res.status };
}

const out = [];
for (const lines of convs) {
  const messages = [];
  for (const l of lines) {
    const content = typeof l === 'string' ? l : l.content;
    messages.push({ role: 'user', content });
    const r = await turn(messages);
    messages.push({ role: 'assistant', content: r.text || '(no text)' });
    console.log(`YOU:  ${content}\nSTAY: ${r.text || '(none)'}${r.safety ? ` [safety: ${r.safety}]` : ''}${r.tools.length ? `\n  TOOL: ${r.tools.join(' ')}` : ''}\n`);
    out.push({ you: content, stay: r.text, tools: r.tools, status: r.status });
    await sleep(3500);
  }
  console.log('-----');
}
