// Word error rate of this Windows machine's own speech voices (what the browser's speechSynthesis uses here).
// Usage: node scripts/voices/benchmark-device.mjs Heera Ravi
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { loadEnv } from './lib.mjs';
import { transcribe, wordErrors } from './stt.mjs';

const SENTENCES = [
  "Let's pick one small thing and do it for just two minutes.",
  "You don't have to finish the whole report today, only open the document and write the title.",
  'Great job, that counts as a real start, so take a slow breath and keep going.',
  'If the landlord email feels heavy, we can write one sentence together, then stop.',
  "Your timer is set for twenty minutes, and I'll tell you when the first ten have passed.",
];
const key = loadEnv();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stay-device-'));
const out = [];
for (const voice of process.argv.slice(2)) {
  let errors = 0;
  let refWords = 0;
  const times = [];
  const misses = [];
  for (const [i, s] of SENTENCES.entries()) {
    const file = path.join(dir, `${voice}-${i}.wav`);
    const t0 = Date.now();
    const r = spawnSync('powershell', ['-NoProfile', '-File', path.resolve('scripts/voices/winrt-synth.ps1'), '-Voice', voice, '-Text', s, '-Out', file], { encoding: 'utf8' });
    times.push(Date.now() - t0);
    if (r.status !== 0) {
      console.log(voice, 'synth failed', r.stderr.slice(0, 300));
      break;
    }
    const heard = await transcribe(key, fs.readFileSync(file), 'en');
    const e = wordErrors(s, heard.text);
    errors += e.errors;
    refWords += e.refWords;
    if (e.errors) misses.push(`${s}  =>  ${heard.text}`);
  }
  const wer = refWords ? errors / refWords : null;
  out.push({ voice, wer, errors, refWords, wallMsPerSentence: times, misses });
  console.log(voice.padEnd(8), `WER ${wer === null ? 'n/a' : (100 * wer).toFixed(1)}% (${errors}/${refWords})`);
  for (const m of misses) console.log('   miss:', m);
}
fs.writeFileSync(path.resolve('docs/bench-results', `voices-device-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify({ date: new Date().toISOString(), machine: 'Windows 11, OneCore voices', results: out }, null, 2));
