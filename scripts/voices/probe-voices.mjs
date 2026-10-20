// Confirm each candidate voice really synthesizes (a bad voice is only rejected at Generate time).
import { loadEnv, mintToken, synth, sleep } from './lib.mjs';
const key = loadEnv();
const token = await mintToken(key);
const list = [['english', 'iris'], ['english', 'reid'], ['portuguese', 'rafael'], ['portuguese', 'zzz'], ['spanish', 'lola']];
for (const [lang, voice] of list) {
  let r;
  for (let i = 0; i < 6; i++) { r = await synth(token, voice, lang, 'Hello, this is a short test of the voice.'); if (r.error?.error_code !== 3009) break; await sleep(5000); }
  console.log(lang, voice, 'ok=' + r.ok, 'bytes=' + r.pcm.length, 'ttfa=' + r.ttfaMs, r.error ? JSON.stringify(r.error).slice(0, 300) : '');
  await sleep(1500);
}
