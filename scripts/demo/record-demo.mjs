// Records the Stay demo video from the real app, with real audio.
//   - The "user" is a synthesized voice injected into the browser's microphone stream (labelled as simulated on screen).
//   - Stay's replies are the real AssemblyAI text-to-speech audio, rebuilt from the frames the page received, placed where the
//     browser would have played them (back to back, cut where the person interrupts).
//   - A narrator (another synthesized voice) explains each scene. Captions and chapter titles are drawn into the page.
// Output: <outDir>/stay-demo.mp4 (1280x720, h264 + aac) and <outDir>/stay-demo-captions.srt
// Usage: node scripts/demo/record-demo.mjs [baseURL] [outDir]     (needs uv + edge-tts and ffmpeg on PATH)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'https://stay-two-swart.vercel.app';
const outDir = process.argv[3] || path.join(process.cwd(), 'demo-out');
fs.mkdirSync(outDir, { recursive: true });
const work = path.join(os.tmpdir(), 'stay-demo-work');
fs.mkdirSync(work, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

const HUMAN_VOICE = 'en-GB-RyanNeural';
const NARRATOR_VOICE = 'en-GB-SoniaNeural';

function tts(text, voice, rate = '+0%') {
  const id = crypto.createHash('sha1').update(voice + rate + text).digest('hex').slice(0, 16);
  const mp3 = path.join(work, id + '.mp3'), pcm = path.join(work, id + '.pcm'), txt = path.join(work, id + '.txt');
  if (fs.existsSync(pcm)) return fs.readFileSync(pcm);
  fs.writeFileSync(txt, text);
  const a = spawnSync('uv', ['run', '--with', 'edge-tts', 'python', path.join(process.cwd(), 'scripts/voice-e2e/tts_voice.py'), mp3, txt, voice, rate]);
  const b = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '24000', '-ac', '1', '-f', 's16le', pcm]);
  if (a.status !== 0 || b.status !== 0) throw new Error('tts failed: ' + text.slice(0, 40));
  return fs.readFileSync(pcm);
}
const pcmMs = (b) => b.length / 48;

// ---- 1. sign in once, off camera: onboarding done, fast voice on ----------------------------------------------------------
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'], timeout: 90000 });
const setup = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const sp = await setup.newPage();
await sp.goto(base + '/app/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await sp.evaluate(() => localStorage.clear());
await sp.reload();
await sp.getByTestId('care-self_managing').click();
await sp.getByTestId('onboarding-ack').click();
await sp.getByTestId('onboarding-done').click();
await sp.getByTestId('orb-button').waitFor();
const storageState = await setup.storageState();
await setup.close();

// ---- 2. the recording context ----------------------------------------------------------------------------------------------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, storageState, recordVideo: { dir: work, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const video0 = now();
const T = () => now() - video0;

await page.addInitScript(() => {
  // microphone: a stream we control, plus quiet room noise
  const ac = new AudioContext({ sampleRate: 24000 });
  const dest = ac.createMediaStreamDestination();
  const nb = ac.createBuffer(1, 48000, 24000), nd = nb.getChannelData(0);
  let s = 0;
  for (let i = 0; i < nd.length; i++) { s = 0.985 * s + 0.015 * (Math.random() * 2 - 1); nd[i] = s * 2.2; }
  const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const ng = ac.createGain(); ng.gain.value = 0.03; ns.connect(ng); ng.connect(dest); ns.start();
  window.__micEnd = 0;
  const toBuf = (b64) => { const bin = atob(b64), n = bin.length >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; f[i] = v / 32768; } const buf = ac.createBuffer(1, n, 24000); buf.copyToChannel(f, 0); return buf; };
  window.__say = (b64) => { ac.resume(); const buf = toBuf(b64), src = ac.createBufferSource(); src.buffer = buf; src.connect(dest); const at = Math.max(ac.currentTime + 0.05, window.__micEnd); src.start(at); window.__micEnd = at + buf.duration; return { startsIn: at - ac.currentTime, dur: buf.duration }; };
  navigator.mediaDevices.getUserMedia = async () => { await ac.resume(); return dest.stream; };

  // on-screen helpers: captions, chapter titles, title cards
  const css = document.createElement('style');
  css.textContent = `
    #demo-cap{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:72%;z-index:2147483647;pointer-events:none;
      background:rgba(24,28,26,.9);color:#fff;font:600 20px/1.35 'DM Sans',system-ui,sans-serif;padding:11px 20px;border-radius:18px;text-align:center;opacity:0;transition:opacity .25s}
    #demo-cap small{display:block;font:700 11px/1 'DM Sans',system-ui,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#7fd3cd;margin-bottom:5px}
    #demo-chap{position:fixed;left:28px;top:70px;z-index:2147483647;pointer-events:none;background:#006A67;color:#fff;font:700 15px/1 'DM Sans',system-ui,sans-serif;padding:9px 15px;border-radius:999px;opacity:0;transition:opacity .3s}
    #demo-card{position:fixed;inset:0;z-index:2147483647;background:#FAF8F5;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:'DM Sans',system-ui,sans-serif;color:#212422;opacity:0;pointer-events:none;transition:opacity .4s}
    #demo-card h1{font-size:76px;margin:0;font-weight:700;letter-spacing:-.03em} #demo-card p{font-size:26px;margin:18px 0 0;color:#626B66;max-width:900px;line-height:1.35} #demo-card .u{margin-top:26px;font-weight:700;color:#006A67;font-size:24px}`;
  const mount = () => {
    document.head.appendChild(css);
    for (const id of ['demo-cap', 'demo-chap', 'demo-card']) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.__cap = (who, text) => { const e = document.getElementById('demo-cap'); if (!e) return; if (!text) { e.style.opacity = 0; return; } e.innerHTML = `${who ? `<small>${who}</small>` : ''}${text}`; e.style.opacity = 1; };
  window.__chap = (t) => { const e = document.getElementById('demo-chap'); if (!e) return; if (!t) { e.style.opacity = 0; return; } e.textContent = t; e.style.opacity = 1; };
  window.__card = (h, p, u) => { const e = document.getElementById('demo-card'); if (!e) return; if (!h) { e.style.opacity = 0; return; } e.innerHTML = `<h1>${h}</h1>${p ? `<p>${p}</p>` : ''}${u ? `<div class="u">${u}</div>` : ''}`; e.style.opacity = 1; };
});

// ---- audio bookkeeping ----------------------------------------------------------------------------------------------------------
const humanClips = [], narrationClips = [], stayTimeline = []; // {pos(ms), pcm}
let playhead = 0; // when the browser would be playing the next received Stay frame
const frames = [];
const srt = []; // {start, end, text}
page.on('websocket', (ws) => {
  const url = ws.url();
  const isAgent = url.includes('agents.assemblyai.com'), isTts = url.includes('streaming-tts.assemblyai.com');
  if (!isAgent && !isTts) return;
  ws.on('framereceived', (f) => {
    let m; try { m = JSON.parse(String(f.payload)); } catch { return; }
    const b64 = isAgent ? (m.type === 'reply.audio' ? m.data : null) : (m.type === 'Audio' ? m.audio : null);
    if (!b64) return;
    const pcm = Buffer.from(b64, 'base64');
    const t = T();
    playhead = Math.max(playhead, t);
    stayTimeline.push({ pos: playhead, pcm });
    playhead += pcmMs(pcm);
    frames.push(t);
  });
});
const quietFor = async (ms = 900, max = 30000) => {
  const start = now();
  while (now() - start < max) { if (frames.length && T() > playhead + ms) return; await sleep(100); }
};
const cutStay = (atMs) => { // the person interrupted: what Stay had not yet played never reaches their ears
  for (let i = stayTimeline.length - 1; i >= 0; i--) if (stayTimeline[i].pos >= atMs) stayTimeline.splice(i, 1);
  playhead = Math.min(playhead, atMs);
};

async function say(text, { label = 'You (simulated voice)', rate = '+0%', hold = 0 } = {}) {
  const pcm = tts(text, HUMAN_VOICE, rate);
  const b64 = pcm.toString('base64');
  const r = await page.evaluate((b) => window.__say(b), b64);
  const start = T() + r.startsIn * 1000;
  humanClips.push({ pos: start, pcm });
  await sleep(r.startsIn * 1000);
  await page.evaluate(([w, t]) => window.__cap(w, t), [label, text]).catch(() => {});
  await sleep(pcmMs(pcm) + hold);
  await page.evaluate(() => window.__cap('', '')).catch(() => {});
  return { start, end: start + pcmMs(pcm) };
}
async function narrate(text) {
  const pcm = tts(text, NARRATOR_VOICE, '-4%');
  const start = T() + 150;
  narrationClips.push({ pos: start, pcm });
  srt.push({ start, end: start + pcmMs(pcm), text });
  return { done: sleep(150 + pcmMs(pcm) + 250), ms: pcmMs(pcm) };
}
const chap = (t) => page.evaluate((x) => window.__chap(x), t).catch(() => {});
const card = (h, p, u) => page.evaluate(([a, b, c]) => window.__card(a, b, c), [h, p, u]).catch(() => {});

// ---- 3. the film -------------------------------------------------------------------------------------------------------------------
await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-testid="hero-orb"] canvas', { timeout: 30000 });
await card('Stay', 'A voice companion for adults with ADHD.<br>It does not talk over your pauses.', 'Built on AssemblyAI streaming speech-to-text and text-to-speech');
await sleep(500);
let n = await narrate('Stay is a voice companion for adults with ADHD. It helps you start the thing you have been avoiding, and it does not talk over your pauses.');
await n.done;
await card('');
await sleep(700);

// landing: words become shapes
await chap('1  Say what is in the way');
n = await narrate('Type or say what is in the way, and the dots become it. Overwhelmed is a tangle. Stuck is a staircase with one dot on the first step. Taxes are a coin.');
const input = page.getByTestId('hero-input');
await input.click();
for (const w of ['overwhelmed', 'first step', 'my taxes']) {
  await input.fill('');
  await input.pressSequentially(w, { delay: 110 });
  await sleep(2600);
}
await n.done;

// the app, by voice
await page.goto(base + '/app/today', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.getByTestId('orb-button').waitFor();
await sleep(1200);
await chap('2  Talk to it');
n = await narrate('In the app you just talk. This is a simulated person, so you can see exactly what happens. Replies start about a second after you stop.');
await page.getByTestId('orb-button').click();
await n.done;
await quietFor(1000, 20000); // the greeting
await say('Um, I keep putting off replying to my landlord about the renewal.');
await quietFor();
await sleep(600);

await chap('3  It waits through your pauses');
n = await narrate('People with ADHD pause mid-thought. Most voice assistants jump in. Stay waits.');
await n.done;
await say('I need to, um, send that email, and, uh...', { hold: 2300 });
await say('...and I keep thinking about how to even start it.');
await quietFor();
await sleep(500);

await chap('4  Interrupt it any time');
await say('Can you give me a really detailed plan for my whole week please.');
await sleep(1100); // Stay is mid-reply
const tCut = T() + 700;
const cutPromise = (async () => { await sleep(700); cutStay(T()); })();
await say('Wait, stop, just one tiny step please.');
await cutPromise;
await quietFor();
await sleep(500);

await chap('5  Do things by voice');
await say('Park it: I need to call the dentist.');
await quietFor();
await sleep(500);
n = await narrate('Parked, in one second. It can also start timers, run routines, set check-ins and keep a list for today.');

await page.getByTestId('orb-button').click(); // stop listening before the typed scenes
await n.done;

await chap('6  Brain dump');
// the chips only show on the idle screen; after the voice scenes a plan may be showing, so start from a clean screen
if (!(await page.getByTestId('chip-dump').isVisible().catch(() => false))) {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1500);
}
await page.getByTestId('chip-dump').click();
await page.getByTestId('dump-input').pressSequentially('email the landlord, pay the council tax, call mum someday, the bins', { delay: 28 });
n = await narrate('Everything on your mind, in any order. Stay picks one thing to start, a few for today, and the rest for later. No overdue, no guilt.');
await page.getByTestId('dump-sort').click();
await page.getByTestId('dump-result').waitFor({ timeout: 30000 });
await n.done;
await sleep(1200);
await page.getByTestId('dump-result').getByRole('button', { name: 'Done', exact: true }).click();
await sleep(900);
await page.getByTestId('today-check').first().click();
await sleep(1500);

await chap('7  Routines and check-ins');
n = await narrate('Routines give you one visible next step, each with its own timer. Check-ins nudge you softly, even when the tab is in the background.');
await page.getByTestId('chip-routines').click();
await page.getByTestId('routine-start-morning').click();
await sleep(2200);
await page.getByTestId('routine-next').click();
await sleep(2200);
await n.done;
await page.keyboard.press('Escape');
await sleep(500);

await chap('8  Measured, not promised');
await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.getByTestId('measured').scrollIntoViewIfNeeded();
// the table sits inside a collapsed section: open it so the numbers are what the video shows
await page.locator('[data-testid="measured"] details').first().evaluate((d) => { d.open = true; });
await sleep(400);
await page.locator('[data-testid="measured"] details table').first().scrollIntoViewIfNeeded();
await sleep(600);
n = await narrate('We measured it with a simulated speaker. Replies in about 1.2 seconds, against 2.5 for the managed voice we replaced. It waited through the pause, noticed an interruption in about half a second, and never answered its own voice. We have not measured ChatGPT or Gemini, so we claim nothing against them.');
await n.done;
await sleep(500);
await chap('');
await card('Stay', 'Start the thing you have been avoiding.', 'stay-two-swart.vercel.app');
n = await narrate('Stay. Open source, local-first, and built on AssemblyAI.');
await n.done;
await sleep(800);

const totalMs = T() + 500;
const videoPath = await page.video().path();
await ctx.close();
await browser.close();

// ---- 4. mix the audio and mux ---------------------------------------------------------------------------------------------------
function track(clips, gain) {
  const buf = Buffer.alloc(Math.ceil(totalMs * 48 / 2) * 2 + 96000);
  for (const c of clips) {
    const off = Math.max(0, Math.round(c.pos * 48 / 2) * 2);
    for (let i = 0; i + 1 < c.pcm.length && off + i + 1 < buf.length; i += 2) {
      const v = Math.max(-32768, Math.min(32767, buf.readInt16LE(off + i) + Math.round(c.pcm.readInt16LE(i) * gain)));
      buf.writeInt16LE(v, off + i);
    }
  }
  return buf;
}
const mix = Buffer.alloc(Math.ceil(totalMs * 48 / 2) * 2 + 96000);
for (const [clips, gain] of [[narrationClips, 1.0], [humanClips, 0.85], [stayTimeline, 0.95]]) {
  const t = track(clips, gain);
  for (let i = 0; i + 1 < mix.length; i += 2) mix.writeInt16LE(Math.max(-32768, Math.min(32767, mix.readInt16LE(i) + t.readInt16LE(i))), i);
}
const mixPath = path.join(work, 'mix.pcm');
fs.writeFileSync(mixPath, mix);

const out = path.join(outDir, 'stay-demo.mp4');
const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', videoPath, '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', mixPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'medium', '-c:a', 'aac', '-b:a', '160k', '-shortest', out], { encoding: 'utf8' });
if (mux.status !== 0) throw new Error('ffmpeg failed: ' + mux.stderr);

const stamp = (ms) => { const d = new Date(Math.max(0, ms)); return d.toISOString().slice(11, 23).replace('.', ','); };
fs.writeFileSync(path.join(outDir, 'stay-demo-captions.srt'), srt.map((s, i) => `${i + 1}\n${stamp(s.start)} --> ${stamp(s.end)}\n${s.text}\n`).join('\n'));
console.log(`demo written: ${out} (${(totalMs / 1000).toFixed(0)} s)`);
