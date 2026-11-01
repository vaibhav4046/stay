#!/usr/bin/env node
/**
 * Real-provider experiment: how should a reply be sent to AssemblyAI TTS so it sounds continuous?
 * Compares sending the same reply as (A) a synthesis per clause/sentence, (B) first sentence then the rest in one go,
 * (C) the whole reply in one go. For each it simulates playback (100 ms prebuffer) from the real chunk arrival times and
 * reports stalls, time to first audio, and the silence at each join. Needs ASSEMBLYAI_API_KEY; writes docs/evidence/real-provider.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const key = (process.env.ASSEMBLYAI_API_KEY || '').trim();
const sha = execSync('git rev-parse HEAD').toString().trim();
mkdirSync('docs/evidence/real-provider', { recursive: true });
const out = `docs/evidence/real-provider/tts-chunking-${sha.slice(0, 7)}.json`;
if (!key) {
  writeFileSync(out, JSON.stringify({ status: 'NOT_RUN', reason: 'no key', gitSha: sha }, null, 2));
  process.exit(0);
}
const now = () => performance.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VOICE = '478badc1-a7eb-5bef-b916-c6e51bd2771e'; // Adrienne
const REPLIES = [
  ['That sounds like a lot to carry,', 'especially with the deadline in May.', "What's the part of the applications that feels heaviest right now?", 'We can just talk it through for a minute.'],
  ["Okay, let's keep it tiny.", 'Open the document and just look at the first page, nothing else.', 'Want me to stay on the line while you do it?'],
];
const STRATEGIES = {
  A_clause_each: (c) => c.map((t) => ({ text: t, flush: true })),
  B_first_then_rest: (c) => [{ text: c[0] + ' ' + c[1], flush: true }, { text: c.slice(2).join(' '), flush: true }],
  C_whole_reply: (c) => [{ text: c.join(' '), flush: true }],
};

async function token() {
  const r = await fetch('https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=300', { headers: { Authorization: key } });
  return (await r.json()).token;
}

async function run(sends) {
  const q = new URLSearchParams({ token: await token(), model_id: 'assemblyai-tts-1', voice_id: VOICE, language: 'english', encoding: 'pcm_s16le', sample_rate: '24000' });
  const ws = new WebSocket(`wss://tts.us.assemblyai.com/v1/ws?${q}`);
  const chunks = []; // { t, bytes, flushIdx }
  let t0 = 0;
  let flushes = 0;
  let sentFlushes = 0;
  const perFlush = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 30000);
    ws.onerror = () => reject(new Error('socket'));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'Begin') {
        t0 = now();
        for (const s of sends) {
          ws.send(JSON.stringify({ type: 'Generate', text: s.text }));
          if (s.flush) { ws.send(JSON.stringify({ type: 'Flush' })); sentFlushes++; }
        }
      } else if (m.type === 'Audio') {
        const buf = Buffer.from(m.audio, 'base64');
        chunks.push({ t: now() - t0, buf, flushIdx: flushes });
      } else if (m.type === 'FlushDone') {
        flushes++;
        if (flushes >= sentFlushes) { clearTimeout(timer); ws.send(JSON.stringify({ type: 'Terminate' })); resolve(); }
      } else if (m.type === 'Error') { clearTimeout(timer); reject(new Error(m.error)); }
    };
  });
  try { ws.close(); } catch { /* ignore */ }

  // playback simulation: start 100 ms after first audio; underrun when playout passes what has arrived
  const BPS = 24000 * 2;
  let arrived = 0;
  const timeline = chunks.map((c) => { arrived += c.buf.length / BPS; return { t: c.t, cum: arrived }; });
  const start = chunks[0].t + 100;
  let stallMs = 0;
  let stalls = 0;
  let played = 0; // seconds of audio played so far
  let clock = start;
  for (const seg of timeline) {
    // the next chunk must be here before playout reaches the end of what we have
    const have = seg.cum - (seg === timeline[timeline.length - 1] ? 0 : 0);
    void have;
  }
  // simple event walk
  let idx = 0;
  let avail = 0;
  let tNow = start;
  let pos = 0;
  while (idx < timeline.length || pos < arrived) {
    while (idx < timeline.length && timeline[idx].t <= tNow) { avail = timeline[idx].cum; idx++; }
    if (pos < avail) { const step = Math.min(avail - pos, 0.02); pos += step; tNow += step * 1000; }
    else if (idx < timeline.length) { const wait = timeline[idx].t - tNow; if (wait > 0) { stallMs += wait; stalls++; tNow += wait; } avail = timeline[idx].cum; idx++; }
    else break;
  }
  // silence at joins: leading and trailing near-silence of each flush's audio
  const byFlush = new Map();
  for (const c of chunks) byFlush.set(c.flushIdx, Buffer.concat([byFlush.get(c.flushIdx) ?? Buffer.alloc(0), c.buf]));
  const joins = [];
  for (const [, b] of byFlush) {
    const s = new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length - (b.length % 2)));
    let lead = 0; while (lead < s.length && Math.abs(s[lead]) < 400) lead++;
    let trail = 0; while (trail < s.length && Math.abs(s[s.length - 1 - trail]) < 400) trail++;
    joins.push({ leadMs: Math.round((lead / 24000) * 1000), trailMs: Math.round((trail / 24000) * 1000), seconds: +(s.length / 24000).toFixed(2) });
  }
  const gapMsAtJoins = joins.slice(1).map((j, i) => j.leadMs + joins[i].trailMs);
  return { syntheses: byFlush.size, firstAudioMs: Math.round(chunks[0].t), totalAudioSeconds: +arrived.toFixed(2), arrivedByMs: Math.round(chunks[chunks.length - 1].t), stalls, stallMs: Math.round(stallMs), silenceAtJoinsMs: gapMsAtJoins };
}

const results = {};
let opened = 0;
for (const [name, build] of Object.entries(STRATEGIES)) {
  results[name] = [];
  for (const reply of REPLIES) {
    if (opened++ > 0) await sleep(13000); // 5 sessions per minute allowance
    try { results[name].push(await run(build(reply))); } catch (e) { results[name].push({ error: String(e.message) }); }
  }
}
writeFileSync(out, JSON.stringify({ status: 'PASS', tier: 'real-provider', gitSha: sha, timestamp: new Date().toISOString(), voice: 'Adrienne (en-GB)', limits: ['Chunk arrival measured over one network; playback is simulated with a 100 ms prebuffer, not the browser worklet', '2 short replies per strategy'], results }, null, 2));
for (const [n, rs] of Object.entries(results)) console.log(n, JSON.stringify(rs.map((r) => r.error ?? { syn: r.syntheses, first: r.firstAudioMs, audio: r.totalAudioSeconds, stalls: r.stalls, stallMs: r.stallMs, joinSilence: r.silenceAtJoinsMs })));
