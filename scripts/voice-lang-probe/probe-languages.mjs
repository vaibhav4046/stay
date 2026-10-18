// Streams pre-generated spoken phrases into LIVE AssemblyAI Voice Agent sessions (one per language) and measures
// (1) transcription accuracy against the known sentence (character error rate), (2) whether the reply is in the same
// script/language, (3) time to first reply audio. Prints text only; never keys or tokens.
// Usage: node scripts/voice-lang-probe/probe-languages.mjs <audio_dir> [codes,comma,separated]
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
for (const line of fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const KEY = process.env.ASSEMBLYAI_API_KEY;
const dir = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(',') : null;
const PIN = process.env.PIN === '1'; // pin input.language_codes to the spoken language (what "speak Polish" does in the app)
if (!KEY || !dir) {
  console.error('need ASSEMBLYAI_API_KEY in .env.local and an audio dir');
  process.exit(1);
}
const phrases = JSON.parse(fs.readFileSync(path.join(dir, 'phrases.json'), 'utf8'));
const VOICE = { en: 'anna', es: 'lola', fr: 'estelle', de: 'juergen', it: 'giovanni', pt: 'rafael' };
const CHUNK = 2400 * 2; // 100 ms of 24 kHz PCM16
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');
function cer(ref, hyp) {
  const a = [...norm(ref)], b = [...norm(hyp)];
  if (!a.length) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] / a.length;
}
// script of the dominant letters, to check the reply stayed in the speaker's language family
const SCRIPTS = {
  Latin: /\p{Script=Latin}/u, Cyrillic: /\p{Script=Cyrillic}/u, Arabic: /\p{Script=Arabic}/u, Hebrew: /\p{Script=Hebrew}/u,
  Devanagari: /\p{Script=Devanagari}/u, Bengali: /\p{Script=Bengali}/u, Tamil: /\p{Script=Tamil}/u, Telugu: /\p{Script=Telugu}/u,
  Thai: /\p{Script=Thai}/u, Greek: /\p{Script=Greek}/u, Hangul: /\p{Script=Hangul}/u, Han: /\p{Script=Han}/u, Kana: /[\p{Script=Hiragana}\p{Script=Katakana}]/u,
};
const dominant = (s) => {
  let best = 'Latin', n = 0;
  for (const [k, re] of Object.entries(SCRIPTS)) {
    const c = [...s].filter((ch) => re.test(ch)).length;
    if (c > n) [best, n] = [k, c];
  }
  return best;
};
const EXPECT_SCRIPT = { hi: 'Devanagari', ja: 'Kana', zh: 'Han', ko: 'Hangul', ru: 'Cyrillic', uk: 'Cyrillic', ar: 'Arabic', he: 'Hebrew', bn: 'Bengali', ta: 'Tamil', te: 'Telugu', th: 'Thai', el: 'Greek' };

async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', { headers: { Authorization: `Bearer ${KEY}` } });
  if (!r.ok) throw new Error(`token HTTP ${r.status}`);
  return (await r.json()).token;
}

function run(code) {
  return new Promise(async (resolve) => {
    const pcm = fs.readFileSync(path.join(dir, `${code}.pcm`));
    const token = await mint();
    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(token)}`);
    const out = { code, transcript: '', reply: '', ttfaMs: null, errors: [] };
    let sentEnd = 0, streaming = false, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {}
      setTimeout(() => { try { ws.close(); } catch {} resolve(out); }, 300);
    };
    const hard = setTimeout(finish, 40000);
    ws.onopen = () =>
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          system_prompt: 'You are Stay, a warm ADHD task-starting companion. Reply in the SAME language the user spoke, in under 25 words, proposing one tiny first step.',
          greeting: 'Hi.',
          input: { keyterms: ['ADHD', 'Stay'], voice_focus: 'near-field', ...(PIN ? { language_codes: [code] } : {}) },
          output: { voice: VOICE[code] || 'anna' },
        },
      }));
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'session.error') out.errors.push(`${m.code}`);
      if (m.type === 'session.ready') {
        setTimeout(async () => {
          streaming = true;
          for (let i = 0; i < pcm.length; i += CHUNK) {
            ws.send(JSON.stringify({ type: 'input.audio', audio: pcm.subarray(i, i + CHUNK).toString('base64') }));
            await sleep(100);
          }
          sentEnd = Date.now();
          const silence = Buffer.alloc(CHUNK).toString('base64');
          for (let i = 0; i < 20; i++) {
            ws.send(JSON.stringify({ type: 'input.audio', audio: silence }));
            await sleep(100);
          }
        }, 2500);
      }
      if (m.type === 'transcript.user' && streaming) out.transcript = (out.transcript + ' ' + m.text).trim();
      if (m.type === 'reply.audio' && sentEnd && out.ttfaMs === null) out.ttfaMs = Date.now() - sentEnd;
      if (m.type === 'transcript.agent' && streaming) {
        out.reply = m.text;
        clearTimeout(hard);
        finish();
      }
    };
  });
}

const codes = (only || Object.keys(phrases)).filter((c) => fs.existsSync(path.join(dir, `${c}.pcm`)));
const rows = [];
for (const code of codes) {
  let r;
  try { r = await run(code); } catch (e) { r = { code, transcript: '', reply: '', ttfaMs: null, errors: [String(e).slice(0, 40)] }; }
  const err = r.transcript ? cer(phrases[code], r.transcript) : 1;
  const want = EXPECT_SCRIPT[code] || 'Latin';
  const replyOk = r.reply ? dominant(r.reply) === want : false;
  rows.push({ code, cer: err, replyOk, ttfa: r.ttfaMs, errors: r.errors });
  console.log(`${PIN ? '[pinned] ' : ''}${code.padEnd(3)} CER ${(err * 100).toFixed(0).padStart(3)}%  reply-in-${want}: ${replyOk ? 'yes' : 'NO '}  ttfa ${String(r.ttfaMs ?? '-').padStart(5)}ms  ${r.errors.length ? 'errors=' + r.errors.join('|') : ''}\n    heard: ${r.transcript.slice(0, 90) || '(nothing)'}`);
}
const good = rows.filter((r) => r.cer <= 0.2 && r.replyOk);
console.log(`\nVERIFIED (CER <= 20% and reply in the same script): ${good.length}/${rows.length}: ${good.map((r) => r.code).join(' ')}`);
console.log(`NOT VERIFIED: ${rows.filter((r) => !good.includes(r)).map((r) => `${r.code}(${(r.cer * 100).toFixed(0)}%${r.replyOk ? '' : ',reply'})`).join(' ') || 'none'}`);
fs.writeFileSync(path.join(dir, PIN ? 'lang-results-pinned.json' : 'lang-results.json'), JSON.stringify(rows, null, 2));
process.exit(0);
