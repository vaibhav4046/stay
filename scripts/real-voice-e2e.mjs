#!/usr/bin/env node
/**
 * Real end-to-end test with AssemblyAI's own voices as the human speaker.
 *
 * What is real: the app (a production build on localhost), AssemblyAI streaming speech-to-text, the language model,
 * AssemblyAI text-to-speech, and the browser's audio playback. What is synthetic: the "person" is AssemblyAI TTS speech
 * played into the page's microphone stream (a stand-in for getUserMedia), so no human voice and no room acoustics.
 *
 * It runs one call: a task is said in Indian English, Stay answers, the "person" talks over Stay, Stay stops, then the
 * person switches to Spanish and Stay should answer in Spanish. It records timings, transcripts and WebSocket targets,
 * screenshots, and a silent screen recording (Chromium does not record audio) to docs/evidence/real-e2e/.
 *
 * Usage: set ASSEMBLYAI_API_KEY (and have the app running with its own keys), then
 *   node scripts/real-voice-e2e.mjs http://localhost:3120
 */
import { execSync } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'http://localhost:3120';
const key = (process.env.ASSEMBLYAI_API_KEY || '').trim();
const sha = execSync('git rev-parse --short HEAD').toString().trim();
const OUT = 'docs/evidence/real-e2e';
mkdirSync(OUT, { recursive: true });
if (!key) {
  writeFileSync(`${OUT}/run-${sha}.json`, JSON.stringify({ status: 'NOT_RUN', reason: 'no key' }, null, 2));
  console.log('NOT_RUN (no ASSEMBLYAI_API_KEY)');
  process.exit(0);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 1. the "person": AssemblyAI voices speaking known sentences ------------------------------------------------------
const CLIPS = {
  task: { voice: '5ca091ad-519c-5f3f-89aa-1d2cd2f5a9ed', language: 'english', text: 'I keep putting off replying to my landlord about the renewal.', who: 'Betty (Irish English)' },
  interrupt: { voice: '49c443a4-8a1d-5f7e-b70b-98bdbd9823c3', language: 'english', text: 'Wait, stop. Actually, can we just make it smaller?', who: 'Audrey (American English)' },
  spanish: { voice: '1a48e481-7f02-5e96-bb84-68fcac65c2b2', language: 'spanish', text: 'Hola, ahora necesito empezar mi declaración de impuestos, pero no sé por dónde empezar.', who: 'Aday (Spanish)' },
};

async function ttsToken() {
  const r = await fetch('https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=300', { headers: { Authorization: key } });
  return (await r.json()).token;
}

function wav24k(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function synth(voice, language, text) {
  const q = new URLSearchParams({ token: await ttsToken(), model_id: 'assemblyai-tts-1', voice_id: voice, language, encoding: 'pcm_s16le', sample_rate: '24000' });
  const ws = new WebSocket(`wss://tts.us.assemblyai.com/v1/ws?${q}`);
  const chunks = [];
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('tts timeout')), 30000);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'Begin') { ws.send(JSON.stringify({ type: 'Generate', text })); ws.send(JSON.stringify({ type: 'Flush' })); }
      else if (m.type === 'Audio') chunks.push(Buffer.from(m.audio, 'base64'));
      else if (m.type === 'FlushDone') { clearTimeout(t); ws.send(JSON.stringify({ type: 'Terminate' })); resolve(); }
      else if (m.type === 'Error') { clearTimeout(t); reject(new Error(m.error)); }
    };
    ws.onerror = () => reject(new Error('tts socket'));
  });
  try { ws.close(); } catch { /* ignore */ }
  const lead = Buffer.alloc(24000 * 2 * 0.25); // a quarter second of silence before speech
  const pcm = Buffer.concat([lead, ...chunks]);
  // the last loud sample, not the end of the file: TTS audio carries its own trailing silence
  const s16 = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length - (pcm.length % 2)));
  let last = s16.length - 1;
  while (last > 0 && Math.abs(s16[last]) < 600) last--;
  return { b64: wav24k(pcm).toString('base64'), seconds: pcm.length / 48000, speechSeconds: last / 24000 };
}

console.log('making the speaker clips with AssemblyAI TTS...');
const clips = {};
for (const [name, c] of Object.entries(CLIPS)) clips[name] = { ...c, ...(await synth(c.voice, c.language, c.text)) };
console.log('clips ready; waiting a minute so the 5-voice-sessions-per-minute allowance is fully free for the call...');
await sleep(65000);

// ---- 2. the real app in a real browser, with the clips as the microphone ----------------------------------------------
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  // NO_VIDEO=1 skips the screen recording, which loads the machine and can delay the audio thread
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...(process.env.NO_VIDEO ? {} : { recordVideo: { dir: OUT, size: { width: 1280, height: 720 } } }) });
const page = await ctx.newPage();
const recStart = Date.now(); // the screen recording starts with the page
// every chat message, the first time its text appears, with the time: the captions of the recording
await page.addInitScript(() => {
  window.__stayCaps = [];
  const seen = new Set();
  const scan = () => document.querySelectorAll('[data-testid="chat-user-message"],[data-testid="chat-agent-message"]').forEach((el) => {
    const who = el.getAttribute('data-testid') === 'chat-user-message' ? 'person' : 'stay';
    const text = (el.querySelector('.bubble')?.textContent || '').trim();
    const key = who + '|' + text;
    if (!text || seen.has(key)) return;
    seen.add(key);
    window.__stayCaps.push({ t: Date.now(), who, text });
  });
  new MutationObserver(scan).observe(document, { childList: true, subtree: true, characterData: true });
});

const sockets = [];
page.on('websocket', (ws) => sockets.push(ws.url().replace(/token=[^&]+/, 'token=REDACTED')));
const consoleErrors = [];
const apiCalls = [];
page.on('response', (r) => { if (r.url().includes('/api/')) apiCalls.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 160)));

const connectWarnings = []; // the app retries a connection that fails before it is ready; what it said when it did
page.on('console', (m) => m.type() === 'warning' && /connection failed/.test(m.text()) && connectWarnings.push(m.text().slice(0, 200)));
const fastLog = [];
page.on('console', (m) => {
  const txt = m.text();
  if (txt.startsWith('[fast]')) fastLog.push(`${Date.now()} ${txt.slice(0, 110)}`);
});
await page.addInitScript(() => {
  window.__stayFastDebug = true; // the app's own timing marks and event log (src/lib/voice/fastSocket.ts mark())
  // when does each microphone frame actually leave the browser for AssemblyAI, and how loud is it?
  window.__sttFrames = [];
  const origSend = WebSocket.prototype.send;
  WebSocket.prototype.send = function (d) {
    try {
      if (this.url.includes('streaming.assemblyai.com') && d && typeof d !== 'string') {
        const s = new Int16Array(d.buffer ? d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength) : d);
        let peak = 0;
        for (let i = 0; i < s.length; i += 8) peak = Math.max(peak, Math.abs(s[i]));
        window.__sttFrames.push([performance.now(), peak, s.length]);
      }
    } catch { /* measurement only */ }
    return origSend.call(this, d);
  };
  const md = navigator.mediaDevices;
  const orig = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    if (c && c.audio) {
      const ac = new AudioContext();
      await ac.resume();
      const dest = ac.createMediaStreamDestination();
      const o = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = 0;
      o.connect(g).connect(dest);
      o.start();
      window.__micCtx = ac;
      window.__micDest = dest;
      return dest.stream;
    }
    return orig(c);
  };
  window.__say = async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    const buf = await window.__micCtx.decodeAudioData(bytes.buffer);
    const src = window.__micCtx.createBufferSource();
    src.buffer = buf;
    src.connect(window.__micDest);
    const startedAt = performance.now();
    src.start();
    return { startedAt, seconds: buf.duration };
  };
});

const state = () => page.evaluate(() => ({ now: performance.now(), s: document.querySelector('[data-testid="call-state"]')?.textContent ?? '', drive: Number(document.querySelector('[data-testid="signal-wave"]')?.getAttribute('data-drive') ?? 0) }));
async function waitFor(pred, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    const s = await state();
    if (pred(s)) return s;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for ${label} (last state: ${s.s})`);
    await sleep(40);
  }
}
const say = (name) => page.evaluate((b) => window.__say(b), clips[name].b64);
const results = { gitSha: sha, tier: 'real provider + real browser; synthetic speaker injected as the microphone', base: BASE, steps: [], failures: [] };
const log = (msg) => console.log(msg);

try {
  await page.goto(BASE + '/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/01-today.png` });

  await page.getByTestId('call-direct-stay-btn').click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/02-ringing.png` });
  const consent = page.getByRole('button', { name: /start talking/i });
  if (await consent.isVisible({ timeout: 8000 }).catch(() => false)) await consent.click();
  await waitFor((s) => s.s !== '' && s.s !== 'Ringing…', 20000, 'the call to connect');
  log('connected; waiting for the greeting to finish');
  await waitFor((s) => s.s === 'Speaking', 15000, 'greeting to start').catch(() => undefined);
  await waitFor((s) => s.s === 'Listening', 30000, 'greeting to finish');
  await page.screenshot({ path: `${OUT}/03-connected.png` });

  // --- turn 1: the task
  log('person says the task');
  const t1 = await say('task');
  const speechEnd1 = t1.startedAt + clips.task.speechSeconds * 1000;
  const sp1 = await waitFor((s) => s.s === 'Speaking', 30000, 'Stay to start replying');
  const reply1Ms = Math.round(sp1.now - speechEnd1);
  const drive1 = await waitFor((s) => s.drive > 0.05, 8000, 'audible output').catch(() => null);
  // mic-to-socket lag: when the last loud frame left the browser, against when the clip's last loud sample played
  const frames = await page.evaluate(() => window.__sttFrames);
  const loud = frames.filter(([t, peak]) => t >= t1.startedAt && peak > 600);
  const lastLoudSentAt = loud.length ? loud[loud.length - 1][0] : null;
  const gaps = frames.slice(1).map((f, i) => f[0] - frames[i][0]).filter((g) => g < 5000).sort((a, b) => a - b);
  const micLag = {
    lastLoudFrameSentMsAfterEndOfSpeech: lastLoudSentAt === null ? null : Math.round(lastLoudSentAt - speechEnd1),
    frameIntervalMs: { p50: Math.round(gaps[Math.floor(gaps.length * 0.5)] || 0), p95: Math.round(gaps[Math.floor(gaps.length * 0.95)] || 0), max: Math.round(gaps[gaps.length - 1] || 0) },
    framesSent: frames.length,
  };
  const wallEnd1 = Date.now() - (sp1.now - speechEnd1); // wall-clock time of the end of speech
  const marks1 = await page.evaluate(() => (window.__stayFastMarks || []).map(([n, t]) => [n, t]));
  const afterEnd = marks1.filter(([, t]) => t >= wallEnd1 - 50).map(([n, t]) => `${n.split(' ')[0]}@+${Math.round(t - wallEnd1)}ms`);
  results.steps.push({ step: 'task', spoken: clips.task.text, speaker: clips.task.who, endOfSpeechToStaySpeakingMs: reply1Ms, audibleOutputDetected: Boolean(drive1), appMarksAfterEndOfSpeech: afterEnd, micToSocket: micLag });
  if (process.env.ONLY_TASK) {
    console.log(JSON.stringify({ endOfSpeechToStaySpeakingMs: reply1Ms, appMarksAfterEndOfSpeech: afterEnd, micToSocket: micLag }, null, 2));
    throw new Error('ONLY_TASK: stopped after the first turn on purpose');
  }
  await page.screenshot({ path: `${OUT}/04-stay-speaking.png` }); // then straight to the interruption: replies are short, so do not wait

  // --- turn 2: talk over Stay
  log('person talks over Stay');
  const still = await state();
  const t2 = await say('interrupt');
  const stopped = await waitFor((s) => s.s !== 'Speaking', 6000, 'Stay to stop speaking').catch(() => null);
  results.steps.push({ step: 'barge-in', spoken: clips.interrupt.text, speaker: clips.interrupt.who, wasSpeakingBefore: still.s === 'Speaking', speakStartToStayStoppedMs: stopped ? Math.round(stopped.now - t2.startedAt) : null });
  await page.screenshot({ path: `${OUT}/05-interrupted.png` });
  await waitFor((s) => s.s === 'Speaking', 30000, 'reply to the interruption').catch(() => undefined);
  await waitFor((s) => s.s === 'Listening', 40000, 'reply to the interruption to finish');
  await page.waitForTimeout(1500);

  // --- turn 3: Spanish
  log('person switches to Spanish');
  const t3 = await say('spanish');
  const speechEnd3 = t3.startedAt + clips.spanish.speechSeconds * 1000;
  // The first word ("Hola,") can be answered before the rest is said, so wait for the whole sentence to play, then for the reply to it.
  await waitFor((s) => s.now > speechEnd3 + 1000, 25000, 'the whole Spanish sentence to play');
  const at3 = await state();
  const wallEnd3 = Date.now() - (at3.now - speechEnd3);
  await waitFor((s) => s.s === 'Speaking', 40000, 'Stay to reply in Spanish').catch(() => undefined);
  await page.waitForTimeout(700); // the first sound of the reply is marked a moment after the state flips
  const marks3 = await page.evaluate(() => (window.__stayFastMarks || []).map(([n, t]) => [n, t]));
  const after3 = marks3.filter(([, t]) => t >= wallEnd3 - 50).map(([n, t]) => n.split(' ')[0] + '@+' + Math.round(t - wallEnd3) + 'ms');
  const firstAudio3 = marks3.find(([n, t]) => n.startsWith('aud1') && t >= wallEnd3 - 50);
  results.steps.push({ step: 'spanish', spoken: clips.spanish.text, speaker: clips.spanish.who, endOfSpeechToFirstAudioMs: firstAudio3 ? Math.round(firstAudio3[1] - wallEnd3) : null, appMarksAfterEndOfSpeech: after3 });
  await page.screenshot({ path: `${OUT}/06-spanish.png` });
  await waitFor((s) => s.s === 'Listening', 90000, 'Spanish reply to finish');
  await page.waitForTimeout(800);

  const lines = await page.evaluate(() => [...document.querySelectorAll('[data-testid="chat-user-message"],[data-testid="chat-agent-message"]')].map((e) => ({ who: e.getAttribute('data-testid') === 'chat-user-message' ? 'person' : 'stay', text: (e.textContent || '').trim().slice(0, 400) })));
  results.transcript = lines;
  results.playback = await page.evaluate(() => window.__stayPlayback ?? null); // underflows = times the speaker ran dry mid-reply (an audible gap)
  const heardAll = lines.some((l) => l.who === 'person' && /impuestos/i.test(l.text));
  results.steps[results.steps.length - 1].heardWholeSentence = heardAll;
  if (!heardAll) results.failures.push('the Spanish sentence was not heard whole: only part of it reached the transcript');
  results.fastEventLogTail = fastLog.slice(-60);
  results.websockets = [...new Set(sockets)];
  results.managedAgentSocketOpened = sockets.some((u) => u.includes('agents.assemblyai.com'));
  results.ttsLanguages = [...new Set(sockets.filter((u) => u.includes('tts.us.assemblyai.com')).map((u) => (u.match(/language=(\w+)/) || [])[1]))];
  results.sttOpened = sockets.some((u) => u.includes('streaming.assemblyai.com'));
  results.consoleErrors = consoleErrors.slice(0, 5);
  results.connectRetries = connectWarnings;
  await page.getByTestId('call-end').click();
  const callEndAt = Date.now();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/07-ended.png` });
  if (!process.env.NO_VIDEO) {
    // for the recording: back in the chat, ask for two panels by typing, the way a person would
    for (const phrase of ['show my history', 'open brain dump']) {
      await page.waitForTimeout(1500);
      await page.getByTestId('task-input').pressSequentially(phrase, { delay: 55 });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2200);
    }
    writeFileSync(`${OUT}/captions.json`, JSON.stringify({ recStart, callEndAt, caps: await page.evaluate(() => window.__stayCaps) }, null, 2));
  }
} catch (e) {
  results.failures.push(String(e.message || e));
  results.fastEventLogTail = fastLog.slice(-40);
  results.transcript = await page.evaluate(() => [...document.querySelectorAll('[data-testid="chat-user-message"],[data-testid="chat-agent-message"]')].map((e) => ({ who: e.getAttribute('data-testid') === 'chat-user-message' ? 'person' : 'stay', text: (e.textContent || '').trim().slice(0, 400) }))).catch(() => null);
  results.ttsLanguages = [...new Set(sockets.filter((u) => u.includes('tts.us.assemblyai.com')).map((u) => (u.match(/language=(\w+)/) || [])[1]))];
  results.apiCalls = apiCalls.slice(-12);
  results.consoleErrors = consoleErrors.slice(0, 8);
  results.connectRetries = connectWarnings;
  results.websockets = [...new Set(sockets)];
  results.transportLabel = await page.getByTestId('transport-badge').first().textContent().catch(() => null);
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => undefined);
}

const video = await page.video()?.path();
await ctx.close();
await browser.close();
if (video) {
  try { renameSync(video, `${OUT}/demo-silent.webm`); } catch { /* keep the generated name */ }
}
results.status = results.failures.length ? 'FAIL' : 'PASS';
results.limits = ['Synthetic speaker (AssemblyAI TTS) played into the page microphone stream; no human voice, no room acoustics', 'One run, one machine, one network', 'Screen recording has no audio track (Chromium does not capture it)', 'Timings are polled from the call screen about every 40 ms; end of speech is the last loud sample of the clip; reply time is until the call screen first says Speaking'];
writeFileSync(`${OUT}/run-${sha}.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ status: results.status, steps: results.steps, ttsLanguages: results.ttsLanguages, managedAgentSocketOpened: results.managedAgentSocketOpened, failures: results.failures }, null, 2));
