#!/usr/bin/env node
/**
 * "Pix tests Stay": records a real call in the real app (the real model, Stay's real AssemblyAI voice) with an impatient user, Pix, whose
 * voice is an ElevenLabs voice spoken into the microphone, adds Pix's voice-over, a few sound effects and a quiet music bed (all
 * ElevenLabs, all synthetic), and composes the film next to the Pix scene (original art, scripts/demo-video/scene.html).
 *
 *   node scripts/demo-video/film.mjs http://localhost:3120        needs ELEVENLABS_API_KEY in .env.local and ffmpeg; nothing is played aloud
 *   -> public/demo/stay-pix-film-v2.mp4  and  docs/submission/stay-pix-film-v2-captioned.mp4
 *
 * Honest by construction: every Stay reply is the app's real reply from that run; the film is only built if no beat fails.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const BASE = (process.argv[2] || 'http://localhost:3120').replace(/\/$/, '');
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error('ELEVENLABS_API_KEY is not set');
const VOICE = 'FGY2WhTYpPnrIDTdsKH5'; // Laura: young, quick, a little sarcastic
const work = path.join(os.tmpdir(), 'stay-film');
const OUT = 'docs/evidence/film';
fs.mkdirSync(work, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

// ---- ElevenLabs: speech (24 kHz PCM), sound effects and music (mp3), each cached by its text -----------------------------------
function curlTo(file, url, body) {
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
function speech(text) {
  const f = path.join(work, hash('s' + VOICE + text) + '.pcm');
  if (!fs.existsSync(f) && !curlTo(f, `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=pcm_24000`, { text, model_id: 'eleven_flash_v2_5', voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.4 } })) throw new Error('speech failed: ' + text);
  return f;
}
function effect(prompt, seconds) {
  const f = path.join(work, hash('e' + prompt + seconds) + '.mp3');
  if (!fs.existsSync(f) && !curlTo(f, 'https://api.elevenlabs.io/v1/sound-generation', { text: prompt, duration_seconds: seconds, prompt_influence: 0.5 })) throw new Error('effect failed: ' + prompt);
  return f;
}
const wavOf = (pcm) => { const w = pcm.replace(/\.pcm$/, '.wav'); if (!fs.existsSync(w)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', pcm, w]); return w; };

// ---- the beats: what Pix says to Stay, and what he says to us ----------------------------------------------------------------
const BEATS = [
  { vo: "I'm Pix. I have a paper due at nine tomorrow, and my thumb is stuck on Instagram. Let's see if Stay can actually get me started.", title: { text: 'Pix has a paper due at nine.', sub: 'And a thumb stuck on Instagram.' } },
  { say: "I have a paper due at nine tomorrow and I'm just scrolling reels." },
  { say: "Don't give me a lecture. Just tell me what to do right now.", title: { text: 'No lecture.', sub: 'One small step.' } },
  { say: 'Okay. Set a one minute timer.', sfx: 'ding', timer: true, title: { text: 'It starts the clock.', sub: 'You asked, so it did.' } },
  { say: 'Why would I use this and not just ask a regular chatbot?', title: { text: 'Why not a regular chatbot?', sub: 'It acts, it waits, it comes back.' } },
  { say: "Remember that I scroll when I'm anxious.", title: { text: 'It remembers.', sub: 'Only what you ask it to.' } },
  { vo: "Okay. Document open. One sentence. Two." },
  { waitStay: 75, title: { text: 'It comes back.', sub: 'When the time is up.' } },
  { say: 'Yeah. I wrote two lines.' },
  { say: 'Show my report.', closes: 'inline-reports-close', hold: 3.5, title: { text: 'It kept the score.', sub: 'The block is logged.' } },
  { vo: "It kept it short. It started the clock when I asked. It came back when time was up. And it remembers me. That's the difference. Now I'm going to finish this paper.", end: true },
];

// ---- the browser: Pix's voice goes into the microphone; Stay's voice is recorded from the page; nothing plays aloud ----------------
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'], timeout: 60000 });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-GB', recordVideo: { dir: work, size: { width: 1280, height: 720 } }, permissions: ['microphone'] });
const page = await ctx.newPage();
const recStart = now();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
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
  window.__micEnd = 0;
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
  // every AudioContext that plays to the speakers also feeds a recorder, so the film has Stay's real voice
  window.__aud = { list: [] };
  const orig = AudioNode.prototype.connect;
  const recs = new WeakMap();
  AudioNode.prototype.connect = function (d, ...rest) {
    const r = orig.call(this, d, ...rest);
    try {
      if (d && d === this.context.destination && this.context !== ac) {
        let md = recs.get(this.context);
        if (!md) {
          md = this.context.createMediaStreamDestination();
          recs.set(this.context, md);
          const rec = new MediaRecorder(md.stream, { mimeType: 'audio/webm;codecs=opus' });
          const entry = { chunks: [], startedAt: Date.now(), rec };
          rec.ondataavailable = (e) => e.data.size && entry.chunks.push(e.data);
          rec.start(500);
          window.__aud.list.push(entry);
        }
        orig.call(this, md);
      }
    } catch { /* recording only */ }
    return r;
  };
});
await page.goto(BASE + '/app/today');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('stay_fast_voice', '1'); localStorage.setItem('stay:mic_consented:v1', '1'); });
await page.reload();
await page.getByTestId('care-self_managing').click();
await page.getByTestId('onboarding-ack').click();
await page.getByTestId('onboarding-done').click();

const status = () => page.evaluate(() => document.querySelector('[data-testid="orb-status"]')?.textContent?.trim() || '');
const bubbles = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="chat-agent-message"] .bubble')].map((e) => e.textContent.trim()));
const bubbleCount = () => page.evaluate(() => document.querySelectorAll('[data-testid="chat-agent-message"]').length);
async function until(fn, max) { const t0 = now(); while (now() - t0 < max) { if (await fn()) return true; await sleep(150); } return false; }
async function settled(max) {
  const t0 = now();
  let since = 0, seen = await bubbleCount();
  while (now() - t0 < max) {
    const n = await bubbleCount();
    const listening = (await status()) === 'Listening';
    if (n !== seen || !listening) { seen = n; since = 0; } else if (!since) since = now();
    if (since && now() - since >= 1500) return true;
    await sleep(150);
  }
  return false;
}

const cues = [], titles = [], clips = [];
const trail = []; // how many Stay bubbles there were, and when, so a line that arrives by itself (the check-in) can be found afterwards
const poll = setInterval(async () => { try { trail.push({ t: now(), n: await bubbleCount() }); } catch { /* the page is closing */ } }, 400);
let timerSetAt = 0;
const rel = (ms) => (ms - recStart) / 1000;
const warm = () => { for (const b of BEATS) { if (b.vo) speech(b.vo); if (b.say) speech(b.say); if (b.interruptWith) speech(b.interruptWith); } };
warm(); // every line is synthesized before the call starts, so the take has no gaps from the voice service
const sfxFiles = { scroll: effect('quick phone scroll flick, soft swipe, short', 1), ding: effect('gentle soft notification chime, single note', 1) };
const music = effect('minimal calm ambient piano and soft pad, slow, warm, no drums, no vocals, loopable background music', 22);
const whoosh = effect('very soft airy whoosh transition', 1);

let lastSpeakEnd = 0;
async function speak(text, kind) {
  const pcm = speech(text);
  const b64 = fs.readFileSync(pcm).toString('base64');
  const r = await page.evaluate((b) => window.__say(b), b64);
  const t = now() + r.startsIn * 1000;
  clips.push({ file: wavOf(pcm), at: t, vol: 0.95 });
  cues.push({ t: rel(t), end: rel(t) + r.dur, who: 'person', text, kind });
  lastSpeakEnd = t + r.dur * 1000;
  await sleep(r.startsIn * 1000 + r.dur * 1000 + 250);
}
async function voiceOver(text) {
  const pcm = speech(text);
  const dur = fs.statSync(pcm).size / 2 / 24000;
  const t = now() + 150;
  clips.push({ file: wavOf(pcm), at: t, vol: 1.0 });
  cues.push({ t: rel(t), end: rel(t) + dur, who: 'person', text, kind: 'vo' });
  await sleep(150 + dur * 1000 + 500);
}

await page.getByTestId('orb-button').click();
await until(async () => (await status()) === 'Listening', 40000);
await settled(40000); // the greeting
await sleep(800);

let failed = null;
for (const [i, b] of BEATS.entries()) {
  if (b.title) titles.push({ t: rel(now()) + (b.vo ? 0.3 : -0.2), end: rel(now()) + 4.2, ...b.title });
  if (b.vo) { await voiceOver(b.vo); if (b.end) break; continue; }
  if (b.sfx === 'scroll') { clips.push({ file: sfxFiles.scroll, at: now() + 100, vol: 0.5 }); await sleep(900); continue; }
  if (b.waitStay) {
    // Stay speaks first when the timer ends. It waits for a quiet moment in the talk, so wait here until it has spoken (or give up honestly).
    const due = timerSetAt + 55_000;
    if (now() < due - 3000) await sleep(due - 3000 - now());
    const nAtDue = [...trail].reverse().find((x) => x.t <= due)?.n ?? (await bubbleCount());
    const came = await until(async () => (await bubbleCount()) > nAtDue, b.waitStay * 1000);
    if (!came) { failed = 'Stay did not come back when the timer ended'; break; }
    await settled(60000);
    const all = await bubbles();
    const reply = all.slice(nAtDue).join(' ');
    if (!reply || /too many requests|could not reach my thinking/i.test(reply)) { failed = `the check-in was not a clean reply: ${reply.slice(0, 100)}`; break; }
    const plays = await page.evaluate(() => window.__stayPlays.slice());
    const firstPlay = plays.find((x) => x > due - 500) ?? plays[plays.length - 1] ?? 0;
    cues.push({ t: Math.max(rel(firstPlay) - 0.05, rel(now()) - 2 - reply.split(/\s+/).length * 0.33), end: rel(now()) - 1.3, who: 'stay', text: reply });
    continue;
  }
  const before = await bubbleCount();
  await sleep(500 + Math.random() * 600); // the person's own beat
  await speak(b.say, 'say');
  if (b.interruptWith) {
    await until(async () => (await status()) === 'Speaking', 14000);
    await sleep(1100);
    if ((await status()) !== 'Speaking') { failed = 'the interruption came after Stay had finished'; break; } // the voice-over says it stopped: only film it if it was speaking
    await speak(b.interruptWith, 'say');
  }
  const got = await until(async () => (await bubbleCount()) > before, 30000);
  const ok = got && (await settled(60000));
  const all = await bubbles();
  const reply = all.slice(before).join(' ');
  if (!ok || !reply || /too many requests|could not reach my thinking/i.test(reply)) { failed = `beat ${i} ("${b.say}") had no clean reply: ${reply.slice(0, 120)}`; break; }
  const plays = await page.evaluate(() => window.__stayPlays.slice());
  const firstPlay = plays.find((x) => x > lastSpeakEnd - 200) ?? plays[plays.length - 1] ?? 0;
  const tEnd = now();
  cues.push({ t: Math.max(rel(firstPlay) - 0.05, rel(tEnd) - 2 - reply.split(/\s+/).length * 0.33), end: rel(tEnd) - 1.3, who: 'stay', text: reply });
  if (b.sfx === 'ding') clips.push({ file: sfxFiles.ding, at: now() - 300, vol: 0.6 });
  if (b.timer) timerSetAt = now();
  if (b.hold) await sleep(b.hold * 1000);
  if (b.closes) { await page.getByTestId(b.closes).click().catch(() => undefined); await sleep(600); }
}
clearInterval(poll);
const total = Math.ceil(rel(now()) + 1.5);

// Stay's voice, as the page played it
const stayAudio = [];
const rec = await page.evaluate(async () => {
  const out = [];
  for (const e of window.__aud.list) {
    try { e.rec.stop(); } catch { /* already stopped */ }
    await new Promise((r) => setTimeout(r, 300));
    const blob = new Blob(e.chunks, { type: 'audio/webm' });
    const buf = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    out.push({ startedAt: e.startedAt, b64: btoa(bin) });
  }
  return out;
});
for (const [i, e] of rec.entries()) { const f = path.join(work, `stay-${i}.webm`); fs.writeFileSync(f, Buffer.from(e.b64, 'base64')); stayAudio.push({ file: f, at: e.startedAt, vol: 1.0 }); }
await ctx.close();
const appVideo = await page.video().path();
await browser.close();
fs.writeFileSync(`${OUT}/film-run.json`, JSON.stringify({ at: new Date().toISOString(), failed, cues, titles, errors }, null, 1));
if (failed) { console.error('FILM NOT BUILT: ' + failed); process.exit(1); }
console.log(`recorded ${total} s, ${cues.length} cues, ${stayAudio.length} Stay audio parts`);

// ---- Pix: the scene, driven by the same cues -----------------------------------------------------------------------------------
titles.push({ t: total - 5.5, end: total, text: 'Stay. Start small.', sub: 'stay-two-swart.vercel.app' });
const scene = { cues, titles, happyAt: total - 6 };
const sbrowser = await chromium.launch();
const sctx = await sbrowser.newContext({ viewport: { width: 640, height: 720 }, recordVideo: { dir: work, size: { width: 640, height: 720 } } });
const spage = await sctx.newPage();
const sStart = now();
await spage.addInitScript((s) => { window.__SCENE = s; }, scene);
await spage.goto(pathToFileURL('scripts/demo-video/scene.html').href);
const zero = await spage.evaluate(() => Date.now());
await spage.waitForTimeout(total * 1000 + 500);
await sctx.close();
const sceneVideo = await spage.video().path();
await sbrowser.close();
const lead = Math.max(0, (zero - sStart) / 1000 - 0.05);

// ---- the bars, the captions, the mix --------------------------------------------------------------------------------------------
const bar = (text, size, y, fill = '#c5d6e6', weight = 600) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="180"><rect width="100%" height="100%" fill="#070b11"/><text x="60" y="${y}" font-family="Arial" font-size="${size}" font-weight="${weight}" fill="${fill}">${text.replace(/&/g, '&amp;')}</text></svg>`)).png().toBuffer();
fs.writeFileSync(`${work}/top.png`, await bar('Pix tests Stay: an impatient user, a real voice call', 54, 112, '#eef6ff', 700));
fs.writeFileSync(`${work}/bottom.png`, await bar('Real app, real model, one call. Pix’s voice, effects and music are synthetic (ElevenLabs). Stay: AssemblyAI. Pix: original art.', 26, 160));
const stamp = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = (s % 60).toFixed(3).padStart(6, '0'); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${x}`; };
const vtt = 'WEBVTT\n\n' + cues.map((c) => `${stamp(Math.max(0, c.t))} --> ${stamp(c.end)}\n${c.who === 'stay' ? 'Stay' : 'Pix'}: ${c.text.replace(/\n/g, ' ')}\n`).join('\n');
fs.mkdirSync('public/demo', { recursive: true });
fs.mkdirSync('docs/submission', { recursive: true });
fs.writeFileSync('public/demo/stay-pix-film-v2.vtt', vtt);

const audio = [...stayAudio, ...clips].map((a) => ({ ...a, delay: Math.max(0, Math.round(a.at - recStart)) }));
const musicIdx = 4 + audio.length;
const filters = [
  '[0:v]scale=1280:720,setsar=1[app]',
  '[1:v]scale=640:720:flags=neighbor,setsar=1[pix]',
  '[pix][app]hstack=inputs=2[row]',
  '[2:v][row][3:v]vstack=inputs=3[v]',
  ...audio.map((a, i) => `[${4 + i}:a]aformat=channel_layouts=stereo,adelay=${a.delay}|${a.delay},volume=${a.vol}[a${i}]`),
  `[${musicIdx}:a]aformat=channel_layouts=stereo,volume=0.10,afade=t=in:st=0:d=3,afade=t=out:st=${Math.max(1, total - 4)}:d=4[mus]`,
  `${audio.map((_, i) => `[a${i}]`).join('')}[mus]amix=inputs=${audio.length + 1}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`,
].join(';');
const inputs = ['-i', appVideo, '-ss', lead.toFixed(2), '-i', sceneVideo, '-loop', '1', '-i', `${work}/top.png`, '-loop', '1', '-i', `${work}/bottom.png`, ...audio.flatMap((a) => ['-i', a.file]), '-stream_loop', '-1', '-i', music];
void whoosh;
const enc = ['-map', '[v]', '-map', '[aout]', '-t', String(total), '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-r', '25', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart'];
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
ff([...inputs, '-filter_complex', filters, ...enc, 'public/demo/stay-pix-film-v2.mp4']);
const capFilters = filters.replace('[v]', "[vv];[vv]subtitles=public/demo/stay-pix-film-v2.vtt:original_size=1920x1080:force_style='FontName=Arial,FontSize=9,PrimaryColour=&H00FFFFFF,OutlineColour=&H00111111,BorderStyle=1,Outline=1,Alignment=2,MarginV=16'[v]");
ff([...inputs, '-filter_complex', capFilters, ...enc, 'docs/submission/stay-pix-film-v2-captioned.mp4']);
ff(['-ss', '8', '-i', 'public/demo/stay-pix-film-v2.mp4', '-frames:v', '1', '-q:v', '3', 'public/demo/stay-pix-film-v2-poster.jpg']);
console.log('film built: public/demo/stay-pix-film-v2.mp4 and docs/submission/stay-pix-film-v2-captioned.mp4');
