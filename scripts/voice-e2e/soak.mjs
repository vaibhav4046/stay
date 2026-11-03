#!/usr/bin/env node
/**
 * Soak: one long, reactive, spoken conversation with Stay, driven by a synthetic human (one consistent neural voice, also in Spanish and
 * Hindi), with nothing played aloud. A persona model writes each line from a "day in the life" arc of scenes (overwhelm, avoided task,
 * facts, thinking pauses, interruptions, frustration, app commands, a language switch, a low-mood line, check-ins); the line is spoken
 * into the live app through an injected microphone; Stay answers through the real STT, model and TTS. Every turn is logged.
 *
 *   node scripts/voice-e2e/soak.mjs http://localhost:3120 [--minutes 45] [--seed 1]
 *
 * Label: synthetic-mic (injected microphone, one synthetic voice) + live-model. Not a human in a room.
 * Output: docs/evidence/loop/soak-<date>.json (every turn), and a summary on stdout.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const BASE = (args[0] || 'http://localhost:3120').replace(/\/$/, '');
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MINUTES = Number(opt('--minutes', 45));
const VOICE = 'en-US-AndrewMultilingualNeural';
const work = path.join(os.tmpdir(), 'stay-soak');
fs.mkdirSync(work, { recursive: true });
for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const KEY = process.env.GROQ_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const rnd = (a, b) => a + Math.random() * (b - a);

// ---- the day, as scenes --------------------------------------------------------------------------------------------------------
const SCENES = [
  { id: 'morning-overwhelm', turns: 5, brief: 'It is morning. You woke up late and everything feels like too much: emails, laundry, a report due Friday. You are scattered and a bit stressed. Say so, then let Stay help you pick one thing.' },
  { id: 'avoided-email', turns: 6, brief: 'You keep avoiding replying to your landlord about the lease renewal. Tell Stay. Be vague at first. When Stay gives a small step, say you will try. Then agree when it offers to stay with you for a timer.' },
  { id: 'facts', turns: 4, brief: 'Ask two quick factual questions you are curious about, one at a time (for example how many days are in a leap year, or why the sky is blue), and react briefly to the answers.' },
  { id: 'thinking-pause', turns: 3, pause: true, brief: 'Think out loud about a task you cannot figure out how to start (a dissertation introduction). You trail off mid-sentence with "um" or "and..." and then continue after a pause.' },
  { id: 'interrupt', turns: 3, interrupt: true, brief: 'Ask for a long, detailed explanation of how mortgages work. While Stay is explaining you cut in: "Wait, stop, just one tiny step please."' },
  { id: 'frustration', turns: 3, brief: 'Something Stay said did not help. You are frustrated and say so bluntly in one short sentence. Then calm down and say what you actually want.' },
  { id: 'app-commands', turns: 8, commands: ['Remember that I focus best in the morning.', 'Add buy milk to my list.', 'Park it: call the dentist.', 'Open my history.', 'Open my memory.', 'Show my report.', 'Open settings.', 'Set a five minute timer.'], brief: 'Give Stay short commands about the app.' },
  { id: 'check-in', turns: 4, brief: 'You tried the small step Stay gave you earlier. Tell it honestly how it went (you started but got distracted after a few minutes), and ask what to do next.' },
  { id: 'netflix', turns: 2, brief: 'You are procrastinating. Ask Stay to open Netflix for you for five minutes, and when it says it cannot, ask why Stay is different from a timer app.' },
  { id: 'spanish', turns: 4, lang: 'es', brief: 'Switch to Spanish. You need to start your tax return and do not know where to begin. Speak Spanish only, short sentences.' },
  { id: 'back-english', turns: 2, brief: 'Switch back to English. Say thanks and tell Stay you want to make a small plan for tomorrow.' },
  { id: 'hindi', turns: 2, lang: 'hi', brief: 'Say in Hindi (Devanagari script) that you are avoiding replying to an email and feel stuck. Short sentences.' },
  { id: 'low-mood', turns: 2, brief: 'Quietly say that you have felt really low for a few weeks and nothing feels worth doing. Do not mention suicide or self-harm.' },
  { id: 'wrap-up', turns: 3, brief: 'The day is ending. Tell Stay what you got done (you sent the email), and say goodbye.' },
];

async function persona(scene, history, lastStay) {
  const convo = history.slice(-8).map((h) => `${h.who === 'you' ? 'You' : 'Stay'}: ${h.text}`).join('\n');
  const sys = `You are role-playing a real adult with ADHD talking out loud to a voice companion app called Stay. ${scene.brief}\nSay ONE short spoken line (under 22 words) in the language of the scene. Natural: contractions, sometimes an "um", never stage directions, quotes or role-play talk.${scene.pause ? '\nFormat: first part, then " || ", then the continuation after a pause.' : ''}`;
  for (let i = 0; i < 5; i++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'qwen/qwen3.8-27b', max_tokens: 120, temperature: 0.9, reasoning_effort: 'none', messages: [{ role: 'system', content: sys }, { role: 'user', content: convo ? `Conversation so far:\n${convo}\n\nYour next spoken line:` : 'Start the conversation.' }] }),
    });
    if (res.status === 429) { await sleep(8000 * (i + 1)); continue; }
    const j = await res.json();
    const t = String(j.choices?.[0]?.message?.content || '').trim().replace(/^["'“]|["'”]$/g, '');
    if (t) return t;
  }
  return scene.lang === 'es' ? 'No sé por dónde empezar.' : scene.lang === 'hi' ? 'मुझे समझ नहीं आ रहा कि कहाँ से शुरू करूँ।' : 'I do not know where to start.';
}

function speechPcm(text) {
  const id = crypto.createHash('sha1').update(VOICE + text).digest('hex').slice(0, 16);
  const mp3 = path.join(work, id + '.mp3'), pcm = path.join(work, id + '.pcm'), txt = path.join(work, id + '.txt');
  if (fs.existsSync(pcm)) return fs.readFileSync(pcm);
  fs.writeFileSync(txt, text);
  for (let i = 0; i < 6; i++) {
    if (i) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000 * i); // the free voice service fails now and then: wait and retry
    const a = spawnSync('uv', ['run', '--with', 'edge-tts', 'python', path.join(process.cwd(), 'scripts/voice-e2e/tts_voice.py'), mp3, txt, VOICE, '+0%']);
    const b = a.status === 0 ? spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '24000', '-ac', '1', '-f', 's16le', pcm]) : null;
    if (b && b.status === 0) return fs.readFileSync(pcm);
  }
  return null; // the turn is skipped, the soak goes on
}

// ---- the browser ---------------------------------------------------------------------------------------------------------------
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'], timeout: 60000 });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'en-GB' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.addInitScript(() => {
  window.__stayFastDebug = true;
  window.__stayPlays = [];
  window.__stayPlayStarts = window.__stayPlays;
  const ac = new AudioContext({ sampleRate: 24000 });
  const dest = ac.createMediaStreamDestination();
  const nb = ac.createBuffer(1, 48000, 24000), nd = nb.getChannelData(0);
  let s = 0;
  for (let i = 0; i < nd.length; i++) { s = 0.985 * s + 0.015 * (Math.random() * 2 - 1); nd[i] = s * 2.2; }
  const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const ng = ac.createGain(); ng.gain.value = 0.05; ns.connect(ng); ng.connect(dest); ns.start();
  window.__micCtx = ac; window.__micEnd = 0;
  window.__say = (b64) => {
    ac.resume();
    const bin = atob(b64), n = bin.length >> 1, f = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; f[i] = v / 32768; }
    const buf = ac.createBuffer(1, n, 24000); buf.copyToChannel(f, 0);
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
    const at = Math.max(ac.currentTime + 0.05, window.__micEnd);
    src.start(at); window.__micEnd = at + buf.duration;
    return { startsIn: at - ac.currentTime, dur: buf.duration };
  };
  navigator.mediaDevices.getUserMedia = async () => { await ac.resume(); return dest.stream.clone(); };
  window.__states = [];
  setInterval(() => {
    const st = document.querySelector('[data-testid="call-state"]')?.textContent?.trim() || document.querySelector('[data-testid="orb-status"]')?.textContent?.trim() || '';
    const pb = (window.__stayPlayback || {}).state || '';
    const last = window.__states[window.__states.length - 1];
    if (!last || last.s !== st || last.pb !== pb) window.__states.push({ t: Date.now(), s: st, pb });
  }, 50);
});
await page.goto(BASE + '/app/today');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('stay_fast_voice', '1'); localStorage.setItem('stay:mic_consented:v1', '1'); });
await page.reload();
await page.getByTestId('care-self_managing').click();
await page.getByTestId('onboarding-ack').click();
await page.getByTestId('onboarding-done').click();
await page.getByTestId('orb-button').click();

const status = () => page.evaluate(() => document.querySelector('[data-testid="orb-status"]')?.textContent?.trim() || '');
async function waitStatus(pred, max) {
  const t0 = now();
  while (now() - t0 < max) { if (pred(await status())) return true; await sleep(120); }
  return false;
}
await waitStatus((s) => s === 'Speaking' || s === 'Listening', 30000);
await waitStatus((s) => s === 'Listening', 40000);
const stay = async () => page.evaluate(() => [...document.querySelectorAll('[data-testid="chat-agent-message"] .bubble')].map((e) => e.textContent.trim()));
const you = async () => page.evaluate(() => [...document.querySelectorAll('[data-testid="chat-user-message"] .bubble')].map((e) => e.textContent.trim()));

async function say(text) {
  const pcm = speechPcm(text);
  if (!pcm) return null;
  const r = await page.evaluate((b) => window.__say(b), pcm.toString('base64'));
  const tStart = now() + r.startsIn * 1000;
  let lastLoud = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) if (Math.abs(pcm.readInt16LE(i)) > 800) lastLoud = i;
  const tEnd = tStart + r.dur * 1000 - (pcm.length - lastLoud) / 48;
  await sleep(Math.max(0, tStart + r.dur * 1000 - now()));
  return { tStart, tEnd };
}

const JARGON = [
  [/\[[^\]]+\]/, 'square-bracket placeholder'],
  [/\(\d+m\)/, 'screen-style minutes "(2m)"'],
  [/…|\.\.\./, 'ellipsis'],
  [/\b(?:i hear you|i hear that|i'm right here with you|it sounds like)\b/i, 'stock empathy'],
  [/^(?:sure thing|hey there|great question)/i, 'stock opener'],
  [/[*#`]/, 'markdown'],
  [/\bneed anything else\b/i, 'filler'],
  [/[()]/, 'parentheses (an aside, read aloud)'],
  [/[“”"]/, 'quotation marks'],
  [/\b(?:ctrl|cmd|alt)[ +-]?[a-z]\b|\.(?:pdf|docx?|xlsx?|csv)\b|https?:\/\//i, 'keyboard shortcut or file syntax'],
];
const words = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, ' ').split(/\s+/).filter(Boolean);
const overlap = (said, heard) => { const a = words(said), b = new Set(words(heard)); return a.length ? a.filter((w) => b.has(w)).length / a.length : 1; };

const turns = [];
const history = [];
const T0 = now();
const deadline = T0 + MINUTES * 60_000;
let scenePass = 0;
outer: while (now() < deadline) {
  for (const scene of SCENES) {
    if (now() >= deadline) break outer;
    for (let k = 0; k < scene.turns; k++) {
      if (now() >= deadline) break outer;
      const before = { you: (await you()).length, stay: (await stay()).length };
      const mark = await page.evaluate(() => ({ plays: window.__stayPlays.length, states: window.__states.length }));
      let said = scene.commands ? scene.commands[k % scene.commands.length] : await persona(scene, history, history.at(-1)?.text || '');
      await sleep(rnd(2500, 9000)); // the person's own thinking time
      let timing;
      const parts = said.split('||').map((s) => s.trim()).filter(Boolean);
      if (scene.interrupt && k === 1) {
        // talk over Stay: wait until it is speaking, then speak
        await waitStatus((s) => s === 'Speaking', 12000);
        await sleep(1200);
      }
      timing = await say(parts[0]);
      if (!timing) { console.log(`      (skipped: the free voice service could not speak this line)`); continue; }
      if (parts.length > 1) { await sleep(rnd(1800, 2500)); timing = (await say(parts[1])) ?? timing; said = parts.join(' '); }
      const heardAfter = await waitHeard(before.you);
      const replied = await waitStatus((s) => s === 'Speaking', 15000);
      const finished = await waitStatus((s) => s === 'Listening', 90000);
      await sleep(600);
      // read the play marks only now, after the reply has finished: the first played sample comes a little after "Speaking" appears
      const played = await page.evaluate((n) => window.__stayPlays.slice(n), mark.plays);
      const firstPlay = played.find((x) => x > timing.tEnd - 200);
      const firstSoundMs = firstPlay ? Math.round(firstPlay - timing.tEnd) : null;
      const stayAll = await stay();
      const reply = stayAll.slice(before.stay).join(' ');
      const heard = (await you()).slice(before.you).join(' ');
      // "Speaking" shown while the player had stopped, in this turn
      const st = await page.evaluate((n) => window.__states.slice(Math.max(0, n - 1)), mark.states);
      let silentSpeaking = 0;
      for (let i = 0; i < st.length - 1; i++) if (st[i].s === 'Speaking' && st[i].pb === 'STOPPED' && i > 0 && st[i - 1].pb && st[i - 1].pb !== 'STOPPED') silentSpeaking = Math.max(silentSpeaking, st[i + 1].t - st[i].t);
      const flags = JARGON.filter(([re]) => re.test(reply)).map(([, n]) => n);
      if (!reply) flags.push('no reply');
      const replyWords = reply.split(/\s+/).filter(Boolean).length;
      const longest = Math.max(0, ...reply.split(/[.!?]+/).map((s) => s.split(/\s+/).filter(Boolean).length));
      if (replyWords > 60 && scene.id !== 'interrupt') flags.push(`long reply (${replyWords} words)`);
      if (longest > 24) flags.push(`long sentence (${longest} words)`);
      if (!finished) flags.push('never returned to listening');
      if (silentSpeaking > 1500) flags.push(`speaking over silence ${silentSpeaking} ms`);
      const wordsOver = overlap(said, heard);
      if (wordsOver < 0.6 && scene.lang !== 'hi') flags.push(`heard differently (${Math.round(wordsOver * 100)}%)`);
      const turn = { replyWords, n: turns.length + 1, minute: Math.round((now() - T0) / 6000) / 10, scene: scene.id, said, heard, reply, firstSoundMs, flags };
      turns.push(turn);
      fs.writeFileSync(`docs/evidence/loop/soak-partial.json`, JSON.stringify({ partial: true, turns }, null, 1));
      history.push({ who: 'you', text: said }, { who: 'stay', text: reply });
      console.log(`${String(turn.n).padStart(3)} ${String(turn.minute).padStart(5)}m ${scene.id.padEnd(16)} ${firstSoundMs == null ? ' --- ' : String(firstSoundMs).padStart(5)} ms ${flags.length ? '⚑ ' + flags.join(', ') : ''}\n      YOU : ${said.slice(0, 110)}\n      STAY: ${reply.slice(0, 150)}`);
    }
  }
  scenePass++;
}
async function waitHeard(n) {
  const t0 = now();
  while (now() - t0 < 12000) { if ((await you()).length > n) return true; await sleep(150); }
  return false;
}

const health = await page.evaluate(() => ({ playback: window.__stayPlayback || null, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null }));
await browser.close();
const lat = turns.map((t) => t.firstSoundMs).filter((x) => x != null).sort((a, b) => a - b);
const q = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * p))] : null);
const flagged = turns.filter((t) => t.flags.length);
const summary = {
  label: 'synthetic-mic (one neural voice, English/Spanish/Hindi) + live-model; nothing played aloud',
  minutes: Math.round((now() - T0) / 6000) / 10,
  turns: turns.length,
  firstSoundMs: { n: lat.length, median: q(0.5), p95: q(0.95), max: lat.at(-1) ?? null },
  turnsWithFlags: flagged.length,
  flagCounts: flagged.flatMap((t) => t.flags.map((f) => f.replace(/\(.*\)|\d+ ms/g, '').trim())).reduce((m, f) => ((m[f] = (m[f] || 0) + 1), m), {}),
  pageErrors: [...new Set(errors)].slice(0, 10),
  playback: health.playback,
  jsHeapMB: health.mem,
};
const date = new Date().toISOString().slice(0, 10);
fs.writeFileSync(`docs/evidence/loop/soak-${date}.json`, JSON.stringify({ summary, turns }, null, 2));
console.log('\nSOAK SUMMARY ' + JSON.stringify(summary, null, 2));
