#!/usr/bin/env node
/**
 * Real-provider check: every voice_id the app can send to AssemblyAI TTS must be accepted by the live API.
 * Runs only with ASSEMBLYAI_API_KEY. Writes docs/evidence/real-provider/voices-<sha>.json and exits 1 on any rejected id.
 * Cost: one 1-word synthesis per id (a few cents at most).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const key = (process.env.ASSEMBLYAI_API_KEY || '').trim();
const sha = execSync('git rev-parse HEAD').toString().trim();
const outDir = 'docs/evidence/real-provider';
mkdirSync(outDir, { recursive: true });
const outFile = `${outDir}/voices-${sha.slice(0, 7)}.json`;

if (!key) {
  writeFileSync(outFile, JSON.stringify({ status: 'NOT_RUN', reason: 'no key', gitSha: sha }, null, 2));
  console.log('[verify-voices] NOT_RUN (no ASSEMBLYAI_API_KEY)');
  process.exit(0);
}

const src = readFileSync('src/lib/voice/fastSocket.ts', 'utf8');
const ids = [
  ...new Set([
    ...(src.match(/aai-[a-z]+/g) ?? []),
    ...(src.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? []),
  ]),
].sort();
const languages = ['english', 'spanish', 'french', 'german', 'italian', 'portuguese'];

const results = [];
for (const id of ids) {
  let result = { id, ok: false };
  for (const language of languages) {
    const r = await fetch('https://tts.us.assemblyai.com/v1/speech', {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hi.', voice_id: id, language, container: 'wav' }),
    });
    if (r.ok) {
      await r.arrayBuffer();
      result = { id, ok: true, language };
      break;
    }
    const body = await r.text();
    result = { id, ok: false, status: r.status, error: body.slice(0, 120) };
    if (!/language|3006/i.test(body)) break; // only a language mismatch is worth retrying in another language
  }
  results.push(result);
}

const failed = results.filter((r) => !r.ok);
writeFileSync(
  outFile,
  JSON.stringify({ status: failed.length ? 'FAIL' : 'PASS', tier: 'real-provider', gitSha: sha, timestamp: new Date().toISOString(), checked: results.length, failed: failed.length, results }, null, 2),
);
for (const r of failed) console.log(`FAIL ${r.id} ${r.status} ${r.error}`);
console.log(`[verify-voices] ${failed.length ? 'FAIL' : 'PASS'}: ${results.length - failed.length}/${results.length} voice ids accepted -> ${outFile}`);
process.exit(failed.length ? 1 : 0);
