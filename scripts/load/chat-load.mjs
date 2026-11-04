#!/usr/bin/env node
/**
 * Load test of Stay's own server tier: many simultaneous /api/voice/chat turns against a server whose model is the local stand-in
 * (scripts/voice-e2e/stub-llm.mjs, fixed delay), so the numbers are about Stay's routes, not about any provider's quota or speed.
 *
 *   node scripts/voice-e2e/stub-llm.mjs 3199
 *   STAY_TEST_LLM_BASE=http://127.0.0.1:3199 GROQ_API_KEY=stub GROQ_API_KEYS=stub npx next start -p 3122
 *   node scripts/load/chat-load.mjs http://localhost:3122 --concurrency 200 --seconds 30
 *
 * Each virtual user sends one turn after another with its own address (x-forwarded-for), reads the whole streamed answer, and waits a
 * short think time. Reports requests, rate, status codes, and total-time percentiles. Label results "stand-in model, one machine".
 */
const args = process.argv.slice(2);
const BASE = (args[0] || 'http://localhost:3122').replace(/\/$/, '');
const opt = (n, d) => (args.includes(n) ? Number(args[args.indexOf(n) + 1]) : d);
const CONCURRENCY = opt('--concurrency', 100);
const SECONDS = opt('--seconds', 30);
const THINK_MS = opt('--think-ms', 300);

const LINES = ['I do not know where to start.', 'Okay what is the first step?', 'And after that?', 'Why would I use you and not a chatbot?', 'I keep scrolling and I cannot stop.'];
const ip = (i) => `10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`;
const latencies = [];
const statuses = new Map();
let sent = 0;
const t0 = Date.now();
const deadline = t0 + SECONDS * 1000;

async function user(i) {
  const history = [];
  while (Date.now() < deadline) {
    history.push({ role: 'user', content: LINES[(i + history.length) % LINES.length] });
    const start = performance.now();
    let status = 0;
    try {
      const res = await fetch(`${BASE}/api/voice/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(i + 1) },
        body: JSON.stringify({ messages: history.slice(-6), withTools: true, context: { language: 'english', notes: [], recall: [] } }),
      });
      status = res.status;
      const text = await res.text(); // the whole stream
      if (res.ok) history.push({ role: 'assistant', content: (text.match(/"content":"([^"]*)"/g) || []).map((m) => m.slice(11, -1)).join('').slice(0, 200) || 'Okay.' });
    } catch {
      status = -1;
    }
    sent++;
    latencies.push(performance.now() - start);
    statuses.set(status, (statuses.get(status) || 0) + 1);
    await new Promise((r) => setTimeout(r, THINK_MS));
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => user(i)));
const secs = (Date.now() - t0) / 1000;
latencies.sort((a, b) => a - b);
const q = (p) => Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0);
console.log(JSON.stringify({
  label: 'stand-in model, one machine',
  target: BASE,
  concurrentUsers: CONCURRENCY,
  seconds: Math.round(secs),
  requests: sent,
  perSecond: Math.round(sent / secs),
  status: Object.fromEntries([...statuses.entries()].sort()),
  totalMs: { p50: q(0.5), p95: q(0.95), p99: q(0.99), max: q(1) },
}, null, 2));
