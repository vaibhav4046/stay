#!/usr/bin/env node
/**
 * "Pix, 1:42 am": a short film. Pixel-art story (original art, no real products) around ONE real call recorded in the real app
 * (real model, Stay's real AssemblyAI voice). Pix's voice, effects and music are synthetic (ElevenLabs + a few synthesized sounds).
 *
 *   node scripts/demo-video/story.mjs record http://localhost:3120   the one real call -> a "take" (video, Stay's audio, timings); nothing is played aloud
 *   node scripts/demo-video/story.mjs build [--fake]                 edit + render + mix the film from the take (--fake: placeholder take, output to the temp dir)
 *   node scripts/demo-video/story.mjs landing                        swap the landing page to the new film's files (after a real build)
 *
 * Honest by construction: every Stay line is the app's real reply from the take; the film is only built if no beat failed.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const STAGE = process.argv[2] || 'build';
const FAKE = process.argv.includes('--fake'), DRAFT = process.argv.includes('--draft');
const BASE = (process.argv.find((a) => /^https?:/.test(a)) || 'http://localhost:3120').replace(/\/$/, '');
const KEY = process.env.ELEVENLABS_API_KEY; // never printed
const VOICE = 'FGY2WhTYpPnrIDTdsKH5'; // Laura, the voice used for Pix in the first film
const work = path.join(os.tmpdir(), 'stay-film');
const wk = path.join(os.tmpdir(), 'storywork');
const takeDir = path.join(work, FAKE ? 'story-take-fake' : 'story-take');
const OUTDIR = FAKE ? path.join(wk, 'out') : 'public/demo';
for (const d of [work, wk, takeDir, OUTDIR, 'docs/evidence/film']) fs.mkdirSync(d, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);
const FPS = 25, SR = 48000;
const ff = (args, o = {}) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit', ...o });

// ---- ElevenLabs: speech, effects (cached on disk by their text, same keys as film.mjs so nothing is bought twice) ------------------
function curlTo(file, url, body) {
  if (!KEY) throw new Error('ELEVENLABS_API_KEY is not set');
  const bodyFile = file + '.json';
  fs.writeFileSync(bodyFile, JSON.stringify(body));
  for (let i = 0; i < 3; i++) {
    const r = spawnSync('curl', ['-s', '-m', '90', '-o', file, '-w', '%{http_code}', '-X', 'POST', url, '-H', `xi-api-key: ${KEY}`, '-H', 'content-type: application/json', '-d', `@${bodyFile}`], { encoding: 'utf8' });
    if (r.stdout.trim() === '200' && fs.existsSync(file) && fs.statSync(file).size > 1500) return true;
    if (fs.existsSync(file)) fs.unlinkSync(file);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500 * (i + 1));
  }
  return false;
}
const speech = (text) => {
  const f = path.join(work, hash('s' + VOICE + text) + '.pcm');
  if (!fs.existsSync(f) && !curlTo(f, `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=pcm_24000`, { text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.4 } })) throw new Error('speech failed: ' + text);
  return f;
};
const effect = (prompt, seconds) => {
  const f = path.join(work, hash('e' + prompt + seconds) + '.mp3');
  if (!fs.existsSync(f) && !curlTo(f, 'https://api.elevenlabs.io/v1/sound-generation', { text: prompt, duration_seconds: seconds, prompt_influence: 0.5 })) throw new Error('effect failed: ' + prompt);
  return f;
};
const creditsUsed = () => { try { return JSON.parse(execFileSync('curl', ['-s', '-m', '20', 'https://api.elevenlabs.io/v1/user/subscription', '-H', `xi-api-key: ${KEY}`], { encoding: 'utf8' })).character_count; } catch { return null; } };
const wavOf = (pcm) => { const w = pcm.replace(/\.pcm$/, '.wav'); if (!fs.existsSync(w)) ff(['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm, w], { stdio: 'ignore' }); return w; };

// the new assets (the first film's cached ones are reused by the same prompts)
const ASSETS = {
  flick: ['quick phone scroll flick, soft swipe, short', 1], ding: ['gentle soft notification chime, single note', 1], whoosh: ['very soft airy whoosh transition', 1],
  bed1: ['minimal calm ambient piano and soft pad, slow, warm, no drums, no vocals, loopable background music', 22],
  buzz: ['phone vibrating on a wooden desk, two short buzzes', 2], birds: ['soft birdsong at dawn, quiet morning ambience, gentle', 10],
  typing: ['steady laptop keyboard typing, soft keys, close, no music', 5], bed2: ['warm hopeful cinematic piano with soft strings, slowly swelling to a gentle uplifting resolution, no drums, no vocals', 22],
};

// ---- audio helpers (everything is mono 48 kHz Float32 until the final mix) ---------------------------------------------------------
const mkbuf = (s) => new Float32Array(Math.max(1, Math.ceil(s * SR)));
function decode(file, o = {}) {
  const args = ['-v', 'error'];
  if (/\.pcm$/.test(file)) args.push('-f', 's16le', '-ar', '24000', '-ac', '1');
  if (o.from) args.push('-ss', String(o.from));
  args.push('-i', file);
  if (o.dur) args.push('-t', String(o.dur));
  args.push('-ac', '1', '-ar', String(SR), '-f', 'f32le', '-');
  const r = spawnSync('ffmpeg', args, { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('decode failed: ' + file);
  const b = r.stdout, n = b.length >> 2, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readFloatLE(i * 4);
  return out;
}
function writeWav(file, ch, sr = SR) { // ch: array of Float32Array
  const n = ch[0].length, nc = ch.length, b = Buffer.alloc(44 + n * nc * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * nc * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(nc, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * nc * 2, 28); b.writeUInt16LE(nc * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * nc * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(ch[c][i] * 32767))), 44 + (i * nc + c) * 2);
  fs.writeFileSync(file, b);
}
const rms = (b) => { let s = 0, n = 0; for (let i = 0; i < b.length; i++) if (Math.abs(b[i]) > 0.01) { s += b[i] * b[i]; n++; } return n ? Math.sqrt(s / n) : 0; };
const normTo = (b, target) => { const r = rms(b); return r ? target / r : 1; };
function envelope(b, hop = 0.01) { const n = Math.floor(b.length / (hop * SR)), v = new Float32Array(n), h = Math.round(hop * SR); for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < h; k++) s += b[i * h + k] ** 2; v[i] = Math.sqrt(s / h); } return { hop, v }; }
const pctile = (v, p) => { const a = Float32Array.from(v).sort(); return a[Math.floor(a.length * p)] || 0; };
function gapsIn(env, thr, a, b, minLen) { const out = []; let s = -1; for (let i = Math.floor(a / env.hop); i < Math.min(env.v.length, Math.floor(b / env.hop)); i++) { if (env.v[i] < thr) { if (s < 0) s = i; } else { if (s >= 0 && (i - s) * env.hop >= minLen) out.push({ a: s * env.hop, b: i * env.hop }); s = -1; } } return out; }
function onsetAfter(env, thr, from) { for (let i = Math.max(0, Math.floor(from / env.hop)); i < env.v.length; i++) if (env.v[i] > thr) return i * env.hop; return null; }
function activeEnd(env, thr, from, limit, maxGap = 1.5) { let last = from, sil = 0; for (let i = Math.floor(from / env.hop); i < Math.min(env.v.length, Math.floor(limit / env.hop)); i++) { if (env.v[i] > thr) { last = i * env.hop; sil = 0; } else if ((sil += env.hop) > maxGap) break; } return last + 0.12; }

// ---- synthesized sounds (8-bit Foley that suits the pixel world) ---------------------------------------------------------------------
function noiseGen(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s / 4294967296) * 2 - 1; }; }
const addTo = (dst, src, at, g = 1) => { const o = Math.round(at * SR); for (let i = 0; i < src.length; i++) { const k = o + i; if (k >= 0 && k < dst.length) dst[k] += src[i] * g; } };
const sTick = (hi) => { const b = mkbuf(0.05), r = noiseGen(hi ? 11 : 7); let lp = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; lp += (r() - lp) * 0.5; b[i] = (lp * Math.exp(-t / 0.004) * 0.9 + Math.sin(2 * Math.PI * (hi ? 2300 : 1700) * t) * Math.exp(-t / 0.007) * 0.5) * 0.8; } return b; };
const sBlip = (f0, f1, d) => { const b = mkbuf(d); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (f0 + (f1 - f0) * (t / d)) / SR; b[i] = (ph % 1 < 0.5 ? 1 : -1) * 0.22 * Math.exp(-t / (d * 0.6)) * Math.min(1, t / 0.002); } return b; };
const sChime = (f, d = 0.9) => { const b = mkbuf(d); for (let i = 0; i < b.length; i++) { const t = i / SR; b[i] = (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * 2 * f * t) + 0.15 * Math.sin(2 * Math.PI * 3.01 * f * t)) * Math.exp(-t / 0.28) * Math.min(1, t / 0.003) * 0.3; } return b; };
const sThunk = () => { const b = mkbuf(0.3), r = noiseGen(5); let lp = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; lp += (r() - lp) * 0.08; b[i] = (Math.sin(2 * Math.PI * (70 - 30 * t) * t) * Math.exp(-t / 0.08) + lp * Math.exp(-t / 0.03) * 1.5) * 0.7; } return b; };
const sRise = (f0, f1, d) => { const b = mkbuf(d); let ph = 0; for (let i = 0; i < b.length; i++) { const t = i / SR; ph += (f0 + (f1 - f0) * (t / d)) / SR; b[i] = Math.sin(2 * Math.PI * ph) * 0.12 * Math.min(1, t / 0.1) * Math.min(1, (d - t) / 0.1); } return b; };
function roomTone(dur) { const L = mkbuf(dur), R = mkbuf(dur), rl = noiseGen(3), rr = noiseGen(4); let a = 0, b = 0; for (let i = 0; i < L.length; i++) { a = a * 0.995 + rl() * 0.02; b = b * 0.995 + rr() * 0.02; const hum = Math.sin(2 * Math.PI * 50 * i / SR) * 0.003; L[i] = a * 0.5 + hum; R[i] = b * 0.5 + hum; } return [L, R]; }
function chiptune(dur) { // an upbeat reel-soundtrack loop whose tempo and pitch sink and whose filter closes: the energy drains out of it
  const out = mkbuf(dur), r = noiseGen(99), scale = [0, 3, 5, 7, 10, 12, 15, 17], pat = [0, 2, 4, 2, 5, 4, 2, 1];
  let t = 0, step = 0, phL = 0, phB = 0;
  while (t < dur) {
    const x = t / dur, spb = 60 / (138 - 74 * Math.pow(x, 1.25)) / 2, semis = -9 * x, bar = Math.floor(step / 8);
    const deg = scale[(pat[step % 8] + (bar % 4 === 3 ? 2 : 0)) % 8], f = 220 * Math.pow(2, (deg + semis) / 12), fb = 110 * Math.pow(2, ([0, 0, -2, -4][bar % 4] + semis) / 12);
    const n = Math.floor(spb * SR), o = Math.floor(t * SR), amp = 0.55 * (1 - x * 0.75);
    for (let i = 0; i < n && o + i < out.length; i++) { const tt = i / SR; phL += f / SR; phB += fb / SR; const lead = (phL % 1 < 0.25 ? 1 : -1) * Math.exp(-tt / (spb * 0.7)), bass = Math.abs((phB % 1) * 4 - 2) - 1, hat = step % 2 ? r() * 0.4 * Math.exp(-tt / 0.02) : 0; out[o + i] = (lead * 0.22 + bass * 0.2 + hat * 0.25) * amp; }
    t += spb; step++;
  }
  let lp = 0; for (let i = 0; i < out.length; i++) { const x = i / out.length; lp += (out[i] - lp) * Math.max(0.02, 0.9 - 0.86 * Math.pow(x, 0.8)); out[i] = lp; }
  return out;
}

// ---- the beats of the real call -----------------------------------------------------------------------------------------------------
const BEATS = [
  { id: 'b1', say: "I have an essay due at nine and I've been in reels for three hours. Don't coach me, just tell me what to do." },
  { id: 'b2', say: 'Set a one minute timer.', timer: true },
  { id: 'b3', say: 'Why would I use this and not just ask a regular chatbot?' },
  { id: 'b4', say: "Remember that I scroll when I'm anxious." },
  { id: 'checkin', waitStay: 80 },
  { id: 'b5', parts: ['Yeah, I wrote...', 'two lines.'], gap: 0.9 }, // a pause in the middle of the sentence: Stay should wait for the rest
  { id: 'b6', say: 'Show my report.', closes: 'inline-reports-close', hold: 3.5 },
  { id: 'b7', say: 'Thanks, Stay. That actually helped.' },
];
const SIDE_LINES = { ugh: 'Ugh. Fine.' };

// ======================================================= RECORD ===============================================================
async function record() {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'], timeout: 60000 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-GB', recordVideo: { dir: work, size: { width: 1280, height: 720 } }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.addInitScript(() => {
    window.__stayFastDebug = true; window.__stayPlays = []; window.__stayPlayStarts = window.__stayPlays;
    const ac = new AudioContext({ sampleRate: 24000 }), dest = ac.createMediaStreamDestination();
    const nb = ac.createBuffer(1, 48000, 24000), nd = nb.getChannelData(0); let s = 0;
    for (let i = 0; i < nd.length; i++) { s = 0.985 * s + 0.015 * (Math.random() * 2 - 1); nd[i] = s * 2.2; }
    const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true; const ng = ac.createGain(); ng.gain.value = 0.05; ns.connect(ng); ng.connect(dest); ns.start();
    window.__micEnd = 0;
    window.__say = (b64) => {
      ac.resume(); const bin = atob(b64), n = bin.length >> 1, f = new Float32Array(n);
      for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; f[i] = v / 32768; }
      const buf = ac.createBuffer(1, n, 24000); buf.copyToChannel(f, 0); const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest);
      const at = Math.max(ac.currentTime + 0.05, window.__micEnd); src.start(at); window.__micEnd = at + buf.duration; return { startsIn: at - ac.currentTime, dur: buf.duration };
    };
    navigator.mediaDevices.getUserMedia = async () => { await ac.resume(); return dest.stream.clone(); };
    window.__aud = { list: [] }; const orig = AudioNode.prototype.connect, recs = new WeakMap();
    AudioNode.prototype.connect = function (d, ...rest) {
      const r = orig.call(this, d, ...rest);
      try { if (d && d === this.context.destination && this.context !== ac) { let md = recs.get(this.context); if (!md) { md = this.context.createMediaStreamDestination(); recs.set(this.context, md); const rec = new MediaRecorder(md.stream, { mimeType: 'audio/webm;codecs=opus' }); const entry = { chunks: [], startedAt: Date.now(), rec }; rec.ondataavailable = (e) => e.data.size && entry.chunks.push(e.data); rec.start(500); window.__aud.list.push(entry); } orig.call(this, md); } } catch { /* recording only */ }
      return r;
    };
  });
  // a clock flash at the very start, so the video's time can be tied to the wall clock to a few milliseconds
  await page.goto('data:text/html,<body style="margin:0;background:#000"></body>');
  await sleep(700);
  await page.evaluate(() => { document.body.style.background = '#fff'; });
  const tFlash = now();
  await sleep(450);
  await page.goto(BASE + '/app/today');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('stay_fast_voice', '1'); localStorage.setItem('stay:mic_consented:v1', '1'); });
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  const status = () => page.evaluate(() => document.querySelector('[data-testid="orb-status"]')?.textContent?.trim() || '');
  const bubbles = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="chat-agent-message"] .bubble')].map((e) => e.textContent.trim()));
  const bubbleCount = () => page.evaluate(() => document.querySelectorAll('[data-testid="chat-agent-message"]').length);
  const until = async (fn, max) => { const t0 = now(); while (now() - t0 < max) { if (await fn()) return true; await sleep(150); } return false; };
  const settled = async (max) => { const t0 = now(); let since = 0, seen = await bubbleCount(); while (now() - t0 < max) { const n = await bubbleCount(), listening = (await status()) === 'Listening'; if (n !== seen || !listening) { seen = n; since = 0; } else if (!since) since = now(); if (since && now() - since >= 1500) return true; await sleep(150); } return false; };
  const trail = []; const poll = setInterval(async () => { try { trail.push({ t: now(), n: await bubbleCount() }); } catch { /* closing */ } }, 400);
  const warm = () => { for (const b of BEATS) { if (b.say) speech(b.say); (b.parts || []).forEach(speech); } };
  warm(); // every line is synthesized before the call starts, so the take has no gaps from the voice service
  const wall = { pix: [], stay: {} }; let lastSpeakEnd = 0, timerSetAt = 0, failed = null, pauseHeld = null;
  async function speak(id, text, tail = true) {
    const pcm = speech(text), r = await page.evaluate((b) => window.__say(b), fs.readFileSync(pcm).toString('base64')), t = now() + r.startsIn * 1000;
    wall.pix.push({ id, text, file: pcm, t, dur: r.dur }); lastSpeakEnd = t + r.dur * 1000;
    await sleep(r.startsIn * 1000 + r.dur * 1000 + (tail ? 250 : 0));
  }
  async function takeReply(id, before, fromPlay) {
    const got = await until(async () => (await bubbleCount()) > before, 30000), ok = got && (await settled(60000)), reply = (await bubbles()).slice(before).join(' ');
    if (!ok || !reply || /too many requests|could not reach my thinking/i.test(reply)) return `${id} had no clean reply: ${reply.slice(0, 120)}`;
    const plays = await page.evaluate(() => window.__stayPlays.slice());
    wall.stay[id] = { text: reply, play: plays.find((x) => x > fromPlay) ?? null, settledAt: now() };
    return null;
  }
  const readyWall = (await sleep(1500), now());
  await page.getByTestId('orb-button').click();
  const clickWall = now();
  await until(async () => (await status()) === 'Listening', 40000);
  failed = await takeReply('greet', 0, clickWall - 200);
  await sleep(900);
  for (const b of failed ? [] : BEATS) {
    if (b.waitStay) {
      const due = timerSetAt + 55_000;
      if (now() < due - 3000) await sleep(due - 3000 - now());
      const nAtDue = [...trail].reverse().find((x) => x.t <= due)?.n ?? (await bubbleCount());
      if (!(await until(async () => (await bubbleCount()) > nAtDue, b.waitStay * 1000))) { failed = 'Stay did not come back when the timer ended'; break; }
      failed = await takeReply(b.id, nAtDue, due - 500); if (failed) break; continue;
    }
    const before = await bubbleCount();
    await sleep(500 + Math.random() * 500);
    if (b.parts) { await speak(b.id + 'a', b.parts[0], false); await sleep(b.gap * 1000); pauseHeld = (await bubbleCount()) === before; await speak(b.id + 'b', b.parts[1]); } else await speak(b.id, b.say);
    failed = await takeReply(b.id, before, lastSpeakEnd - 200); if (failed) break;
    if (b.timer) timerSetAt = now();
    if (b.hold) await sleep(b.hold * 1000);
    if (b.closes) { await page.getByTestId(b.closes).click().catch(() => undefined); await sleep(600); }
  }
  clearInterval(poll);
  await sleep(1200);
  const rec = await page.evaluate(async () => {
    const out = [];
    for (const e of window.__aud.list) { try { e.rec.stop(); } catch { /* stopped */ } await new Promise((r) => setTimeout(r, 300)); const buf = new Uint8Array(await new Blob(e.chunks, { type: 'audio/webm' }).arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); out.push({ startedAt: e.startedAt, b64: btoa(bin) }); }
    return out;
  });
  await ctx.close();
  const appVideo = await page.video().path();
  await browser.close();
  if (failed) { fs.writeFileSync('docs/evidence/film/story-take.json', JSON.stringify({ at: new Date().toISOString(), failed, errors }, null, 1)); console.error('FILM NOT BUILT: ' + failed); process.exit(1); }

  // ---- calibrate: wall clock -> video time (the flash), wall clock -> audio (the page's own play starts) ----
  const video = path.join(takeDir, 'app.webm'); fs.copyFileSync(appVideo, video);
  const flashVT = clickAnchorShift(video, (clickWall - tFlash) / 1000), vt = (w) => flashVT + (w - tFlash) / 1000;
  const videoDur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString().trim());
  const stem = new Float32Array(Math.ceil((videoDur + 2) * SR));
  rec.forEach((e, i) => { const f = path.join(takeDir, `stay-${i}.webm`); fs.writeFileSync(f, Buffer.from(e.b64, 'base64')); addTo(stem, decode(f), vt(e.startedAt)); });
  const env0 = envelope(stem), thr0 = Math.max(0.004, 0.06 * pctile(env0.v, 0.97));
  const deltas = Object.values(wall.stay).filter((s) => s.play).map((s) => { const p = vt(s.play), o = onsetAfter(env0, thr0, p - 0.8); return o == null ? null : o - p; }).filter((d) => d != null);
  const med = deltas.length ? [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)] : 0;
  const shifted = new Float32Array(stem.length); addTo(shifted, stem, -med);
  writeWav(path.join(takeDir, 'stay-real.wav'), [shifted]);
  const out = {
    at: new Date().toISOString(), failed: null, errors, video, stem: path.join(takeDir, 'stay-real.wav'), videoDur, flashVT, ready: vt(readyWall), click: vt(clickWall), pauseHeld,
    calib: { audioVsPlayHookDeltas: deltas.map((d) => +d.toFixed(3)), medianApplied: +(-med).toFixed(3) },
    pix: wall.pix.map((p) => ({ ...p, t: vt(p.t) })), stay: Object.fromEntries(Object.entries(wall.stay).map(([k, s]) => [k, { text: s.text, play: s.play ? vt(s.play) : null, settled: vt(s.settledAt) }])), timerSet: timerSetAt ? vt(timerSetAt) : null,
  };
  fs.writeFileSync(path.join(takeDir, 'take.json'), JSON.stringify(out, null, 1));
  fs.writeFileSync('docs/evidence/film/story-take.json', JSON.stringify({ ...out, stem: undefined, video: undefined, pix: out.pix.map((p) => ({ id: p.id, text: p.text, t: p.t, dur: p.dur })) }, null, 1));
  console.log(`recorded ${videoDur.toFixed(1)} s; Stay replies: ${Object.keys(out.stay).join(', ')}; pause held: ${pauseHeld}; audio vs play-hook offsets (s): ${out.calib.audioVsPlayHookDeltas.join(', ')}`);
}
// The screen recording starts a little after the page exists, and its first frames are white, so the flash cannot be found in it. The orb click can:
// the composer changes ("Talk" -> "Connecting") a few milliseconds after the click, whose wall-clock time is known. Returns video seconds minus wall seconds.
function clickAnchorShift(video, clickRel) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-t', String(clickRel + 8), '-vf', 'fps=25,crop=770:70:255:600,scale=48:6,format=gray,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  let pts = 0;
  for (const l of r.stdout.split(/\r?\n/)) { const m = l.match(/pts_time:([0-9.]+)/); if (m) pts = Number(m[1]); const y = l.match(/YAVG=([0-9.]+)/); if (y && pts > clickRel + 0.3 && Number(y[1]) > 0.5) return pts - 0.03 - clickRel; }
  throw new Error('the orb click was not visible in the take video');
}
// Repairs a take recorded with the earlier (flash) calibration: shifts every time and Stay's audio by the click-anchored offset.
function fixtake() {
  const file = path.join(takeDir, 'take.json'), t = JSON.parse(fs.readFileSync(file, 'utf8')), delta = clickAnchorShift(t.video, t.click) - t.flashVT;
  const sh = (x) => (x == null ? x : +(x + delta).toFixed(3));
  t.ready = sh(t.ready); t.click = sh(t.click); t.timerSet = sh(t.timerSet); t.flashVT = +(t.flashVT + delta).toFixed(3); t.pix.forEach((p) => { p.t = sh(p.t); }); Object.values(t.stay).forEach((v) => { v.play = sh(v.play); v.settled = sh(v.settled); });
  const stem = decode(t.stem), moved = new Float32Array(stem.length); addTo(moved, stem, delta); writeWav(t.stem, [moved]); t.calib.clickAnchorShiftApplied = +delta.toFixed(3);
  fs.writeFileSync(file, JSON.stringify(t, null, 1)); fs.writeFileSync('docs/evidence/film/story-take.json', JSON.stringify({ ...t, stem: undefined, video: undefined, pix: t.pix.map((p) => ({ id: p.id, text: p.text, t: p.t, dur: p.dur })) }, null, 1));
  console.log('take shifted by', delta.toFixed(3), 's');
}

// A placeholder take for dry runs: the first film's app video and Stay audio, with placeholder texts. Never used for the real film.
function fakeTake() {
  const old = fs.readdirSync(work).filter((f) => /^page@.*\.webm$/.test(f)).map((f) => ({ f, s: fs.statSync(path.join(work, f)) })).filter((x) => x.s.size > 17e6 && x.s.size < 19e6).sort((a, b) => b.s.mtimeMs - a.s.mtimeMs)[0];
  const video = path.join(work, old.f), stemSrc = path.join(work, 'stay-1.webm'), stem = decode(stemSrc), env = envelope(stem), thr = Math.max(0.004, 0.06 * pctile(env.v, 0.97));
  const groups = []; let s = -1, last = 0;
  for (let i = 0; i < env.v.length; i++) { if (env.v[i] > thr) { if (s < 0) s = i * env.hop; last = i * env.hop; } else if (s >= 0 && i * env.hop - last > 1.3) { if (last - s > 0.8) groups.push([s, last + 0.12]); s = -1; } }
  const texts = { greet: "Hi, I'm Stay. What are you putting off?", b1: 'Open the document and type a single sentence about your main argument.', b2: 'Done.', b3: "A clock app starts a timer, and a general voice assistant will talk about anything. I'm for the moment you're stuck. Tell me what you're avoiding and I give you one tiny first step, start the clock with you, and wait through your pauses. When time's up I check in, and I remember what helped.", b4: 'Got it, I will remember.', checkin: 'Did you start the timer and get the paper open? If so, let me know so I can record your progress.', b5: 'Nice work. Write one more sentence to keep momentum.', b6: 'Done.', b7: "Anytime. I'm here when you want to start the next thing." };
  const ids = Object.keys(texts); writeWav(path.join(takeDir, 'stay-real.wav'), [stem]);
  const out = { failed: null, fake: true, video, stem: path.join(takeDir, 'stay-real.wav'), videoDur: 150, flashVT: 0, ready: Math.max(0, groups[0][0] - 3), click: groups[0][0] - 2, pauseHeld: true, calib: {}, pix: [], stay: {}, timerSet: groups[2][1] };
  ids.forEach((id, i) => { const g = groups[i % groups.length]; out.stay[id] = { text: texts[id], play: g[0], settled: g[1] + 0.5 }; });
  for (const b of BEATS) for (const [id, text] of b.parts ? [[b.id + 'a', b.parts[0]], [b.id + 'b', b.parts[1]]] : b.say ? [[b.id, b.say]] : []) { const pcm = speech(text), dur = fs.statSync(pcm).size / 2 / 24000, st = out.stay[b.id].play, off = id.endsWith('b') ? 1.1 : 0; out.pix.push({ id, text, file: pcm, t: st - dur - 1.0 + off - (b.parts ? 1.1 + (id.endsWith('a') ? 0.7 : 0) : 0), dur }); }
  fs.writeFileSync(path.join(takeDir, 'take.json'), JSON.stringify(out, null, 1));
  return out;
}

// ======================================================= BUILD ================================================================
function wordTimes(text, a, b, env, thr) {
  const toks = text.split(/\s+/).filter(Boolean), wgt = toks.map((w) => w.replace(/[^\p{L}\p{N}']/gu, '').length + 1 + (/[.?!]$/.test(w) ? 6 : /[,;:]$/.test(w) ? 3 : 0)), tot = wgt.reduce((x, y) => x + y, 0);
  let acc = 0; const prop = toks.map((w, i) => { const t = a + (b - a) * (acc / tot); acc += wgt[i]; return t; });
  const gaps = gapsIn(env, thr, a + 0.15, b - 0.1, 0.2), used = new Set(), anchors = [[a, a], [b, b]];
  toks.forEach((w, i) => { if (i === toks.length - 1 || !/[.?!,;:]$/.test(w)) return; let best = -1, bd = 0.7; gaps.forEach((g, k) => { if (!used.has(k) && Math.abs(g.b - prop[i + 1]) < bd) { bd = Math.abs(g.b - prop[i + 1]); best = k; } }); if (best >= 0) { used.add(best); anchors.push([prop[i + 1], gaps[best].b]); } });
  anchors.sort((x, y) => x[0] - y[0]); const mono = anchors.filter((x, i) => i === 0 || x[1] > anchors[i - 1][1]);
  const remap = (t) => { for (let i = 0; i + 1 < mono.length; i++) { const [p0, r0] = mono[i], [p1, r1] = mono[i + 1]; if (t >= p0 && t <= p1) return r0 + (r1 - r0) * ((t - p0) / Math.max(1e-6, p1 - p0)); } return t; };
  return toks.map((w, i) => ({ w, t: remap(prop[i]) }));
}
function toPages(words, tEnd) {
  const groups = []; let cur = [], len = 0;
  words.forEach((wd) => { cur.push(wd); len += wd.w.length + 1; if ((/[.?!]$/.test(wd.w) && len >= 46) || (/[,;:]$/.test(wd.w) && len >= 84) || len >= 112) { groups.push(cur); cur = []; len = 0; } });
  if (cur.length) { if (groups.length && cur.length < 3) groups[groups.length - 1].push(...cur); else groups.push(cur); }
  return groups.map((g, i) => ({ t0: g[0].t - 0.28, t1: i + 1 < groups.length ? groups[i + 1][0].t - 0.05 : tEnd + 0.7, words: g }));
}

function makePlan(take, S) {
  const P = { shots: [], bubbles: [], cards: [], stay: [], pages: [], apps: [], ev: [], vtt: [], notes: [] };
  const shot = (t0, t1, type, p, o = {}) => { P.shots.push({ t0, t1, type, p, ...o }); return t1; };
  const ev = (bus, b, at, gain = 1, o = {}) => P.ev.push({ bus, b, at, gain, ...o });
  const stem = decode(take.stem), env = envelope(stem), thr = Math.max(0.004, 0.06 * pctile(env.v, 0.97)), gStay = normTo(stem, 0.1);
  const pixById = Object.fromEntries(take.pix.map((p) => [p.id, p]));
  const clipOf = (id) => { const c = decode(pixById[id].file); return [c, normTo(c, 0.12)]; };
  const sideClip = (text) => { const c = decode(speech(text)); return [c, normTo(c, 0.12)]; };
  const vttT = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${(s % 60).toFixed(3).padStart(6, '0')}`;
  P.vttT = vttT;

  // Stay's real line: its audio slice, word times from that audio, captions in film time. Returns nothing; r0..r1 is the real time that is placed at `at`.
  const stayLine = (id, r0, r1, at) => {
    const s = take.stay[id], start = onsetAfter(env, thr, (s.play ?? r0) - 0.5) ?? s.play, end = activeEnd(env, thr, start, r1 + 2), words = wordTimes(s.text, start, end, env, thr), mapT = (x) => at + (x - r0);
    ev('dia', stem.subarray(Math.floor(r0 * SR), Math.floor(r1 * SR)), at, gStay, { fadeOut: 0.12 });
    const fw = words.map((w) => ({ w: w.w, t: mapT(w.t) })); P.pages.push(...toPages(fw, mapT(end))); P.stay.push([mapT(start), mapT(end)]);
    P.vtt.push({ t0: mapT(start), t1: mapT(end) + 0.4, text: 'Stay: ' + s.text });
    return { start, end };
  };
  const appSeg = (r0, r1, at, fade = 0) => { P.apps.push({ r0, r1, at, d: r1 - r0, fade }); return at + (r1 - r0); };
  const pixLine = (id, at, bubbleText) => { const [c, g] = clipOf(id), d = c.length / SR; ev('dia', c, at, g); P.bubbles.push({ t0: at, t1: at + d, text: bubbleText || pixById[id].text }); P.vtt.push({ t0: at, t1: at + d + 0.3, text: 'Pix: ' + pixById[id].text }); return d; };
  const tickRoom = (t0, t1, g0, g1) => { for (let t = t0; t < t1; t += 1) ev('sfx', S.tick[Math.round(t) % 2], t, g0 + (g1 - g0) * ((t - t0) / (t1 - t0))); };
  const reelAudio = (t0, t1, per) => { for (let t = t0 + per; t < t1 - 0.2; t += per) { ev('sfx', S.flick, t - 0.05, 0.3); } for (let t = t0 + 0.9; t < t1 - 0.3; t += per) ev('sfx', S.pop, t, 0.5); };

  // ---------------------------------------------- ACT 1: doomscroll (about 36 s) ----------------------------------------------
  let T = 0;
  const night = { sky: 0, cups: 1, lamp: true, noteRed: 0 };
  shot(0, 4.2, 'wide', { ...night, pose: 'scroll', clock: [11, 7], steam: true, fat: 0.05 }, { fi: 1.2 }); P.cards.push({ t0: 0.8, t1: 3.6, kind: 'stamp', text: '11:07 PM', x: 8, y: 122 });
  shot(4.2, 8.7, 'ots', { clock: [11, 7], fat: 0.1 });
  shot(8.7, 10.3, 'clock', { from: '12:19', to: '12:19', ap: 'AM' }); P.cards.push({ t0: 8.8, t1: 10.2, kind: 'stamp', text: '12:19 AM', x: 8, y: 122 });
  shot(10.3, 14.3, 'ots', { clock: [12, 19], fat: 0.3, noteRed: 1, reels: [['gym', 1.2], ['cook', 1.2], ['meme', 1.2], ['cat', 1.2], ['dance', 1.2]] });
  shot(14.3, 16.3, 'laptop', { mode: 'tabs', tabs: 4 }); shot(16.3, 18.3, 'laptop', { mode: 'tabs', tabs: 9 });
  shot(18.3, 20.6, 'clock', { from: '1:42', to: '1:42', ap: 'AM', noteClose: true, noteRed: 1 }); P.cards.push({ t0: 18.4, t1: 20.5, kind: 'stamp', text: '1:42 AM', x: 8, y: 122 });
  shot(20.6, 25.4, 'wide', { ...night, pose: 'scroll', clock: [1, 42], fat: 0.55, cups: 4, noteRed: 1, flicker: 1.4, jig: true });
  shot(25.4, 30.4, 'face', { pose: 'listen', fat: 0.85, light: 'phone', clock: [1, 42] });
  shot(30.4, 34.2, 'ots', { clock: [1, 42], fat: 0.9, noteRed: 1, loop: false, reels: [['meme', 4]] }, { fo: 0.6 });
  // Act 1 sound: the reels' music drains, the wall clock stays
  ev('mus', S.chip, 0, 1.1, { fadeIn: 0.8, fadeOut: 1.0 }); tickRoom(0.5, 36, 0.05, 0.3);
  reelAudio(4.2, 8.7, 1.7); reelAudio(10.3, 14.3, 1.2); reelAudio(30.4, 34.2, 4);
  [8.7, 18.3, 14.3, 25.4].forEach((t) => ev('sfx', S.whoosh, t - 0.1, 0.35)); ev('sfx', S.chimeLow, 20.6, 0.4);
  ev('amb', S.room, 0, 0.22, { fadeIn: 1.5 });

  // ---------------------------------------------- ACT 2: the nudge (about 24 s) ----------------------------------------------
  T = 36.2;
  shot(T, T + 2.8, 'wide', { ...night, pose: 'scroll', clock: [1, 44], fat: 0.9, cups: 4, noteRed: 1, flicker: 0.5 }, { fi: 0.6 });
  const msgT = T + 2.8, msgText = 'try Stay. It just starts the clock with you.', msgUrl = 'https://stay-two-swart.vercel.app'.replace('https://', '');
  shot(msgT, msgT + 8.2, 'ots', { clock: [1, 44], fat: 0.9, noteRed: 1, loop: false, reels: [['meme', 9]], msg: { at: 0.5, dur: 3.2, text: msgText, url: msgUrl } });
  ev('sfx', S.buzz, msgT + 0.1, 0.7); ev('sfx', S.ding, msgT + 0.55, 0.6); P.vtt.push({ t0: msgT + 0.6, t1: msgT + 7.5, text: 'Maya (message): ' + msgText + ' ' + msgUrl });
  const sighT = msgT + 8.2;
  shot(sighT, sighT + 3.6, 'face', { pose: 'sigh', fat: 0.7, light: 'phone', clock: [1, 44] }); const ugh = sideClip(SIDE_LINES.ugh); ev('dia', ugh[0], sighT + 1.5, ugh[1]); P.bubbles.push({ t0: sighT + 1.5, t1: sighT + 1.5 + ugh[0].length / SR, text: SIDE_LINES.ugh }); P.vtt.push({ t0: sighT + 1.5, t1: sighT + 2.8, text: 'Pix: ' + SIDE_LINES.ugh });
  const openT = sighT + 3.6;
  shot(openT, openT + 3.0, 'wide', { ...night, pose: 'open', clock: [1, 45], fat: 0.5, cups: 4, noteRed: 1, lamp: true, awake: true, lapAnim: true }); ev('sfx', S.thunk, openT + 1.1, 0.7); ev('sfx', S.whoosh, openT + 0.2, 0.3);
  const urlT = openT + 3.0;
  shot(urlT, urlT + 3.7, 'laptop', { mode: 'url' }); ev('sfx', S.typing, urlT + 0.5, 0.7, { dur: 1.9 }); ev('sfx', S.pop, urlT + 2.35, 0.6);
  const fillT = urlT + 3.7;
  shot(fillT, fillT + 1.3, 'laptop', { zoom: 2 });
  const bed1 = { bus: 'mus', b: S.bed1, at: sighT + 0.5, gain: 0.9, fadeIn: 2.5, fadeOut: 2.5, loop: true, loopFade: 1.5 }; P.ev.push(bed1);

  // ---------------------------------------------- ACT 3: the real call -----------------------------------------------------------
  const A3 = fillT + 0.9; T = A3; // the real app dissolves in over the last 0.4 s of the pixel laptop
  const g = take.stay.greet, gStart = onsetAfter(env, thr, (g.play ?? take.click) - 0.5) ?? g.play, gEnd = activeEnd(env, thr, gStart, g.settled + 1);
  const r0g = Math.max(take.ready, gStart - 2.6), r1g = gEnd + 0.9;
  T = appSeg(r0g, r1g, T, 0.4); stayLine('greet', r0g, r1g, A3);
  const wideCall = (extra = {}) => ({ sky: 0, cups: 4, lamp: true, noteRed: 1, clock: [1, 52], fat: 0.55, awake: true, lap: { x: 150, open: 1 }, ...extra });
  const doBeat = (id, kind, pose, post = 0.8, holdTail = 0) => {
    const pid = pixById[id]; if (!pid) throw new Error('take is missing Pix line ' + id);
    const d = pixLine(id, T + 0.15), p = kind === 'face' ? { pose, light: 'laptop', fat: 0.55, clock: [1, 52] } : wideCall({ pose: 'talk' });
    T = shot(T, T + 0.15 + d + 0.5, kind, p);
    const s = take.stay[id], st = onsetAfter(env, thr, (s.play ?? pid.t) - 0.5) ?? s.play, en = activeEnd(env, thr, st, s.settled + 1), r0 = Math.max(pid.t + 0.6, st - 1.5), r1 = en + post + holdTail;
    const at = T; T = appSeg(r0, r1, T); stayLine(id, r0, r1, at);
  };
  doBeat('b1', 'face', 'impatient', 0.9);
  doBeat('b2', 'wide', 'talk', 2.2);
  doBeat('b3', 'face', 'listen', 0.9);
  doBeat('b4', 'wide', 'talk', 0.8);
  // the clock runs while he works; the wait is cut (said on screen) and Stay comes back by itself
  const waitT = T, barLen = 7.0;
  T = shot(T, T + 9.0, 'wide', wideCall({ pose: 'type', prog: [0.3, 0.3 + barLen], clock: [1, 53] })); P.cards.push({ t0: waitT + 0.4, t1: waitT + 4.2, kind: 'stamp', text: 'One minute, cut short', x: 72, y: 111 });
  ev('sfx', S.typing, waitT + 0.3, 0.6, { dur: 5 }); ev('sfx', S.rise, waitT + 0.3, 0.5); ev('sfx', S.ding, waitT + 0.3 + barLen + 0.05, 0.7);
  { const s = take.stay.checkin, st = onsetAfter(env, thr, (s.play ?? take.timerSet + 55) - 0.5) ?? s.play, en = activeEnd(env, thr, st, s.settled + 1), r0 = st - 1.7, r1 = en + 0.8, at = T; T = appSeg(r0, r1, T); stayLine('checkin', r0, r1, at); }
  { // "Yeah, I wrote... two lines." with a real pause in the middle
    const a = pixById.b5a, b = pixById.b5b, d1 = pixLine('b5a', T + 0.15), gapReal = Math.max(0.6, b.t - (a.t + a.dur)), d2 = pixLine('b5b', T + 0.15 + d1 + gapReal);
    T = shot(T, T + 0.15 + d1 + gapReal + d2 + 0.5, 'face', { pose: 'listen', light: 'laptop', fat: 0.5, clock: [1, 54] }); P.notes.push('pause held: ' + take.pauseHeld);
    const s = take.stay.b5, st = onsetAfter(env, thr, (s.play ?? b.t) - 0.5) ?? s.play, en = activeEnd(env, thr, st, s.settled + 1), r0 = Math.max(b.t + b.dur + 0.4, st - 1.5), r1 = en + 0.9, at = T; T = appSeg(r0, r1, T); stayLine('b5', r0, r1, at);
  }
  doBeat('b6', 'face', 'impatient', 1.0, 3.2);

  // ---------------------------------------------- ACT 4: the payoff (about 26 s incl. the end card) ---------------------------------
  P.cards.push({ t0: T, t1: T + 2.2, kind: 'full', text: 'Later that night.', scale: 2 }); T = shot(T, T + 2.2, 'black', {});
  const A4 = T;
  T = shot(T, T + 7.6, 'list', { sky: 1, ticks: [1.8, 3.8, 5.8] }, { fi: 0.5 });
  [1.8, 3.8, 5.8].forEach((t, i) => { const base = [523.25, 659.25, 783.99][i]; ev('sfx', S.chime(base), A4 + t + 0.3, 0.75); ev('sfx', S.chime(base * 1.5), A4 + t + 0.4, 0.45); ev('sfx', S.pop, A4 + t + 0.3, 0.4); });
  bed1.dur = A4 + 1.2 - bed1.at; ev('sfx', S.birds, A4 - 0.3, 0.45, { fadeIn: 1.2, fadeOut: 1.5, dur: 9 }); ev('mus', S.bed2, A4 - 0.8, 1, { fadeIn: 2.5, fadeOut: 3, loop: true, loopFade: 1.5 });
  const tk = take.stay.b7, tp = pixById.b7, thanksAt = T + 0.5;
  const stT = onsetAfter(env, thr, (tk.play ?? tp.t + tp.dur) - 0.5) ?? tk.play, enT = activeEnd(env, thr, stT, tk.settled + 1), gapReal = Math.min(1.6, Math.max(0.7, stT - (tp.t + tp.dur))), r0T = stT - 0.1, r1T = enT + 0.35;
  const stayAt = thanksAt + tp.dur + gapReal, endShot = stayAt + (r1T - r0T) + 0.2 + 2.8;
  shot(T, endShot, 'wide', { sky: 0.93, cups: 4, lamp: false, noteRed: 1, clock: [6, 40], fat: 0, awake: true, lap: { x: 150, open: 1 }, pose: 'lean' }, { fo: 1.0 });
  pixLine('b7', thanksAt); stayLine('b7', r0T, r1T, stayAt); T = endShot; // Pix leans back and thanks Stay (his real line from the call), and Stay answers (its real reply)
  P.end = { t0: T, len: 8.0 };
  P.D = T + P.end.len;
  P.vtt.push({ t0: T + 1.0, t1: P.D - 1, text: "Stay. Start the thing you've been avoiding. stay-two-swart.vercel.app" });
  return P;
}

// ---- the film ---------------------------------------------------------------------------------------------------------------------------
function loadAssets() {
  const f = (k) => effect(...ASSETS[k]), dec = (k, g = 1) => { const b = decode(f(k)); for (let i = 0; i < b.length; i++) b[i] *= g; return b; };
  const flick = decode(f('flick')), ding = decode(f('ding')), whoosh = decode(f('whoosh'));
  return {
    flick, ding, whoosh, bed1: dec('bed1'), bed2: dec('bed2'), buzz: decode(f('buzz')), birds: decode(f('birds')), typing: decode(f('typing')),
    tick: [sTick(true), sTick(false)], pop: sBlip(520, 1100, 0.09), thunk: sThunk(), chip: chiptune(36), room: roomTone(Math.ceil(240)), rise: sRise(300, 900, 7), chimeLow: sChime(110, 1.5), chime: (f2) => sChime(f2),
  };
}

function mixdown(P, S) {
  const D = P.D, n = Math.ceil(D * SR), bus = { dia: new Float32Array(n), sfx: new Float32Array(n), mus: new Float32Array(n) }, ambL = new Float32Array(n), ambR = new Float32Array(n);
  for (const e of P.ev) {
    if (e.bus === 'amb') { const [L, R] = e.b; for (let i = 0; i < n && i < L.length; i++) { const f = e.fadeIn ? Math.min(1, i / SR / e.fadeIn) : 1, o = Math.min(1, (n - i) / SR / 2); ambL[i] += L[i] * e.gain * f * o; ambR[i] += R[i] * e.gain * f * o; } continue; }
    let b = e.b; if (e.dur && !e.loop) b = b.subarray(0, Math.floor(e.dur * SR));
    if (e.loop) { const need = Math.ceil((e.dur ?? D - e.at) * SR), o = new Float32Array(need), xf = Math.floor((e.loopFade || 1) * SR), step = b.length - xf; for (let s = 0, k = 0; s < need; s += step, k++) for (let i = 0; i < b.length && s + i < need; i++) { const w = i < xf && k > 0 ? i / xf : 1, w2 = i > b.length - xf ? (b.length - i) / xf : 1; o[s + i] += b[i] * (k > 0 ? w : 1) * (s + step < need ? w2 : 1); } b = o; }
    const dst = bus[e.bus], o0 = Math.round(e.at * SR), fi = Math.floor((e.fadeIn || 0.004) * SR), fo = Math.floor((e.fadeOut || 0.004) * SR);
    for (let i = 0; i < b.length; i++) { const k = o0 + i; if (k < 0 || k >= n) continue; dst[k] += b[i] * e.gain * Math.min(1, i / fi, (b.length - i) / fo); }
  }
  const musGain = 0.4; // ducking: the score steps down under speech
  const hop = Math.floor(SR * 0.02), duck = new Float32Array(Math.ceil(n / hop)); let gcur = 1;
  for (let k = 0; k < duck.length; k++) { let s = 0; for (let i = 0; i < hop && k * hop + i < n; i++) s += bus.dia[k * hop + i] ** 2; const act = Math.sqrt(s / hop) > 0.012 ? 1 : 0, target = 1 - 0.62 * act; gcur += (target - gcur) * (target < gcur ? 0.25 : 0.03); duck[k] = gcur; }
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const m = bus.mus[i] * musGain * duck[Math.floor(i / hop)], x = bus.dia[i] + bus.sfx[i] * 0.42 + m; L[i] = x + ambL[i]; R[i] = x + ambR[i]; }
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); const k = pk > 0.9 ? 0.9 / pk : 1; for (let i = 0; i < n; i++) { L[i] *= k; R[i] *= k; }
  const st = (b) => { let a = 0, n = 0, p = 0; for (let i = 0; i < b.length; i++) { const v = Math.abs(b[i]); p = Math.max(p, v); if (v > 0.005) { a += v * v; n++; } } return `rms ${(n ? Math.sqrt(a / n) : 0).toFixed(3)} peak ${p.toFixed(2)}`; };
  console.log(`mix buses: dialogue ${st(bus.dia)}; effects ${st(bus.sfx)}; music ${st(bus.mus)} (x${musGain}, ducked)`);
  return [L, R];
}

async function renderPix(P, file) {
  const b = await chromium.launch(); const pg = await b.newPage();
  pg.on('pageerror', (e) => console.error('scene error', String(e).slice(0, 200)));
  await pg.goto(pathToFileURL(path.resolve('scripts/demo-video/story-scene.html')).href);
  const shots = P.shots.map((s) => ({ ...s })); // laptop opening animation is local to the shot
  await pg.evaluate((s) => window.setStory(s), { shots, bubbles: P.bubbles, cards: P.cards, stay: P.stay });
  const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', '320x134', '-r', String(FPS), '-i', '-', '-c:v', 'ffv1', '-level', '3', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.ceil(P.D * FPS);
  for (let i = 0; i < total; i++) { const b64 = await pg.evaluate((t) => { window.render(t); return window.frameB64(); }, i / FPS); await new Promise((r) => enc.stdin.write(Buffer.from(b64, 'base64'), r)); }
  enc.stdin.end(); await new Promise((r) => enc.on('close', r)); await b.close();
}
async function renderCaps(P, file, endFile) {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await pg.goto(pathToFileURL(path.resolve('scripts/demo-video/story-caps.html')).href); await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate((p) => window.setPages(p), P.pages);
  const clip = { x: 100, y: 690, width: 1720, height: 240 }, total = Math.ceil(P.D * FPS), cache = new Map();
  const enc = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-c:v', 'png', '-pix_fmt', 'rgba', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < total; i++) {
    const key = await pg.evaluate((t) => window.cap(t), i / FPS); let png = cache.get(key);
    if (!png) { png = await pg.screenshot({ type: 'png', omitBackground: true, clip }); cache.set(key, png); if (cache.size > 400) cache.delete(cache.keys().next().value); }
    await new Promise((r) => enc.stdin.write(png, r));
  }
  enc.stdin.end(); await new Promise((r) => enc.on('close', r));
  const enc2 = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-', '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-crf', '12', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', endFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const n2 = Math.ceil(P.end.len * FPS), c2 = new Map();
  for (let i = 0; i < n2; i++) { const key = await pg.evaluate((t) => window.endcard(t), i / FPS); let png = c2.get(key); if (!png) { png = await pg.screenshot({ type: 'png' }); c2.set(key, png); } await new Promise((r) => enc2.stdin.write(png, r)); }
  enc2.stdin.end(); await new Promise((r) => enc2.on('close', r)); await b.close();
}

function loudnessTable(file, D) { // short-term loudness (LUFS) every 10 s: the music-only opening should sit well below the speech
  const r = spawnSync('ffmpeg', ['-nostats', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 28 }), rows = [];
  for (const l of r.stderr.split(/\r?\n/)) { const m = l.match(/t:\s*([0-9.]+)\s+TARGET:\S+\s+LUFS\s+M:\s*(-?[0-9.]+)\s+S:\s*(-?[0-9.]+)/); if (m) rows.push([+m[1], +m[3]]); }
  const pick = []; for (let t = 5; t < D; t += 10) { const x = rows.reduce((b, c) => (Math.abs(c[0] - t) < Math.abs(b[0] - t) ? c : b), rows[0] || [0, 0]); pick.push(`${Math.round(t)}s:${x[1]}`); }
  console.log('short-term loudness (LUFS) before normalisation: ' + pick.join('  '));
}

async function build() {
  const take = FAKE ? fakeTake() : JSON.parse(fs.readFileSync(path.join(takeDir, 'take.json'), 'utf8'));
  if (take.failed) throw new Error('the take failed; the film is not built: ' + take.failed);
  const before = creditsUsed(); const S = loadAssets(); const after = creditsUsed();
  if (before != null && after != null && after !== before) console.log(`ElevenLabs credits spent by new assets: ${after - before}`);
  const P = makePlan(take, S), D = P.D, outBase = path.join(OUTDIR, 'stay-story-film');
  console.log(`plan: ${D.toFixed(1)} s, ${P.shots.length} pixel shots, ${P.apps.length} real-app segments, ${P.pages.length} caption pages`);
  const tmp = path.join(wk, FAKE ? 'b-fake' : 'b'); fs.mkdirSync(tmp, { recursive: true });
  const REUSE = process.argv.includes('--reuse'), has = (n) => REUSE && fs.existsSync(path.join(tmp, n));
  // 1. the sound
  if (!has('mix.wav')) { const [L, R] = mixdown(P, S); writeWav(path.join(tmp, 'mix.wav'), [L, R]); loudnessTable(path.join(tmp, 'mix.wav'), D); }
  if (process.argv.includes('--audio')) return;
  // 2. the pixel world and the captions (frame by frame, deterministic)
  if (!has('pix.mkv')) await renderPix(P, path.join(tmp, 'pix.mkv'));
  if (!has('caps.mkv')) await renderCaps(P, path.join(tmp, 'caps.mkv'), path.join(tmp, 'end.mp4'));
  // 3. the real app, as a clean constant-frame-rate file so seeking is exact
  if (!has('app.mp4')) ff(['-i', take.video, '-vf', 'fps=25,scale=1280:720', '-c:v', 'libx264', '-crf', '10', '-g', '5', '-pix_fmt', 'yuv420p', '-an', path.join(tmp, 'app.mp4')], { stdio: 'ignore' });
  // 4. compose
  const inputs = ['-i', path.join(tmp, 'pix.mkv'), '-i', path.join(tmp, 'caps.mkv'), '-i', path.join(tmp, 'end.mp4'), '-i', path.join(tmp, 'mix.wav')];
  P.apps.forEach((a) => inputs.push('-ss', a.r0.toFixed(3), '-t', a.d.toFixed(3), '-i', path.join(tmp, 'app.mp4')));
  const f = ['[0:v]scale=1920:804:flags=neighbor:out_color_matrix=bt709:out_range=tv,format=yuv420p[p0]'];
  let cur = 'p0';
  P.apps.forEach((a, i) => {
    const k = 4 + i, fg = `[${k}:v]setpts=PTS-STARTPTS,scale=1429:804:flags=lanczos,split=2[fa${i}][fb${i}]`;
    f.push(fg, `[fb${i}]scale=1920:804:force_original_aspect_ratio=increase,crop=1920:804,scale=480:201,gblur=sigma=8,scale=1920:804,eq=brightness=-0.12[bg${i}]`, `[bg${i}][fa${i}]overlay=(W-w)/2:0,format=yuva420p${a.fade ? `,fade=t=in:st=0:d=${a.fade}:alpha=1` : ''},setpts=PTS+${a.at.toFixed(3)}/TB[s${i}]`);
    f.push(`[${cur}][s${i}]overlay=enable='between(t,${a.at.toFixed(3)},${(a.at + a.d).toFixed(3)})':eof_action=pass:format=auto[o${i}]`); cur = `o${i}`;
  });
  f.push(`[${cur}]split=2[ga][gb];[gb]scale=480:201,gblur=sigma=3,scale=1920:804:flags=bilinear,eq=brightness=-0.06[bloom];[ga][bloom]blend=all_mode=screen:all_opacity=0.14,eq=contrast=1.05:saturation=1.05,colorbalance=bs=0.02:rh=0.03:bh=-0.02,vignette=PI/5.5[g]`);
  f.push(`[g]pad=1920:1080:0:138:black,format=yuv420p[pad]`);
  f.push(`[2:v]format=yuv420p,fade=t=in:st=0:d=0.7[endc]`, `[endc]setpts=PTS+${P.end.t0.toFixed(3)}/TB[endt]`, `[pad][endt]overlay=enable='gte(t,${P.end.t0.toFixed(3)})':eof_action=pass[withend]`);
  const master = path.join(tmp, 'master.mkv');
  if (!has('master.mkv')) ff([...inputs, '-filter_complex', f.join(';').replace('[withend]', '[v]'), '-map', '[v]', '-t', D.toFixed(3), '-r', '25', '-c:v', 'libx264', '-preset', DRAFT ? 'ultrafast' : 'fast', '-crf', DRAFT ? '20' : '12', '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-an', master]);
  // the film: grain and the frosted caption panels go on last, then the sound
  const capsF = [
    '[0:v]noise=alls=3:allf=t[grain]', '[grain]split=2[base][fb2]', '[fb2]crop=1720:240:100:690,scale=430:60,gblur=sigma=4,scale=1720:240:flags=bilinear,eq=brightness=-0.14:saturation=0.9,format=yuva420p[blur]',
    "[1:v]format=rgba,split=2[capa][capb];[capb]alphaextract,lut=y='min(255,val*2.2)'[mask];[blur][mask]alphamerge[blurm]",
    '[base][blurm]overlay=100:690:format=auto[b2];[b2][capa]overlay=100:690:format=auto[v]',
  ].join(';');
  const fades = `fade=t=in:st=0:d=1.0,fade=t=out:st=${(D - 1.2).toFixed(2)}:d=1.2`;
  const final = (extra, out) => ff(['-i', master, '-i', path.join(tmp, 'caps.mkv'), '-i', path.join(tmp, 'mix.wav'), '-filter_complex', capsF + ';[v]' + (extra ? extra + ',' : '') + fades + '[v2]', '-map', '[v2]', '-map', '2:a', '-t', D.toFixed(3), '-r', '25', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-af', `loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,afade=t=in:st=0:d=1.5,afade=t=out:st=${(D - 2.5).toFixed(2)}:d=2.5`, ...out]);
  // 5. the deliverables
  const kb = (mb) => Math.floor((mb * 8e6) / D / 1000);
  const mp4 = `${outBase}.mp4`, web = `${outBase}-web.mp4`;
  const vb = Math.min(2600, kb(23.4) - 140);
  final('', ['-c:v', 'libx264', '-preset', DRAFT ? 'veryfast' : 'slow', '-b:v', `${vb}k`, '-maxrate', `${Math.round(vb * 1.5)}k`, '-bufsize', `${vb * 3}k`, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mp4]);
  const wb = Math.min(900, kb(8.4) - 96);
  if (!DRAFT) ff(['-i', mp4, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-b:v', `${wb}k`, '-maxrate', `${Math.round(wb * 1.5)}k`, '-bufsize', `${wb * 3}k`, '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-ar', '48000', '-b:a', '96k', '-movflags', '+faststart', web]);
  const vtt = 'WEBVTT\n\n' + P.vtt.sort((a, b) => a.t0 - b.t0).map((c) => `${P.vttT(Math.max(0, c.t0))} --> ${P.vttT(Math.max(c.t0 + 0.5, c.t1))}\n${c.text.replace(/\n/g, ' ')}\n`).join('\n');
  fs.writeFileSync(`${outBase}.vtt`, vtt);
  ff(['-ss', '3.2', '-i', mp4, '-frames:v', '1', '-q:v', '3', `${outBase}-poster.jpg`]);
  if (!FAKE) { fs.mkdirSync('docs/submission', { recursive: true }); final('', ['-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', 'docs/submission/stay-story-film.mp4']); }
  fs.writeFileSync(path.join(tmp, 'plan.json'), JSON.stringify({ D, apps: P.apps, shots: P.shots, pages: P.pages, notes: P.notes, stay: P.stay }, null, 1));
  console.log(`film built: ${mp4} (${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB), ${web} (${(fs.statSync(web).size / 1e6).toFixed(1)} MB), ${D.toFixed(1)} s`);
}

// Checks the finished film: captions against the audio's own onsets, and the caption contrast, frame by frame.
async function verify() {
  const mp4 = process.argv.find((a) => /.mp4$/.test(a)) || path.join(OUTDIR, 'stay-story-film.mp4'), plan = JSON.parse(fs.readFileSync(path.join(wk, FAKE ? 'b-fake' : 'b', 'plan.json'), 'utf8'));
  const a = decode(mp4), env = envelope(a), diffs = [];
  for (const [t0] of plan.stay) { const i0 = Math.max(0, Math.floor((t0 - 0.7) / env.hop)), i1 = Math.floor((t0 + 0.7) / env.hop), win = Array.from(env.v.slice(i0, i1)), base = [...win].sort((x, y) => x - y)[Math.floor(win.length * 0.2)] || 0, thr = Math.max(0.02, 3 * base), k = win.findIndex((v) => v > thr); if (k >= 0) diffs.push(+(((i0 + k) * env.hop) - t0).toFixed(3)); }
  const sorted = [...diffs].sort((x, y) => x - y);
  console.log(`caption start vs audio onset (s, audio minus caption): ${diffs.join(', ')} | median ${sorted[Math.floor(sorted.length / 2)]} | max abs ${Math.max(...diffs.map(Math.abs))}`);
  const { default: sharp } = await import('sharp'); const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const br = await chromium.launch(), bp = await br.newPage({ viewport: { width: 1920, height: 1080 } }); await bp.goto(pathToFileURL(path.resolve('scripts/demo-video/story-caps.html')).href); await bp.evaluate((p) => window.setPages(p), plan.pages);
  const worst = []; for (const pg of plan.pages) { const t = Math.min(pg.t1 - 0.35, pg.words[pg.words.length - 1].t + 0.45); const box = await bp.evaluate((t) => { window.cap(t); const r = document.getElementById('panel').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }, t);
    const f = path.join(wk, 'v.png'); ff(['-ss', t.toFixed(2), '-i', mp4, '-frames:v', '1', '-f', 'image2', f], { stdio: 'ignore' });
    const { data, info } = await sharp(f).raw().toBuffer({ resolveWithObject: true }), bg = [], x0 = Math.round(box[0] + 100), y0 = Math.round(box[1] + 8), x1 = Math.round(box[0] + box[2] - 8), y1 = Math.round(box[1] + box[3] - 8);
    for (const [ya, yb] of [[box[1] + 5, box[1] + 15], [box[1] + box[3] - 15, box[1] + box[3] - 5]]) for (let y = Math.round(ya); y < Math.round(yb); y++) for (let x = x0; x < x1; x++) { const i = (y * info.width + x) * info.channels; bg.push(lum(data[i], data[i + 1], data[i + 2])); }
    bg.sort((x, y) => x - y); const l99 = bg[Math.floor(bg.length * 0.995)] ?? 0; worst.push(+((lum(245, 249, 255) + 0.05) / (l99 + 0.05)).toFixed(1)); }
  await br.close();
  console.log(`caption contrast, text against the brightest 1% of the panel (>= 7 wanted): min ${Math.min(...worst)}, all: ${worst.join(', ')}`);
}

function landing() {
  const sub = (file, pairs) => { let t = fs.readFileSync(file, 'utf8'); for (const [x, y] of pairs) { if (!t.includes(x)) { if (t.includes(y)) continue; throw new Error(`${file}: missing ${x}`); } t = t.split(x).join(y); } fs.writeFileSync(file, t); };
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', 'public/demo/stay-story-film-web.mp4']).toString().trim()), m = Math.floor(dur / 60), sec = Math.round(dur % 60);
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five'][m] + (m === 1 ? ' minute' : ' minutes') + (sec ? ` ${sec} seconds` : '');
  sub('src/components/landing/FilmStage.tsx', [["mp4: '/demo/stay-pix-film-web.mp4', vtt: '/demo/stay-pix-film-v2.vtt', poster: '/demo/stay-pix-film-v2-poster.jpg'", "mp4: '/demo/stay-story-film-web.mp4', vtt: '/demo/stay-story-film.vtt', poster: '/demo/stay-story-film-poster.jpg'"]]);
  sub('scripts/demo-video/landing-assets.mjs', [['public/demo/stay-pix-film-v2.vtt', 'public/demo/stay-story-film.vtt'], ['public/demo/stay-pix-film-v2.mp4', 'public/demo/stay-story-film.mp4'], ['public/demo/stay-pix-film-web.mp4', 'public/demo/stay-story-film-web.mp4'], ['After film.mjs:', 'After story.mjs:'], ["execFileSync('ffmpeg', ['-y',", "if (!fs.existsSync('public/demo/stay-story-film-web.mp4')) execFileSync('ffmpeg', ['-y',"]]);
  sub('tests/unit/landing.test.ts', [['stay-pix-film-v2.vtt', 'stay-story-film.vtt']]);
  sub('tests/e2e/core.spec.ts', [["'/demo/stay-pix-film-v2-poster.jpg')", "'/demo/stay-story-film-poster.jpg')"], ["['/demo/stay-pix-film-web.mp4', '/demo/stay-pix-film-v2.vtt', '/demo/stay-pix-film-v2-poster.jpg']", "['/demo/stay-story-film-web.mp4', '/demo/stay-story-film.vtt', '/demo/stay-story-film-poster.jpg']"]]);
  sub('tests/e2e/landing.spec.ts', [['stay-pix-film-web\\.mp4', 'stay-story-film-web\\.mp4']]);
  sub('src/app/page.tsx', [['Two and a half minutes, one real call.', `${words}: a short story around one real call.`]]);
  execFileSync('node', ['scripts/demo-video/landing-assets.mjs'], { stdio: 'inherit' });
  console.log(`landing: film is ${words}; FilmStage, tests, copy and transcript now point at the story film`);
}

if (STAGE === 'record') await record();
else if (STAGE === 'build') await build();
else if (STAGE === 'landing') landing();
else if (STAGE === 'verify') await verify();
else if (STAGE === 'fixtake') fixtake();
else if (STAGE === 'assets') { const b = creditsUsed(); loadAssets(); for (const l of Object.values(SIDE_LINES)) speech(l); for (const x of BEATS) { if (x.say) speech(x.say); (x.parts || []).forEach(speech); } console.log('assets ready; credits spent:', (creditsUsed() ?? 0) - (b ?? 0)); }
else throw new Error('stage: record | build | landing | assets');
