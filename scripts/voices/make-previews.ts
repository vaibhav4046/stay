// Renders the ~20 s preview clip of every AssemblyAI persona into public/voices/previews/<id>.mp3.
// Usage: npx vite-node scripts/voices/make-previews.ts [personaId ...]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PERSONAS } from '../../src/lib/voice/personas';
import { previewText } from '../../src/lib/voice/tts/previewText';
import { loadEnv, mintToken, sleep, synth } from './lib.mjs';

const only = process.argv.slice(2);
const key = loadEnv();
const token = await mintToken(key, 600);
const outDir = path.resolve('public/voices/previews');
fs.mkdirSync(outDir, { recursive: true });
const tmp = path.join(process.env.TEMP || '/tmp', 'stay-previews');
fs.mkdirSync(tmp, { recursive: true });

const TTS_LANGUAGE: Record<string, string> = { en: 'english', es: 'spanish', fr: 'french', de: 'german', it: 'italian', pt: 'portuguese' };

for (const p of PERSONAS) {
  const ref = p.voices[0];
  if (ref.engine !== 'assemblyai' || (only.length && !only.includes(p.id))) continue;
  const text = previewText(p.lang, p.name);
  let r;
  for (let i = 0; i < 8; i++) {
    r = await synth(token, ref.voice, TTS_LANGUAGE[p.lang], text, 60000);
    if (r.error?.error_code !== 3009) break;
    await sleep(5000);
  }
  if (!r || !r.ok) { console.log(p.id, 'FAILED', JSON.stringify(r?.error)); continue; }
  const raw = path.join(tmp, `${p.id}.s16le`);
  fs.writeFileSync(raw, r.pcm);
  const out = path.join(outDir, `${p.id}.mp3`);
  const ff = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', raw, '-codec:a', 'libmp3lame', '-b:a', '48k', out]);
  if (ff.status !== 0) { console.log(p.id, 'ffmpeg failed', String(ff.stderr)); continue; }
  console.log(p.id.padEnd(9), `${(r.pcm.length / 48000).toFixed(1)} s`, `${(fs.statSync(out).size / 1024).toFixed(0)} KB`, `ttfa ${r.ttfaMs} ms`);
  await sleep(1200);
}
