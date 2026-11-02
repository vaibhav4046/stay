#!/usr/bin/env node
/**
 * T1.1 voice handshake check. For every shortlisted voice, mint a temporary TTS token and open one real TTS WebSocket
 * session, record the `Begin` message or the close code, and write docs/evidence/voices/verify-<date>.json.
 * A voice passes only if the session sends `Begin` (an unknown voice closes with 3012; the old `voice` parameter with 3006).
 *
 *   ASSEMBLYAI_API_KEY=... node scripts/verify-voices.mjs        (or put the key in .env.local)
 *
 * The key is read from the environment and never printed or written. New TTS sessions are limited to 5 a minute, so this
 * waits 13 seconds between voices: about four minutes for the 17 voices. Without a key it writes status NOT_RUN and exits 0.
 * Label (H8): live-provider handshake. It says a voice exists and opens; it says nothing about how it sounds (that is T1.6).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}
const KEY = (process.env.ASSEMBLYAI_API_KEY || '').trim();
const TTS_WS = 'wss://tts.us.assemblyai.com/v1/ws';
const TOKEN_URL = 'https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=60';

/** the shortlist from the master prompt, section 3.4 (the owner's AssemblyAI voice library, 1 Nov 2026) */
export const SHORTLIST = [
  { id: '49c443a4-8a1d-5f7e-b70b-98bdbd9823c3', name: 'Audrey', accent: 'American', gender: 'F', language: 'english' },
  { id: 'ac73d2f0-888d-500a-b5fa-3e98a271ee92', name: 'Ernest', accent: 'American', gender: 'M', language: 'english' },
  { id: '478badc1-a7eb-5bef-b916-c6e51bd2771e', name: 'Adrienne', accent: 'British', gender: 'F', language: 'english' },
  { id: '1edcb3f4-d874-5c38-8839-8a29b854d294', name: 'Aaron', accent: 'British', gender: 'M', language: 'english' },
  { id: 'd9e70892-1ace-5638-b749-dd6a0ba44686', name: 'Andrew', accent: 'Indian English', gender: 'M', language: 'english' },
  { id: '4be3fff4-fe61-5dfb-8b8a-dfd85e84a527', name: 'Joe', accent: 'Indian English', gender: 'M', language: 'english' },
  { id: 'bf7d036b-b18a-5b6b-94d3-d6a6bdd6febe', name: 'Elvia', accent: 'Australian', gender: 'F', language: 'english' },
  { id: 'c6e763ab-1ac0-5a5b-9c38-75f909bc1924', name: 'Steven', accent: 'Australian', gender: 'M', language: 'english' },
  { id: '5ca091ad-519c-5f3f-89aa-1d2cd2f5a9ed', name: 'Betty', accent: 'Irish', gender: 'F', language: 'english' },
  { id: '5db34b17-ccd6-542f-bb62-8b947a04947b', name: 'Aixa', accent: 'Spain', gender: 'F', language: 'spanish' },
  { id: '2aadec9a-80cc-5181-a9fc-f2a9fda0cf50', name: 'Constanza', accent: 'Mexican', gender: 'F', language: 'spanish' },
  { id: '04e17f09-99f7-5cac-8903-30d6b3de48fc', name: 'Agathe', accent: 'France', gender: 'F', language: 'french' },
  { id: '8659d94f-872e-554f-8152-71a535ec0da5', name: 'Amelie', accent: 'Germany', gender: 'F', language: 'german' },
  { id: '590f46de-c993-5cdf-9aae-1bc70a45a485', name: 'Agnese', accent: 'Italy', gender: 'F', language: 'italian' },
  { id: '0739ceb4-e8f2-5b54-bed4-7fe534aa9b95', name: 'Aline', accent: 'Brazilian', gender: 'F', language: 'portuguese' },
  { id: 'aai-jane', name: 'Jane (built in)', accent: 'built in', gender: 'F', language: 'english' },
  { id: 'aai-michael', name: 'Michael (built in)', accent: 'built in', gender: 'M', language: 'english' },
  { id: 'aai-vera', name: 'Vera (built in)', accent: 'built in', gender: 'F', language: 'english' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function mintToken() {
  const r = await fetch(TOKEN_URL, { headers: { Authorization: KEY } });
  if (!r.ok) throw new Error(`token ${r.status}`);
  return (await r.json()).token;
}

/** open one session and resolve with what happened first: Begin, a close code, or a timeout */
function handshake(voice) {
  return new Promise(async (resolve) => {
    const started = Date.now();
    let token;
    try {
      token = await mintToken();
    } catch (e) {
      return resolve({ outcome: 'token_error', detail: String(e.message || e) });
    }
    const q = new URLSearchParams({ token, model_id: 'assemblyai-tts-1', voice_id: voice.id, language: voice.language, encoding: 'pcm_s16le', sample_rate: '24000' });
    const ws = new WebSocket(`${TTS_WS}?${q}`);
    let done = false;
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      resolve({ ...r, ms: Date.now() - started });
    };
    const timer = setTimeout(() => finish({ outcome: 'timeout' }), 8000);
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(String(e.data));
        if (m.type === 'Begin') finish({ outcome: 'begin' });
        else if (m.error || m.type === 'Error') finish({ outcome: 'error_message', detail: JSON.stringify(m).slice(0, 160) });
      } catch { /* binary audio before Begin does not happen; ignore */ }
    };
    ws.onclose = (e) => finish({ outcome: 'closed', closeCode: e.code, detail: String(e.reason || '').slice(0, 120) });
    ws.onerror = () => { /* onclose follows with the code */ };
  });
}

const sha = execSync('git rev-parse --short HEAD').toString().trim();
const date = new Date().toISOString().slice(0, 10);
mkdirSync('docs/evidence/voices', { recursive: true });
const out = `docs/evidence/voices/verify-${date}.json`;

if (!KEY) {
  writeFileSync(out, JSON.stringify({ status: 'NOT_RUN', reason: 'no ASSEMBLYAI_API_KEY', gitSha: sha, date }, null, 2));
  console.log('[verify-voices] NOT_RUN: set ASSEMBLYAI_API_KEY and run: node scripts/verify-voices.mjs');
  process.exit(0);
}

const results = [];
for (const [i, v] of SHORTLIST.entries()) {
  const r = await handshake(v);
  const pass = r.outcome === 'begin';
  results.push({ ...v, pass, ...r });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${v.name} (${v.accent}) ${pass ? '' : `${r.outcome} ${r.closeCode ?? ''} ${r.detail ?? ''}`}`);
  if (i < SHORTLIST.length - 1) await sleep(13_000); // 5 new sessions a minute
}
const failed = results.filter((r) => !r.pass);
writeFileSync(out, JSON.stringify({ status: failed.length ? 'FAIL' : 'PASS', gate: 'T1.1', label: 'live-provider handshake', gitSha: sha, date, at: new Date().toISOString(), checked: results.length, passed: results.length - failed.length, results }, null, 2));
console.log(`[verify-voices] ${results.length - failed.length}/${results.length} voices opened a session -> ${out}`);
process.exit(failed.length ? 1 : 0);
