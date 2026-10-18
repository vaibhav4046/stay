// Streams pre-generated spoken phrases into a LIVE AssemblyAI Voice Agent session (one per language)
// and records what the server actually transcribed and replied. Prints text only; never keys/tokens.
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
if (!KEY || !dir) {
  console.error('need ASSEMBLYAI_API_KEY in .env.local and an audio dir');
  process.exit(1);
}

const VOICE = { en: 'anna', es: 'lola', fr: 'estelle', de: 'juergen', it: 'giovanni', pt: 'rafael' };
const NATIVE = new Set(Object.keys(VOICE));
const CHUNK = 2400 * 2; // 100 ms of 24 kHz PCM16

async function mint() {
  const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=600', {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!r.ok) throw new Error(`token HTTP ${r.status}`);
  return (await r.json()).token;
}

function run(code, mode) {
  return new Promise(async (resolve) => {
    const pcm = fs.readFileSync(path.join(dir, `${code}.pcm`));
    const token = await mint();
    const ws = new WebSocket(`wss://agents.assemblyai.com/v1/ws?token=${encodeURIComponent(token)}`);
    const out = { code, mode, transcript: '', reply: '', ttfaMs: null, errors: [] };
    let sentEnd = 0;
    let streaming = false;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { ws.send(JSON.stringify({ type: 'session.end' })); } catch {}
      setTimeout(() => { try { ws.close(); } catch {} resolve(out); }, 300);
    };
    const hard = setTimeout(finish, 45000);
    const input = { keyterms: ['ADHD', 'Stay'], voice_focus: 'near-field' };
    if (mode === 'pinned' && NATIVE.has(code)) input.language_codes = [code];
    ws.onopen = () =>
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          system_prompt: 'You are Stay, a warm ADHD task-starting companion. Reply in the SAME language the user spoke, in under 25 words, proposing one tiny first step.',
          greeting: 'Hi.',
          input,
          output: { voice: VOICE[code] || 'anna' },
        },
      }));
    ws.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      if (m.type === 'session.error') out.errors.push(`${m.code}: ${String(m.message).slice(0, 80)}`);
      if (m.type === 'session.ready') {
        // wait for greeting to finish, then stream the utterance in real time, then 1.5 s of silence
        setTimeout(async () => {
          streaming = true;
          for (let i = 0; i < pcm.length; i += CHUNK) {
            ws.send(JSON.stringify({ type: 'input.audio', audio: pcm.subarray(i, i + CHUNK).toString('base64') }));
            await new Promise((r) => setTimeout(r, 100));
          }
          sentEnd = Date.now();
          const silence = Buffer.alloc(CHUNK);
          for (let i = 0; i < 20; i++) {
            ws.send(JSON.stringify({ type: 'input.audio', audio: silence.toString('base64') }));
            await new Promise((r) => setTimeout(r, 100));
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

const codes = (only || ['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'ko', 'ja']).filter((c) => fs.existsSync(path.join(dir, `${c}.pcm`)));
for (const code of codes) {
  const r = await run(code, 'auto');
  console.log(`\n[${code}] auto-detect (no language_codes)  ttfa=${r.ttfaMs}ms  errors=${r.errors.join('|') || 'none'}\n  heard: ${r.transcript || '(nothing)'}\n  reply: ${r.reply || '(none)'}`);
}
process.exit(0);
