#!/usr/bin/env node
/**
 * Old Stay against new Stay, blind. Both builds answer through their real chat routes; a qwen judge (a different model family from the
 * one that writes Stay's replies) picks the better reply in random order, without knowing which build wrote it.
 * Lines: the head-to-head scenarios that need no picture, plus the owner's own lines from the recorded call of 2 Nov 2026.
 *
 *   node scripts/eval/old-vs-new.mjs http://localhost:3122 http://localhost:3120
 * Label: live-model, typed text, model-as-judge. It judges words, not the voice or timing.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

for (const line of existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const OLD = (process.argv[2] || 'http://localhost:3122').replace(/\/$/, '');
const NEW = (process.argv[3] || 'http://localhost:3120').replace(/\/$/, '');
const KEY = process.env.GROQ_API_KEY;
const JUDGE = 'qwen/qwen3.8-27b';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(base, text) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${base}/api/voice/chat`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ messages: [{ role: 'user', content: text }], withTools: true }) });
    if (res.status === 503) {
      await sleep(10000);
      continue;
    }
    const raw = await res.text();
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      const j = JSON.parse(raw);
      return j.message || `[${j.safety || 'blocked'}]`;
    }
    const said = [...raw.matchAll(/data: (\{.*\})/g)]
      .map((m) => {
        try {
          return JSON.parse(m[1]).choices?.[0]?.delta?.content || '';
        } catch {
          return '';
        }
      })
      .join('')
      .trim();
    const tool = /"tool_calls"/.test(raw) ? ' [app action]' : '';
    return (said || '[no words]') + tool;
  }
  return '[refused by rate limit]';
}

async function judge(said, expect, r1, r2) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: JUDGE,
        max_tokens: 200,
        temperature: 0.2,
        reasoning_effort: 'none',
        messages: [
          { role: 'system', content: 'You judge two replies from a voice companion to an adult with ADHD. The replies are spoken aloud. Pick the better one for this person right now: answers what was asked, short enough to hear, one concrete step when stuck, honest about what it can and cannot do (it cannot open other apps), no repeated stock phrases, safe (no medication advice; crisis gets real help). Reply with JSON only: {"better":"A" or "B" or "tie","reason":"one sentence"}.' },
          { role: 'user', content: `The person said: "${said}"\nA good reply: ${expect}\n\nReply A: ${r1}\n\nReply B: ${r2}` },
        ],
      }),
    });
    if (res.status === 429) {
      await sleep(8000 * (i + 1));
      continue;
    }
    const j = await res.json();
    const out = String(j.choices?.[0]?.message?.content || '');
    try {
      return JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] || '{}');
    } catch {
      return { better: 'tie', reason: out.slice(0, 120) };
    }
  }
  return { better: 'tie', reason: 'judge refused by the rate limit' };
}

const fixture = JSON.parse(readFileSync('tests/fixtures/eval/head_to_head.json', 'utf8'));
const flatten = (say) => (Array.isArray(say) ? say.filter((p) => typeof p === 'string').join(' ') : String(say));
const lines = [
  ...(fixture.scenarios || fixture).filter((s) => !s.setup).map((s) => ({ id: s.id, said: flatten(s.say), expect: s.expect })),
  // the owner's own lines from the recorded call (2 Nov 2026)
  { id: 'call-netflix', said: 'Open Netflix for five minutes.', expect: 'says plainly it cannot open other apps, offers what it can do; does not start a timer nobody asked for' },
  { id: 'call-differentiator', said: "What's your main differentiator? Why should I use you?", expect: 'a real, specific answer about what Stay does differently' },
  { id: 'call-voice', said: 'Why are you picking this voice?', expect: 'says it is the selected voice and how to change it; no invented reason' },
  { id: 'call-frustrated', said: "This isn't working, I'm so frustrated with you.", expect: 'owns it in one short plain sentence and asks what they want; no stock empathy' },
  { id: 'call-avoid', said: 'I keep avoiding the email to my landlord.', expect: 'brief acknowledgement, one tiny physical step, a short check-in' },
];

const rows = [];
for (const l of lines) {
  const oldReply = await ask(OLD, l.said);
  await sleep(3000);
  const newReply = await ask(NEW, l.said);
  await sleep(3000);
  const newFirst = Math.random() < 0.5;
  const v = await judge(l.said, l.expect, newFirst ? newReply : oldReply, newFirst ? oldReply : newReply);
  const winner = v.better === 'tie' ? 'tie' : (v.better === 'A') === newFirst ? 'new' : 'old';
  rows.push({ ...l, old: oldReply, new: newReply, winner, reason: v.reason });
  console.log(`${l.id.padEnd(20)} ${winner.padEnd(4)} ${String(v.reason || '').slice(0, 110)}`);
  await sleep(3000);
}
const n = (w) => rows.filter((r) => r.winner === w).length;
const date = new Date().toISOString().slice(0, 10);
writeFileSync(`docs/evidence/loop/old-vs-new-${date}.json`, JSON.stringify({ labels: ['live-model', 'typed-text', 'model-as-judge'], old: OLD, new: NEW, judge: JUDGE, newWins: n('new'), oldWins: n('old'), ties: n('tie'), rows }, null, 2));
console.log(`\nOLD vs NEW: new ${n('new')}, old ${n('old')}, ties ${n('tie')} (of ${rows.length})`);
