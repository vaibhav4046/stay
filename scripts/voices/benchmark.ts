// Objective voice benchmark: synthesize the same five sentences with every AssemblyAI voice, transcribe them with AssemblyAI
// speech-to-text, report word error rate and time to first audio. Writes docs/bench-results/voices-<date>.json.
// Usage: npx vite-node scripts/voices/benchmark.ts [voiceId ...]
import fs from 'node:fs';
import path from 'node:path';
import { PERSONAS } from '../../src/lib/voice/personas';
import { SENTENCES } from './sentences';
import { loadEnv, mintToken, sleep, synth } from './lib.mjs';
import { transcribe, wav, wordErrors } from './stt.mjs';

const only = process.argv.slice(2);
const key = loadEnv();
const LANG_NAME: Record<string, string> = { en: 'english', es: 'spanish', fr: 'french', de: 'german', it: 'italian', pt: 'portuguese' };
const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : NaN;
};

const results: Array<Record<string, unknown>> = [];
let sttModel = '';
for (const p of PERSONAS) {
  const ref = p.voices[0];
  if (ref.engine !== 'assemblyai' || (only.length && !only.includes(p.id))) continue;
  const token = await mintToken(key, 600);
  let errors = 0;
  let refWords = 0;
  const ttfa: number[] = [];
  const connect: number[] = [];
  const misses: string[] = [];
  for (const sentence of SENTENCES[p.lang]) {
    let r;
    for (let i = 0; i < 10; i++) {
      r = await synth(token, ref.voice, LANG_NAME[p.lang], sentence);
      if (r.error?.error_code !== 3009) break;
      await sleep(4000);
    }
    if (!r?.ok) {
      console.log(p.id, 'synth failed', JSON.stringify(r?.error));
      continue;
    }
    ttfa.push(r.ttfaMs);
    connect.push(r.connectMs);
    const heard = await transcribe(key, wav(r.pcm), p.lang);
    sttModel = heard.model || sttModel;
    const e = wordErrors(sentence, heard.text);
    errors += e.errors;
    refWords += e.refWords;
    if (e.errors) misses.push(`${sentence}  =>  ${heard.text}`);
    await sleep(600);
  }
  const wer = refWords ? errors / refWords : null;
  const row = { voice: p.id, persona: p.name, lang: p.lang, accent: ref.accent, sentences: ttfa.length, wer, errors, refWords, ttfaMedianMs: median(ttfa), ttfaMaxMs: Math.max(...ttfa), connectMedianMs: median(connect), misses };
  results.push(row);
  console.log(p.id.padEnd(9), p.lang, `WER ${wer === null ? 'n/a' : (100 * wer).toFixed(1)}% (${errors}/${refWords})`, `ttfa median ${row.ttfaMedianMs} ms max ${row.ttfaMaxMs}`, `connect ${row.connectMedianMs} ms`);
  for (const m of misses) console.log('   miss:', m);
}
const out = path.resolve('docs/bench-results', `voices-${new Date().toISOString().slice(0, 10)}${only.length ? '-partial' : ''}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ date: new Date().toISOString(), sttModel, sentences: SENTENCES, results }, null, 2));
console.log('wrote', out);
