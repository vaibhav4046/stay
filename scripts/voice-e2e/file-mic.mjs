#!/usr/bin/env node
/**
 * Microphone test with nothing played out loud. Chromium's own audio capture reads a WAV file as the microphone
 * (--use-file-for-fake-audio-capture), so the speech goes through the browser's real capture path (device, echo cancellation, noise
 * suppression, resampling) into the live app, AssemblyAI and the model. Stay's voice is muted. What it is not: a room, a human voice,
 * or a real microphone's noise. Label: file-mic (capture pipeline) + live-model.
 *
 * The file is a fixed script: lines with gaps, a thinking pause, and an interruption spoken while Stay is still answering. Times are
 * read from the app's own marks: the microphone level (end of each spoken line) and the first played sample of each reply.
 *
 *   node scripts/voice-e2e/file-mic.mjs http://localhost:3120
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const BASE = (process.argv[2] || 'http://localhost:3120').replace(/\/$/, '');
const work = path.join(os.tmpdir(), 'stay-file-mic');
fs.mkdirSync(work, { recursive: true });
const RATE = 24000;

function speech(text, voice = 'en-GB-RyanNeural') {
  const id = crypto.createHash('sha1').update(voice + text).digest('hex').slice(0, 16);
  const mp3 = path.join(work, id + '.mp3'), pcm = path.join(work, id + '.pcm'), txt = path.join(work, id + '.txt');
  if (!fs.existsSync(pcm)) {
    fs.writeFileSync(txt, text);
    const a = spawnSync('uv', ['run', '--with', 'edge-tts', 'python', path.join(process.cwd(), 'scripts/voice-e2e/tts_voice.py'), mp3, txt, voice, '+0%']);
    const b = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', String(RATE), '-ac', '1', '-f', 's16le', pcm]);
    if (a.status !== 0 || b.status !== 0) throw new Error('tts failed: ' + text);
  }
  return fs.readFileSync(pcm);
}
const silence = (s) => Buffer.alloc(Math.round(s * RATE) * 2);

// the script: [what is said, seconds of silence after it]
const SCRIPT = [
  { gap: 12 }, // the greeting plays first
  { say: 'Um, I keep putting off replying to my landlord about the renewal.', gap: 13, kind: 'task' },
  { say: 'What is the capital of Australia?', gap: 9, kind: 'question' },
  { say: 'So I need to, um, send that email and, uh', gap: 2.3, kind: 'pause-start' },
  { say: 'and I keep thinking about how to start it.', gap: 13, kind: 'pause-end' },
  { say: 'Can you give me a really detailed plan for my whole week please.', gap: 3.2, kind: 'long-ask' },
  { say: 'Wait, stop, just one tiny step please.', gap: 12, kind: 'interrupt' },
  { say: 'Hola, necesito empezar mi declaración de impuestos y no sé por dónde empezar.', voice: 'es-ES-AlvaroNeural', gap: 13, kind: 'spanish' },
];
const parts = [];
const lines = [];
let t = 0;
for (const s of SCRIPT) {
  if (s.say) {
    const p = speech(s.say, s.voice);
    lines.push({ ...s, startS: t, endS: t + p.length / 2 / RATE });
    parts.push(p);
    t += p.length / 2 / RATE;
  }
  parts.push(silence(s.gap));
  t += s.gap;
}
const pcm = Buffer.concat(parts);
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32);
h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
const wavPath = path.join(work, 'script.wav');
fs.writeFileSync(wavPath, Buffer.concat([h, pcm]));
console.log(`script: ${lines.length} lines, ${t.toFixed(1)} s of audio`);

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wavPath}%noloop`, '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, locale: 'en-GB', permissions: ['microphone'] });
const page = await ctx.newPage();
await page.addInitScript(() => {
  window.__stayFastDebug = true;
  window.__stayPlays = [];
  window.__stayPlayStarts = window.__stayPlays;
});
await page.goto(`${BASE}/app/today`);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('stay_fast_voice', '1'); localStorage.setItem('stay:mic_consented:v1', '1'); });
await page.reload();
await page.getByTestId('care-self_managing').click();
await page.getByTestId('onboarding-ack').click();
await page.getByTestId('onboarding-done').click();
await page.getByTestId('orb-button').click();
await page.waitForTimeout((t + 15) * 1000); // the whole script plays, plus time for the last reply

const data = await page.evaluate(() => ({
  loud: (window.__stayLoud || []).slice(),
  plays: (window.__stayPlayStarts || []).slice(),
  ducks: (window.__stayDucks || []).slice(),
  heard: [...document.querySelectorAll('[data-testid="chat-user-message"] .bubble')].map((e) => e.textContent.trim()),
  said: [...document.querySelectorAll('[data-testid="chat-agent-message"] .bubble')].map((e) => e.textContent.trim()),
}));
await browser.close();

// the microphone's loud marks, grouped into spoken lines (a gap of 700 ms or more ends a line)
const segs = [];
for (const x of data.loud) {
  const last = segs[segs.length - 1];
  if (last && x - last.end < 700) last.end = x;
  else segs.push({ start: x, end: x });
}
const spoken = segs.filter((s) => s.end - s.start > 400);
console.log(`microphone heard ${spoken.length} spoken stretches (the script has ${lines.length} lines)`);
const replyMs = [];
for (const s of spoken) {
  const p = data.plays.find((x) => x > s.end);
  const next = spoken.find((o) => o.start > s.end);
  if (p && (!next || p < next.start)) replyMs.push(p - s.end);
}
replyMs.sort((a, b) => a - b);
const med = replyMs.length ? replyMs[Math.floor(replyMs.length / 2)] : null;
// spoken stretches match the script's lines one to one when the counts agree; otherwise the per-line checks are not made
const byKind = (k) => (spoken.length === lines.length ? spoken[lines.findIndex((l) => l.kind === k)] : undefined);
const pauseStart = byKind('pause-start'), pauseEnd = byKind('pause-end');
const talkedIntoPause = pauseStart && pauseEnd ? data.plays.some((x) => x > pauseStart.end + 100 && x < pauseEnd.start) : null;
const interrupt = byKind('interrupt');
const duck = interrupt ? data.ducks.find((x) => x >= interrupt.start - 100) : null;
const result = {
  label: 'file-mic (Chromium capture pipeline) + live-model; no room, no human voice, nothing played aloud',
  scriptSeconds: Math.round(t),
  lines: lines.map((l) => l.say),
  heardByStay: data.heard,
  staySaid: data.said.map((s) => s.slice(0, 160)),
  firstSoundAfterSpeechMs: { n: replyMs.length, median: med && Math.round(med), all: replyMs.map(Math.round) },
  talkedIntoThePause: talkedIntoPause,
  pausedWhenTalkedOverMs: duck && interrupt ? Math.round(duck - interrupt.start) : null,
};
const date = new Date().toISOString().slice(0, 10);
fs.writeFileSync(`docs/evidence/loop/file-mic-${date}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
