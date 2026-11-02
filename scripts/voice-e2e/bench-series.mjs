#!/usr/bin/env node
/**
 * T2.2 / T2.3 / T2.4 benchmark series: runs scripts/voice-e2e/sim-human.mjs several times against a running app and keeps the
 * numbers and the raw output in docs/evidence/loop/T2-bench-<date>[-<tag>].json, rewritten after every run.
 *
 *   node scripts/voice-e2e/bench-series.mjs http://localhost:3120 [runs=3] [turns=8] [tag]
 *
 * Labels (H8): synthetic-mic (a TTS "person" injected as the microphone, room noise on), live-model (real AssemblyAI speech-to-text
 * and TTS, real Groq model). It is NOT a real-mic number and must not be quoted as one. Each run opens its own voice sessions,
 * which the TTS service limits to 5 a minute, so runs are spaced out.
 * "First audio" is the first sample the page's AudioContext actually output (T2.1), measured from the end of the simulated speech.
 *
 * A run is VALID only if Stay answered at least one turn. Pause and barge-in lines count only when a reply was measured: a run where
 * Stay never replied also prints "Stay waited through the pause", which is not evidence of patience, so it is not counted.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:3120';
const RUNS = Number(process.argv[3] || 3);
const TURNS = Number(process.argv[4] || 8);
const TAG = process.argv[5] ? `-${process.argv[5]}` : '';
const GAP_MS = 60_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const out = `docs/evidence/loop/T2-bench-${new Date().toISOString().slice(0, 10)}${TAG}.json`;
mkdirSync('docs/evidence/loop', { recursive: true });

const q = (arr, p) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : null);

export function parseRun(text) {
  const turns = [...text.matchAll(/first audio (\d+(?:\.\d+)?) ms after the human stopped/g)].map((m) => Math.round(Number(m[1])));
  const pauseLine = /pause test: (.*)/.exec(text)?.[1] ?? null;
  const pauseReply = pauseLine ? /waited through the [\d.]+ s pause; reply to the finished thought after (\d+(?:\.\d+)?) ms/.exec(pauseLine) : null;
  const talkedOver = pauseLine ? /talked over|started (?:talking )?during/i.test(pauseLine) : false;
  const bargeLine = /barge-in: (.*)/.exec(text)?.[1] ?? null;
  const bargeM = bargeLine ? /it was quieted (\d+|NEVER)(?: ms)? and the speech service noticed me (\d+|NEVER)(?: ms)?/.exec(bargeLine) : null;
  return {
    turns,
    valid: turns.length > 0,
    pause: pauseLine,
    pauseMeasured: Boolean(pauseReply),
    pauseReplyMs: pauseReply ? Math.round(Number(pauseReply[1])) : null,
    talkedOverPause: talkedOver,
    barge: bargeLine,
    bargeQuietedMs: bargeM && bargeM[1] !== 'NEVER' ? Number(bargeM[1]) : null,
    bargeNoticedMs: bargeM && bargeM[2] !== 'NEVER' ? Number(bargeM[2]) : null,
    command: /command: (.*)/.exec(text)?.[1] ?? null,
    stray: /stray transcripts[^\n]*/.exec(text)?.[0] ?? null,
  };
}

function write(runs) {
  const valid = runs.filter((r) => r.valid);
  const all = valid.flatMap((r) => r.turns).sort((a, b) => a - b);
  const quieted = valid.map((r) => r.bargeQuietedMs).filter((x) => x !== null).sort((a, b) => a - b);
  const noticed = valid.map((r) => r.bargeNoticedMs).filter((x) => x !== null).sort((a, b) => a - b);
  const summary = {
    runsStarted: runs.length,
    validRuns: valid.length,
    invalidRuns: runs.length - valid.length,
    turns: all.length,
    medianMs: q(all, 0.5),
    p95Ms: q(all, 0.95),
    minMs: all[0] ?? null,
    maxMs: all.at(-1) ?? null,
    pauseTestsMeasured: valid.filter((r) => r.pauseMeasured).length,
    talkedOverPause: valid.filter((r) => r.talkedOverPause).length,
    bargeInsMeasured: quieted.length,
    quietedMedianMs: q(quieted, 0.5),
    serverNoticedMedianMs: q(noticed, 0.5),
  };
  writeFileSync(
    out,
    JSON.stringify({ gates: ['T2.2', 'T2.3', 'T2.4'], labels: ['synthetic-mic', 'live-model'], measure: 'end of simulated speech to the first sample played by the page AudioContext (T2.1)', gitSha: sha, base: BASE, at: new Date().toISOString(), summary, runs }, null, 2),
  );
  return summary;
}

const runs = [];
for (let i = 0; i < RUNS; i++) {
  console.log(`run ${i + 1}/${RUNS} ...`);
  const r = spawnSync(process.execPath, ['scripts/voice-e2e/sim-human.mjs', 'fast', BASE, '--turns', String(TURNS), '--no-llm', '--max', '600'], { encoding: 'utf8', timeout: 660_000 });
  const text = `${r.stdout || ''}${r.stderr || ''}`;
  runs.push({ run: i + 1, exit: r.status, ...parseRun(text), raw: text.slice(-6000) });
  const s = write(runs);
  const last = runs.at(-1);
  console.log(`  ${last.valid ? 'valid' : 'INVALID (Stay never replied)'}: ${last.turns.length} turns; pause ${last.pauseMeasured ? `waited, reply ${last.pauseReplyMs} ms` : 'not measured'}; quieted ${last.bargeQuietedMs ?? 'n/a'} ms`);
  if (i < RUNS - 1) await sleep(GAP_MS);
}
console.log(JSON.stringify(write(runs)));
console.log(out);
