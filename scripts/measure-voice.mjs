#!/usr/bin/env node
/**
 * Tier-3 measurement against the real AssemblyAI APIs (needs ASSEMBLYAI_API_KEY; writes NOT_RUN without it).
 *
 * What it does: makes speech with AssemblyAI TTS in several accents/languages (so every input has a known reference text),
 * streams it in real time (100 ms frames, 16 kHz) through Universal-3.6 Pro streaming STT with the same settings as the app,
 * and records first-partial time, end-of-speech-to-final time, language detection, WER, and TTS first-audio time.
 *
 * Limits, also written into the JSON: the speech is synthetic (AssemblyAI TTS), not human; one machine, one network; no
 * microphone, no room noise. TTS voices are resampled 24 kHz -> 16 kHz in this script, not in the browser worklet.
 * Cost: about 3 minutes of streaming audio and ~40 short syntheses. Takes about 5 minutes because the TTS account allows only 5 new sessions per minute.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const key = (process.env.ASSEMBLYAI_API_KEY || '').trim();
const sha = execSync('git rev-parse HEAD').toString().trim();
const dirty = execSync('git status --porcelain').toString().trim().length > 0;
const outDir = 'docs/evidence/real-provider';
mkdirSync(outDir, { recursive: true });
const outFile = `${outDir}/measure-${sha.slice(0, 7)}.json`;
if (!key) {
  writeFileSync(outFile, JSON.stringify({ status: 'NOT_RUN', reason: 'no key', gitSha: sha }, null, 2));
  console.log('[measure-voice] NOT_RUN (no ASSEMBLYAI_API_KEY)');
  process.exit(0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const pct = (arr, p) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]);
};
const stats = (arr) => ({ n: arr.length, p50: pct(arr, 50), p95: pct(arr, 95), raw: arr.map(Math.round) });

// voices from the dashboard list (verified accepted by scripts/verify-voices.mjs / the live API)
const V = {
  american: ['Audrey', '49c443a4-8a1d-5f7e-b70b-98bdbd9823c3'],
  british: ['Adrienne', '478badc1-a7eb-5bef-b916-c6e51bd2771e'],
  indian: ['Andrew', 'd9e70892-1ace-5638-b749-dd6a0ba44686'],
  australian: ['Elvia', 'bf7d036b-b18a-5b6b-94d3-d6a6bdd6febe'],
  irish: ['Betty', '5ca091ad-519c-5f3f-89aa-1d2cd2f5a9ed'],
};
const EN = [
  'I keep putting off replying to my landlord about the renewal.',
  'I need to book a dentist appointment before the end of March.',
  'Can you help me start my tax return, I have not opened the folder in 3 weeks.',
  'My meeting with Dr. Patel is on Thursday at 10:30 and I want to prepare.',
  'I want to clean the kitchen but I do not know where to begin.',
];
const OTHER = [
  ['spanish', 'es', '1a48e481-7f02-5e96-bb84-68fcac65c2b2', 'Llevo una semana sin contestar el correo de mi casero.'],
  ['french', 'fr', '04e17f09-99f7-5cac-8903-30d6b3de48fc', 'Je repousse depuis des jours le rendez-vous chez le dentiste.'],
  ['german', 'de', '8659d94f-872e-554f-8152-71a535ec0da5', 'Ich schiebe seit Wochen meine Steuererklärung vor mir her.'],
  ['italian', 'it', '590f46de-c993-5cdf-9aae-1bc70a45a485', 'Devo rispondere alla email del mio padrone di casa ma non so da dove cominciare.'],
  ['portuguese', 'pt', '0739ceb4-e8f2-5b54-bed4-7fe534aa9b95', 'Estou há dias a adiar a marcação da consulta no dentista.'],
];
const NAMES = [
  'I am meeting Priya Venkataraghavan about the Kubernetes migration.',
  'Please remind me to email Siobhan Ó Súilleabháin about the Zoloft refill form.',
  'My supervisor Doctor Xiaoling Zhuang wants the dissertation chapter on heteroskedasticity.',
];

async function getJson(url) {
  const r = await fetch(url, { headers: { Authorization: key } });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  return r.json();
}
const sttToken = async () => (await getJson('https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=300')).token;
const ttsToken = async () => (await getJson('https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=300')).token;

function resample24to16(in24) {
  // 24 kHz -> 16 kHz: 3-tap smoothing, then linear interpolation at ratio 1.5
  const outLen = Math.floor(in24.length / 1.5);
  const out = new Int16Array(outLen);
  const s = (k) => (in24[Math.max(0, k - 1)] + 2 * in24[k] + in24[Math.min(in24.length - 1, k + 1)]) / 4;
  for (let i = 0; i < outLen; i++) {
    const pos = i * 1.5;
    const i0 = Math.floor(pos);
    const f = pos - i0;
    out[i] = Math.round(s(i0) * (1 - f) + s(Math.min(in24.length - 1, i0 + 1)) * f);
  }
  return out;
}

/**
 * One TTS session per voice (the account allows only 5 new TTS sessions per minute, error 3009), several sentences on it.
 * Returns Map(text -> { pcm16k, firstAudioMs }).
 */
async function synthMany(voiceId, language, texts) {
  const token = await ttsToken();
  const q = new URLSearchParams({ token, model_id: 'assemblyai-tts-1', voice_id: voiceId, language, encoding: 'pcm_s16le', sample_rate: '24000' });
  const ws = new WebSocket(`wss://tts.us.assemblyai.com/v1/ws?${q}`);
  const out = new Map();
  let chunks = [];
  let firstAudioMs = null;
  let t0 = 0;
  let idx = -1;
  let resolveNext = null;
  let rejectAll = null;
  const fail = new Promise((_, rej) => (rejectAll = rej));
  const sendNext = () => {
    idx += 1;
    if (idx >= texts.length) return ws.send(JSON.stringify({ type: 'Terminate' })), resolveNext?.();
    chunks = [];
    firstAudioMs = null;
    t0 = now();
    ws.send(JSON.stringify({ type: 'Generate', text: texts[idx] }));
    ws.send(JSON.stringify({ type: 'Flush' }));
  };
  const finished = new Promise((resolve) => (resolveNext = resolve));
  ws.onerror = () => rejectAll(new Error('tts socket error'));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === 'Begin') sendNext();
    else if (m.type === 'Audio') {
      if (firstAudioMs === null) firstAudioMs = now() - t0;
      chunks.push(Buffer.from(m.audio, 'base64'));
    } else if (m.type === 'FlushDone') {
      const buf = Buffer.concat(chunks);
      const in24 = new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length - (buf.length % 2)));
      out.set(texts[idx], { pcm16k: resample24to16(in24), firstAudioMs });
      sendNext();
    } else if (m.type === 'Error') rejectAll(new Error(`tts error ${m.error_code} ${m.error}`));
  };
  const timer = setTimeout(() => rejectAll(new Error('tts timeout')), 60000);
  await Promise.race([finished, fail]).finally(() => clearTimeout(timer));
  try { ws.close(); } catch { /* ignore */ }
  return out;
}
/** Stream audio in real time through the same STT settings as the app. */
async function transcribe(pcm16k, keyterms) {
  const token = await sttToken();
  const q = new URLSearchParams({
    sample_rate: '16000', encoding: 'pcm_s16le', speech_model: 'universal-3-6-pro',
    min_turn_silence: '128', max_turn_silence: '1280', vad_threshold: '0.2', language_detection: 'true', token,
  });
  if (keyterms?.length) q.set('keyterms_prompt', JSON.stringify(keyterms));
  const ws = new WebSocket(`wss://streaming.assemblyai.com/v3/ws?${q}`);
  const turns = new Map(); // turn_order -> { text, final }
  let began = false;
  let t0 = 0;
  let speechEnd = 0;
  let firstPartialMs = null;
  let finalAt = null;
  let lang = null;
  let langConf = null;
  let sttError = null;
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('stt timeout')), 45000);
    ws.onerror = () => reject(new Error('stt socket error'));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'Begin') began = true;
      else if (m.type === 'Turn') {
        const text = String(m.transcript || '').trim();
        if (text && firstPartialMs === null) firstPartialMs = now() - t0;
        if (m.language_code) { lang = m.language_code; langConf = m.language_confidence ?? null; }
        const prev = turns.get(m.turn_order);
        // the first end_of_turn arrival of each turn; the last turn's arrival is when the whole utterance was final
        const firstFinalAt = prev?.firstFinalAt ?? (m.end_of_turn && text ? now() : null);
        turns.set(m.turn_order, { text, final: !!m.end_of_turn || prev?.final === true, firstFinalAt });
        if (m.end_of_turn && text) finalAt = [...turns.entries()].sort((a, b) => b[0] - a[0])[0][1].firstFinalAt;
      } else if (m.type === 'Termination') { clearTimeout(timer); resolve(); }
      else if (m.type === 'Error') { clearTimeout(timer); sttError = new Error(`stt error ${JSON.stringify(m).slice(0, 120)}`); reject(sttError); }
    };
  });
  done.catch(() => {}); // handled below; never an unhandled rejection
  for (let i = 0; i < 250 && !began && !sttError; i++) await sleep(20);
  if (sttError) throw sttError;
  const FRAME = 1600;
  const silence = new Int16Array(FRAME);
  t0 = now();
  for (let i = 0; i < pcm16k.length; i += FRAME) {
    const frame = pcm16k.slice(i, i + FRAME);
    const padded = frame.length < FRAME ? Int16Array.from([...frame, ...new Int16Array(FRAME - frame.length)]) : frame;
    ws.send(padded.buffer.slice(padded.byteOffset, padded.byteOffset + padded.byteLength));
    await sleep(100);
  }
  speechEnd = now();
  // trailing silence until the final turn arrives (cap 4 s)
  for (let i = 0; i < 40 && finalAt === null; i++) {
    ws.send(silence.buffer.slice(0));
    await sleep(100);
  }
  ws.send(JSON.stringify({ type: 'Terminate' }));
  await done.catch(() => {});
  if (sttError) throw sttError;
  try { ws.close(); } catch { /* ignore */ }
  const text = [...turns.entries()].sort((a, b) => a[0] - b[0]).map(([, t]) => t.text).filter(Boolean).join(' ');
  // end of speech = the last loud sample (the TTS clip has its own trailing silence), not the last frame sent
  let lastLoud = pcm16k.length - 1;
  while (lastLoud > 0 && Math.abs(pcm16k[lastLoud]) < 600) lastLoud--;
  const trueSpeechEnd = t0 + lastLoud / 16;
  return { text, firstPartialMs, finalMs: finalAt === null ? null : finalAt - trueSpeechEnd, lang, langConf };
}

const norm = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
function wer(ref, hyp) {
  const r = norm(ref), h = norm(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...new Array(h.length).fill(0)]);
  for (let j = 0; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return r.length ? d[r.length][h.length] / r.length : null;
}

const cases = [];
for (const [accent, [name, id]] of Object.entries(V)) for (const text of EN) cases.push({ category: `english-${accent}`, voice: name, voiceId: id, language: 'english', text, expectLang: 'en' });
for (const [language, iso, id, text] of OTHER) cases.push({ category: `lang-${iso}`, voice: iso, voiceId: id, language, text, expectLang: iso });
const hardTerms = ['Priya Venkataraghavan', 'Kubernetes', 'Siobhan Ó Súilleabháin', 'Zoloft', 'Xiaoling Zhuang', 'heteroskedasticity'];
for (const text of NAMES) {
  cases.push({ category: 'names-without-keyterms', voice: 'Andrew', voiceId: V.indian[1], language: 'english', text, expectLang: 'en' });
  cases.push({ category: 'names-with-keyterms', voice: 'Andrew', voiceId: V.indian[1], language: 'english', text, expectLang: 'en', keyterms: hardTerms });
}

const results = [];
const failures = [];
const started = Date.now();

// phase 1: synthesise, one session per voice, opening at most 5 sessions a minute
const groups = new Map();
for (const c of cases) {
  const k = `${c.voiceId}|${c.language}`;
  if (!groups.has(k)) groups.set(k, { voiceId: c.voiceId, language: c.language, texts: new Set() });
  groups.get(k).texts.add(c.text);
}
const audio = new Map(); // `${voiceId}|${text}` -> { pcm16k, firstAudioMs }
let opened = 0;
for (const g of groups.values()) {
  if (opened > 0) await sleep(13000); // 5 sessions per minute allowance
  opened += 1;
  try {
    const many = await synthMany(g.voiceId, g.language, [...g.texts]);
    for (const [text, a] of many) audio.set(`${g.voiceId}|${text}`, a);
  } catch (e) {
    failures.push({ category: `tts:${g.language}`, text: g.voiceId, error: String(e.message || e).slice(0, 160) });
  }
}

// phase 2: stream each clip through STT, a few at a time
let next = 0;
async function worker() {
  while (next < cases.length) {
    const c = cases[next++];
    const a = audio.get(`${c.voiceId}|${c.text}`);
    if (!a) continue;
    try {
      let stt;
      try {
        stt = await transcribe(a.pcm16k, c.keyterms);
      } catch (e) {
        if (!/concurrent|1008/.test(String(e.message))) throw e;
        await sleep(20000); // the account allows few concurrent streams: wait and retry
        stt = await transcribe(a.pcm16k, c.keyterms);
      }
      await sleep(2500); // let the previous stream close before the next one opens
      results.push({ category: c.category, voice: c.voice, reference: c.text, heard: stt.text, wer: wer(c.text, stt.text), firstPartialMs: stt.firstPartialMs, finalMs: stt.finalMs, detectedLang: stt.lang, langConfidence: stt.langConf, langOk: stt.lang ? stt.lang.toLowerCase().startsWith(c.expectLang) : null, ttsFirstAudioMs: a.firstAudioMs, audioSeconds: +(a.pcm16k.length / 16000).toFixed(2) });
    } catch (e) {
      failures.push({ category: c.category, text: c.text, error: String(e.message || e).slice(0, 160) });
    }
  }
}
await worker(); // one stream at a time: the account's concurrent-session allowance is small
const by = {};
for (const r of results) (by[r.category] ??= []).push(r);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const werByCategory = Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { n: v.length, meanWer: +mean(v.map((x) => x.wer)).toFixed(3), langOk: v.filter((x) => x.langOk).length }]));
const all = results;
const report = {
  status: failures.length ? 'PARTIAL' : 'PASS', tier: 'real-provider', gitSha: sha, dirty, timestamp: new Date().toISOString(),
  sttModel: 'universal-3-6-pro', ttsModel: 'assemblyai-tts-1', sampleRateIn: 16000, sampleRateOut: 24000,
  limits: ['Synthetic TTS speech, not human speech', 'One machine and network; no microphone, no room noise', 'Audio streamed at real-time pace in 100 ms frames; TTS output resampled 24 to 16 kHz in the script', 'Small n per category'],
  runSeconds: Math.round((Date.now() - started) / 1000), cases: cases.length, completed: results.length, failed: failures.length,
  firstPartialMs: stats(all.map((r) => r.firstPartialMs).filter((x) => x !== null)),
  endOfSpeechToFinalMs: stats(all.map((r) => r.finalMs).filter((x) => x !== null)),
  ttsFirstAudioMs: stats(all.map((r) => r.ttsFirstAudioMs).filter((x) => x !== null)),
  werByCategory, results, failures,
  notMeasured: ['end-of-turn to first audible reply (needs the LLM and browser playback)', 'barge-in cutoff', 'human microphone', 'noisy rooms'],
};
writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`[measure-voice] ${report.status}: ${results.length}/${cases.length} cases -> ${outFile}`);
console.log('firstPartial p50/p95', report.firstPartialMs.p50, report.firstPartialMs.p95, '| endOfSpeech->final p50/p95', report.endOfSpeechToFinalMs.p50, report.endOfSpeechToFinalMs.p95, '| tts first audio p50/p95', report.ttsFirstAudioMs.p50, report.ttsFirstAudioMs.p95);
console.log(JSON.stringify(werByCategory));
for (const f of failures.slice(0, 5)) console.log('FAIL', f.category, f.error);
