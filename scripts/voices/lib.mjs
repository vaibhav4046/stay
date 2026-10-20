// Shared helpers for the voice probes. Never prints the key or tokens.
import fs from 'node:fs';
import path from 'node:path';

export function loadEnv() {
  const candidates = [path.resolve(process.cwd(), '.env.local'), path.resolve(process.cwd(), '../stay/.env.local')];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
  if (!process.env.ASSEMBLYAI_API_KEY) throw new Error('ASSEMBLYAI_API_KEY missing');
  return process.env.ASSEMBLYAI_API_KEY;
}

export async function mintToken(key, seconds = 300) {
  const r = await fetch(`https://streaming.assemblyai.com/v3/token?expires_in_seconds=${seconds}&max_session_duration_seconds=600`, { headers: { Authorization: key } });
  if (!r.ok) throw new Error(`token ${r.status}`);
  return (await r.json()).token;
}

export const TTS_URL = 'wss://streaming-tts.assemblyai.com/v1/ws';

/** Open the TTS socket; resolve with {ok, events, error}. Closes after Begin (or error). */
export function tryVoice(token, voice, language, ms = 8000) {
  return new Promise((resolve) => {
    const q = new URLSearchParams({ token, voice, language });
    const ws = new WebSocket(`${TTS_URL}?${q}`);
    const events = [];
    const t = setTimeout(() => { try { ws.close(); } catch {} resolve({ ok: false, events, error: 'timeout' }); }, ms);
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      events.push(m);
      if (m.type === 'Begin') { clearTimeout(t); ws.close(); resolve({ ok: true, events }); }
      if (m.type === 'Error') { clearTimeout(t); ws.close(); resolve({ ok: false, events, error: m }); }
    };
    ws.onerror = () => { clearTimeout(t); resolve({ ok: false, events, error: 'socket error' }); };
    ws.onclose = (e) => { clearTimeout(t); resolve({ ok: events.some((x) => x.type === 'Begin'), events, error: events.find((x) => x.type === 'Error') || `closed ${e.code} ${e.reason}` }); };
  });
}

/**
 * Synthesize text on a fresh TTS connection. Resolves {ok, pcm (Buffer, 24 kHz s16le mono), ttfaMs (Generate sent -> first Audio), connectMs, error}.
 * A bad voice is only rejected at Generate time, so a probe must actually synthesize.
 */
export function synth(token, voice, language, text, ms = 20000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const q = new URLSearchParams({ token, voice, language });
    const ws = new WebSocket(`${TTS_URL}?${q}`);
    const chunks = [];
    let sentAt = 0, firstAt = 0, beginAt = 0, done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { ws.close(); } catch {} resolve({ pcm: Buffer.concat(chunks), ttfaMs: firstAt ? firstAt - sentAt : null, connectMs: beginAt ? beginAt - t0 : null, ...r }); };
    const timer = setTimeout(() => finish({ ok: false, error: 'timeout' }), ms);
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.type === 'Begin') { beginAt = Date.now(); sentAt = Date.now(); ws.send(JSON.stringify({ type: 'Generate', text })); ws.send(JSON.stringify({ type: 'Flush' })); }
      else if (m.type === 'Audio') { if (!firstAt) firstAt = Date.now(); chunks.push(Buffer.from(m.audio, 'base64')); }
      else if (m.type === 'FlushDone') finish({ ok: chunks.length > 0 });
      else if (m.type === 'Error') finish({ ok: false, error: m });
    };
    ws.onerror = () => finish({ ok: false, error: 'socket error' });
    ws.onclose = (e) => finish({ ok: chunks.length > 0, error: chunks.length ? undefined : `closed ${e.code} ${e.reason}` });
  });
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
