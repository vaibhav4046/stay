// A simulated human talks to the real Stay app, through the real browser audio path, in either voice engine.
//   - The "human" is an LLM playing a distracted adult with ADHD (Groq key from .env.local), spoken by a neural TTS voice
//     (varied accent, speed, "um"s, trailing off) and mixed with room noise, injected as the microphone stream.
//   - Optional echo: Stay's own reply audio is fed back into the mic, delayed and quieter, WITHOUT the browser's echo
//     cancellation (our injected stream bypasses it), so this is a worst case for self-interruption.
//   - Scenarios: normal turns, a patient pause mid-sentence (must not be talked over), a barge-in, a spoken app command.
// Reports, per turn, time from the end of the human's speech to the first reply audio, measured outside the app.
// Usage: node scripts/voice-e2e/sim-human.mjs <engine: agent|fast> <baseURL> [--echo] [--voice en-GB-RyanNeural] [--turns 4] [--no-llm]
// Needs the app running (npm run start), edge-tts via uv, ffmpeg, GROQ_API_KEY in .env.local.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const engine = args[0] || 'fast';
const base = args[1] || 'http://localhost:3000';
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const ECHO = flag('--echo');
const VOICE = opt('--voice', 'en-GB-RyanNeural');
const TURNS = Number(opt('--turns', 4));
const USE_LLM = !flag('--no-llm');
const work = path.join(process.cwd(), 'test-results', 'sim-human');
fs.mkdirSync(work, { recursive: true });

for (const line of fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Date.now();

// ---- the human's voice ------------------------------------------------------------------------------------------------
function speechPcm(text, voice = VOICE, rate = '+0%') {
  const id = crypto.createHash('sha1').update(voice + rate + text).digest('hex').slice(0, 16);
  const mp3 = path.join(work, id + '.mp3'), pcm = path.join(work, id + '.pcm'), txt = path.join(work, id + '.txt');
  if (fs.existsSync(pcm)) return fs.readFileSync(pcm);
  fs.writeFileSync(txt, text);
  const a = spawnSync('uv', ['run', '--with', 'edge-tts', 'python', path.join(process.cwd(), 'scripts/voice-e2e/tts_voice.py'), mp3, txt, voice, rate]);
  const b = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '24000', '-ac', '1', '-f', 's16le', pcm]);
  if (a.status !== 0 || b.status !== 0) throw new Error('tts failed: ' + text);
  return fs.readFileSync(pcm);
}

// ---- the human's mind -------------------------------------------------------------------------------------------------
async function humanSays(history) {
  const scripted = ['Um, I keep putting off replying to my landlord about the renewal.', 'I do not even know what to write, it feels huge.', 'Okay, maybe. What would the first sentence even be?', 'Yeah. Alright, I will try that now.'];
  if (!USE_LLM || !process.env.GROQ_API_KEY) return scripted[Math.min(history.filter((h) => h.who === 'human').length, scripted.length - 1)];
  const convo = history.map((h) => `${h.who === 'human' ? 'You' : 'Coach'}: ${h.text}`).join('\n');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b', temperature: 0.9, max_tokens: 300, reasoning_effort: 'low', include_reasoning: false,
      messages: [
        { role: 'system', content: 'You are role-playing a real, slightly scattered adult with ADHD talking out loud to a voice coach app about a task you keep avoiding. Say ONE short spoken line (under 22 words): natural, sometimes an "um" or trailing off, sometimes a worry or a tangent. Never mention role-play, never use stage directions or quotes.' },
        { role: 'user', content: convo ? `Conversation so far:\n${convo}\n\nYour next spoken line:` : 'Start the conversation: tell the coach what you have been avoiding (a real everyday task).' },
      ],
    }),
  });
  const j = await res.json();
  return (j.choices?.[0]?.message?.content || scripted[0]).trim().replace(/^["']|["']$/g, '');
}

// ---- browser with an injected microphone --------------------------------------------------------------------------------
let browser;
for (let i = 0; ; i++) { try { browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'], timeout: 60000 }); break; } catch (e) { if (i >= 3) throw e; console.log('browser launch timed out, retrying'); } }
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(({ debug }) => {
  window.__stayFastDebug = debug;
  const ac = new AudioContext({ sampleRate: 24000 });
  const dest = ac.createMediaStreamDestination();
  // room noise: low brown-ish noise, always on
  const nb = ac.createBuffer(1, 48000, 24000), nd = nb.getChannelData(0);
  let s = 0;
  for (let i = 0; i < nd.length; i++) { s = 0.985 * s + 0.015 * (Math.random() * 2 - 1); nd[i] = s * 2.2; }
  const ns = ac.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const ng = ac.createGain(); ng.gain.value = 0.05; ns.connect(ng); ng.connect(dest); ns.start();
  window.__micCtx = ac; window.__micEnd = 0;
  const toBuf = (b64) => { const bin = atob(b64), n = bin.length >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; f[i] = v / 32768; } const buf = ac.createBuffer(1, n, 24000); buf.copyToChannel(f, 0); return buf; };
  // queue: the human's speech plays one piece after another
  window.__say = (b64) => { ac.resume(); const buf = toBuf(b64), src = ac.createBufferSource(); src.buffer = buf; src.connect(dest); const at = Math.max(ac.currentTime + 0.05, window.__micEnd); src.start(at); window.__micEnd = at + buf.duration; return { startsIn: at - ac.currentTime, dur: buf.duration }; };
  // overlay: Stay's own voice leaking back into the mic, quieter, right now
  window.__leak = (b64, gain) => { const src = ac.createBufferSource(); src.buffer = toBuf(b64); const g = ac.createGain(); g.gain.value = gain; src.connect(g); g.connect(dest); src.start(ac.currentTime + 0.02); };
  navigator.mediaDevices.getUserMedia = async () => { await ac.resume(); return dest.stream; };
}, { debug: engine === 'fast' });

// ---- timeline from the sockets and the fast-voice debug events ------------------------------------------------------------
const ev = []; // {t, type, text}
const audioFrames = []; // times of agent audio frames
let playEnd = 0; // when the browser will have finished playing everything received so far
const add = (type, text = '') => ev.push({ t: now(), type, text });
const T0 = now();
function dump() { console.log('\n=== timeline (s) ==='); for (const e of ev) console.log(((e.t - T0) / 1000).toFixed(2).padStart(7), e.type.padEnd(22), String(e.text).slice(0, 100)); console.log('agent audio frames:', audioFrames.length, 'first', ((audioFrames[0] - T0) / 1000).toFixed(2), 'last', ((audioFrames.at(-1) - T0) / 1000).toFixed(2)); }
const MAX_MS = Number(opt('--max', 420)) * 1000;
setTimeout(() => { console.log('TIME LIMIT'); dump(); process.exit(3); }, MAX_MS);
page.on('websocket', (ws) => {
  const url = ws.url();
  const isAgent = url.includes('agents.assemblyai.com'), isTts = url.includes('streaming-tts.assemblyai.com');
  if (!isAgent && !isTts) return;
  ws.on('framereceived', (f) => {
    let m; try { m = JSON.parse(String(f.payload)); } catch { return; }
    const audio = isAgent ? (m.type === 'reply.audio' ? m.data : null) : (m.type === 'Audio' ? m.audio : null);
    if (audio) {
      audioFrames.push(now());
      playEnd = Math.max(playEnd, now()) + (audio.length * 0.75) / 48; // 24 kHz 16-bit mono = 48 bytes per ms
      if (ECHO) setTimeout(() => page.evaluate(([b, g]) => window.__leak(b, g), [audio, 0.25]).catch(() => {}), 110);
      return;
    }
    if (isAgent && ['transcript.user', 'transcript.agent', 'input.speech.started', 'input.speech.stopped', 'reply.started', 'tool.call', 'reply.done', 'session.error'].includes(m.type)) add(m.type, m.text || (m.type === 'tool.call' ? `${m.name} ${JSON.stringify(m.arguments)}` : m.code || ''));
  });
});
page.on('console', (m) => {
  const t = m.text();
  if (!t.startsWith('[fast]')) return;
  const parts = t.split(' ');
  add(parts[2], parts.slice(3).join(' '));
});

// ---- open the app, onboard, choose the engine, start listening --------------------------------------------------------------
page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 160)));
for (let i = 0; ; i++) { try { await page.goto(base + '/app/today', { waitUntil: 'domcontentloaded', timeout: 45000 }); break; } catch (e) { if (i >= 4) throw e; console.log('navigation hung, retrying'); await sleep(2000); } }
await page.evaluate((e) => { localStorage.clear(); localStorage.setItem('stay_fast_voice', e === 'fast' ? '1' : '0'); }, engine);
await page.reload();
await page.getByTestId('care-self_managing').click();
await page.getByTestId('onboarding-ack').click();
await page.getByTestId('onboarding-done').click();
await page.getByTestId('orb-button').waitFor();
await page.getByTestId('orb-button').click();

async function agentQuiet(ms = 1100, max = 25000) {
  const start = now();
  while (now() - start < max) { if (audioFrames.length && now() - Math.max(playEnd, audioFrames.at(-1) || 0) > ms) return true; await sleep(100); }
  return false;
}
const humanLines = [];
async function say(pcm, label = '') { // returns when the human has finished speaking
  humanLines.push(label);
  const b64 = pcm.toString('base64');
  const r = await page.evaluate((b) => window.__say(b), b64);
  const tStart = now() + r.startsIn * 1000;
  const tFull = tStart + r.dur * 1000;
  // synthesized clips carry a short silent tail: the human's speech really ended before the clip did
  let lastLoud = 0;
  for (let i = 0; i + 1 < pcm.length; i += 2) if (Math.abs(pcm.readInt16LE(i)) > 800) lastLoud = i;
  const tEnd = tFull - (pcm.length - lastLoud) / 48;
  await sleep(Math.max(0, tFull - now()));
  return { tStart, tEnd };
}
async function firstAudioAfter(t, max = 15000) {
  const start = now();
  while (now() - start < max) { const f = audioFrames.find((x) => x > t); if (f) return f; await sleep(50); }
  return null;
}
const lastText = (type, after = 0) => [...ev].reverse().find((e) => e.type === type && e.t >= after)?.text || '';
const wordsOf = (s) => new Set(s.toLowerCase().replace(/[^a-z' ]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
const overlap = (a, b) => { const A = wordsOf(a), B = wordsOf(b); if (!A.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / A.size; };

const connected = await (async () => { for (let i = 0; i < 200; i++) { if (audioFrames.length) return true; await sleep(100); } return false; })();
if (!connected) { console.log(`${engine}: never got the greeting audio`); await browser.close(); process.exit(2); }
await agentQuiet();
console.log(`engine=${engine}${ECHO ? ' +echo' : ''} voice=${VOICE} noise=on llm-human=${USE_LLM}`);

const history = [];
const latencies = [];
// ---- scenario 1: ordinary turns --------------------------------------------------------------------------------------------
for (let i = 0; i < TURNS; i++) {
  const text = await humanSays(history);
  const { tEnd } = await say(speechPcm(text), text);
  history.push({ who: 'human', text });
  const f = await firstAudioAfter(tEnd);
  const lat = f ? f - tEnd : null;
  if (lat != null) latencies.push(lat);
  await agentQuiet();
  const said = lastText('transcript.agent', tEnd) || lastText('transcript.agent');
  history.push({ who: 'coach', text: said });
  console.log(`turn ${i + 1}: human "${text.slice(0, 70)}"\n        first audio ${lat == null ? 'NONE' : lat + ' ms'} after the human stopped; Stay: "${said.slice(0, 80)}"`);
  await sleep(600);
}

// ---- scenario 2: a patient pause (must not be talked over) -----------------------------------------------------------------------
{
  const tBefore = now();
  const p1 = await say(speechPcm('I need to, um, send that email to my landlord and, uh...'), 'I need to, um, send that email to my landlord and, uh...');
  const quietStart = now();
  await sleep(2300); // a real ADHD pause
  const talkedInto = audioFrames.some((x) => x > p1.tEnd + 100 && x < quietStart + 2300) || ev.some((e) => e.type === 'reply.started' && e.t > p1.tEnd && e.t < quietStart + 2300);
  const p2 = await say(speechPcm('...and I keep thinking about how to start it.'), '...and I keep thinking about how to start it.');
  const f = await firstAudioAfter(p2.tEnd);
  await agentQuiet();
  console.log(`pause test: Stay ${talkedInto ? 'TALKED INTO the 2.3 s pause' : 'waited through the 2.3 s pause'}; reply to the finished thought after ${f ? f - p2.tEnd + ' ms' : 'NONE'}`);
  void tBefore;
}

// ---- scenario 3: barge-in ---------------------------------------------------------------------------------------------------------
{
  const q = await say(speechPcm('Can you give me a really detailed plan for my whole week please.'), 'Can you give me a really detailed plan for my whole week please.');
  const f = await firstAudioAfter(q.tEnd);
  if (f) {
    await sleep(900); // Stay is now mid-reply (its audio is still playing)
    const playingLeft = Math.max(0, Math.round(playEnd - now()));
    const interrupt = 'Wait, stop, just one tiny step please.';
    const b = await say(speechPcm(interrupt), interrupt);
    const noticed = ev.find((e) => e.type === 'input.speech.started' && e.t >= b.tStart - 100);
    const heardAt = await (async () => { for (let i = 0; i < 80; i++) { const h = ev.find((e) => e.type === 'transcript.user' && e.t >= b.tStart); if (h) return h; await sleep(100); } return null; })();
    await agentQuiet(1200);
    console.log(`barge-in: Stay still had ${playingLeft} ms of speech queued when I interrupted; it noticed me ${noticed ? noticed.t - b.tStart + ' ms' : 'NEVER'} after I started talking; it heard: "${(heardAt?.text || '').slice(0, 60)}"; then said: "${lastText('transcript.agent', b.tStart).slice(0, 70)}"`);
  } else console.log('barge-in: no reply to interrupt');
}

// ---- scenario 4: a spoken app command ---------------------------------------------------------------------------------------------
{
  const c = await say(speechPcm('Park it: I need to call the dentist.'), 'Park it: I need to call the dentist.');
  const f = await firstAudioAfter(c.tEnd);
  await agentQuiet();
  const tool = ev.find((e) => e.type === 'tool.call' && e.t > c.tStart);
  const parked = await page.evaluate(() => localStorage.getItem('stay_parking_lot'));
  console.log(`command: tool=${tool ? tool.text : 'NONE'}; parked in app=${parked ? JSON.parse(parked).map((p) => p.text).join(' | ') : 'nothing'}; reply after ${f ? f - c.tEnd + ' ms' : 'NONE'}`);
}

// ---- echo / self-hearing: any transcript that is not the human's own words is Stay hearing itself, or noise -------------------------------------
{
  const userLines = ev.filter((e) => e.type === 'transcript.user');
  const strays = userLines.filter((u) => u.text.trim().split(/\s+/).length >= 2 && Math.max(0, ...humanLines.filter(Boolean).map((h) => overlap(u.text, h))) < 0.5);
  const unprompted = Math.max(0, ev.filter((e) => e.type === 'reply.started').length - humanLines.filter(Boolean).length - 1);
  console.log(`stray transcripts (not the human's words): ${strays.length} of ${userLines.length}${strays.length ? ': ' + JSON.stringify(strays.map((x) => x.text.slice(0, 60))) : ''}; unprompted replies: ${unprompted}`);
}

if (flag('--dump')) dump();
latencies.sort((a, b) => a - b);
console.log(`\nSUMMARY engine=${engine}${ECHO ? '+echo' : ''}: ordinary-turn first audio ${latencies.length ? `median ${latencies[Math.floor(latencies.length / 2)]} ms (n=${latencies.length}; ${latencies.join(', ')})` : 'none'}`);
await browser.close();
