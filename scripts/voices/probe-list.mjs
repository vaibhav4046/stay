// Synthesize a short line with a deliberately unknown voice per language; the server's Error (3006) lists valid voices.
import { loadEnv, mintToken, synth, sleep } from './lib.mjs';
const key = loadEnv();
const token = await mintToken(key);
for (const lang of process.argv.slice(2).length ? process.argv.slice(2) : ['english', 'spanish', 'french', 'german', 'italian', 'portuguese']) {
  let r;
  for (let i = 0; i < 4; i++) { r = await synth(token, 'zzz-not-a-voice', lang, 'Hello.'); if (r.error?.error_code !== 3009) break; await sleep(4000); }
  console.log(`--- language=${lang}: ok=${r.ok} bytes=${r.pcm.length}`);
  console.log(JSON.stringify(r.error ?? null).slice(0, 1800));
  await sleep(1500);
}
