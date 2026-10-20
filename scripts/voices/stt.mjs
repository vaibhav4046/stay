// Speech-to-text scoring helpers for the voice benchmark.
import { sleep } from './lib.mjs';

/** 24 kHz 16-bit mono PCM -> WAV bytes. */
export function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Pre-recorded transcription with AssemblyAI. format_text:false keeps numbers spelled out so WER is not inflated by "2" vs "two". */
export async function transcribe(key, audio, languageCode) {
  const up = await fetch('https://api.assemblyai.com/v2/upload', { method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/octet-stream' }, body: audio });
  if (!up.ok) throw new Error(`upload ${up.status} ${await up.text()}`);
  const { upload_url } = await up.json();
  const body = { audio_url: upload_url, language_code: languageCode, format_text: false, punctuate: false };
  const mk = await fetch('https://api.assemblyai.com/v2/transcript', { method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!mk.ok) throw new Error(`transcript ${mk.status} ${await mk.text()}`);
  const { id } = await mk.json();
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    const r = await (await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, { headers: { Authorization: key } })).json();
    if (r.status === 'completed') return { text: r.text || '', model: r.speech_model };
    if (r.status === 'error') throw new Error(`stt error ${r.error}`);
  }
  throw new Error('stt timeout');
}

const strip = (s) => s.toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
export const words = (s) => (strip(s) ? strip(s).split(' ') : []);

/** Word-level edit distance. Returns {errors, refWords}. */
export function wordErrors(ref, hyp) {
  const r = words(ref);
  const h = words(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 0; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++) for (let j = 1; j <= h.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return { errors: d[r.length][h.length], refWords: r.length };
}
