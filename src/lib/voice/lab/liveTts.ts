'use client';
import { byokHeaders } from '@/lib/byok/config';

/**
 * One piece of text, spoken live by AssemblyAI TTS-1 in one voice, returned as audio the page can play. Used by the listening
 * test (/lab/voices) so each voice says exactly the same words, generated now, not a stored clip. Opens one TTS session
 * (AssemblyAI allows 5 new ones a minute), so callers generate a few voices and not more.
 */
const TTS_URL = process.env.NEXT_PUBLIC_ASSEMBLYAI_TTS_URL || 'wss://tts.us.assemblyai.com/v1/ws';
const RATE = 24000;

export interface LiveClip {
  voiceId: string;
  language: string;
  text: string;
  samples: Float32Array;
  rate: number;
  /** milliseconds from sending the text to the first audio arriving, as seen by this page */
  firstAudioMs: number | null;
}

async function ttsToken(): Promise<string> {
  const res = await fetch('/api/voice/fast-token', { headers: { ...byokHeaders() }, cache: 'no-store' });
  const j = (await res.json().catch(() => ({}))) as { ttsToken?: string; error?: string };
  if (!res.ok || !j.ttsToken) throw new Error(j.error || `voice token ${res.status}`);
  return j.ttsToken;
}

export async function generateClip(voiceId: string, language: string, text: string): Promise<LiveClip> {
  const token = await ttsToken();
  const q = new URLSearchParams({ token, model_id: 'assemblyai-tts-1', voice_id: voiceId, language, encoding: 'pcm_s16le', sample_rate: String(RATE) });
  return new Promise<LiveClip>((resolve, reject) => {
    const ws = new WebSocket(`${TTS_URL}?${q}`);
    const chunks: Int16Array[] = [];
    let sentAt = 0;
    let firstAudioMs: number | null = null;
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* closed */ }
      if (err) return reject(err);
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Float32Array(total);
      let at = 0;
      for (const c of chunks) {
        for (let i = 0; i < c.length; i++) out[at + i] = c[i] / 0x8000;
        at += c.length;
      }
      resolve({ voiceId, language, text, samples: out, rate: RATE, firstAudioMs });
    };
    const timer = setTimeout(() => finish(new Error('The voice took too long to answer.')), 30_000);
    ws.onmessage = (e) => {
      if (typeof e.data !== 'string') return;
      let m: { type?: string; audio?: string; message?: string };
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.type === 'Begin') {
        sentAt = performance.now();
        ws.send(JSON.stringify({ type: 'Generate', text }));
        ws.send(JSON.stringify({ type: 'Flush' }));
      } else if (m.type === 'Audio' && typeof m.audio === 'string') {
        if (firstAudioMs === null) firstAudioMs = Math.round(performance.now() - sentAt);
        const bin = atob(m.audio);
        const pcm = new Int16Array(bin.length >> 1);
        for (let i = 0; i < pcm.length; i++) {
          let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
          if (v > 32767) v -= 65536;
          pcm[i] = v;
        }
        chunks.push(pcm);
      } else if (m.type === 'FlushDone') {
        finish();
      } else if (m.type === 'Error') {
        finish(new Error(m.message || 'The voice service reported an error.'));
      }
    };
    ws.onclose = (e) => finish(chunks.length ? undefined : new Error(`The voice closed (${e.code}).`));
    ws.onerror = () => { /* onclose follows */ };
  });
}

/** Play a clip; resolves when it ends. */
export function playClip(clip: LiveClip, ctx: AudioContext): { done: Promise<void>; stop: () => void } {
  const buf = ctx.createBuffer(1, clip.samples.length, clip.rate);
  buf.copyToChannel(clip.samples as Float32Array<ArrayBuffer>, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  const done = new Promise<void>((ok) => { src.onended = () => ok(); });
  src.start();
  return { done, stop: () => { try { src.stop(); } catch { /* already ended */ } } };
}
