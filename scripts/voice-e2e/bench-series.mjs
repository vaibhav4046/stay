#!/usr/bin/env node
/**
 * T2.2 / T2.3 / T2.4 benchmark series: runs scripts/voice-e2e/sim-human.mjs several times against a running app and keeps the
 * numbers and the raw output in docs/evidence/loop/T2-bench-<date>.json.
 *
 *   node scripts/voice-e2e/bench-series.mjs http://localhost:3120 [runs=5] [turns=8]
 *
 * Labels (H8): synthetic-mic (a TTS "person" injected as the microphone, room noise on), live-model (real AssemblyAI speech-to-text
 * and TTS, real Groq model). It is NOT a real-mic number and must not be quoted as one. Each run opens its own voice sessions,
 * which the TTS service limits to 5 a minute, so runs are spaced out.
 * "First audio" is the first sample the page's AudioContext actually output (T2.1), measured from the end of the simulated speech.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:3120';
const RUNS = Number(process.argv[3] || 5);
const TURNS = Number(process.argv[4] || 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();

const runs = [];
for (let i = 0; i < RUNS; i++) {
  console.log(`run ${i + 1}/${RUNS} ...`);
  const r = spawnSync(process.execPath, ['scripts/voice-e2e/sim-human.mjs', 'fast', BASE, '--turns', String(TURNS), '--no-llm', '--max', '600'], { encoding: 'utf8', timeout: 660_000 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const turns = [...out.matchAll(/first audio (\d+(?:\.\d+)?) ms after the human stopped/g)].map((m) => Math.round(Number(m[1])));
  const pause = /pause test: (.*)/.exec(out)?.[1] ?? null;
  const barge = /barge-in: (.*)/.exec(out)?.[1] ?? null;
  const command = /command: (.*)/.exec(out)?.[1] ?? null;
  const stray = /stray transcripts[^\n]*/.exec(out)?.[0] ?? null;
  runs.push({ run: i + 1, exit: r.status, turns, pause, barge, command, stray, raw: out.slice(-6000) });
  console.log(`  ${turns.length} turns, median ${turns.length ? [...turns].sort((a, b) => a - b)[Math.floor(turns.length / 2)] : 'n/a'} ms; ${pause ?? 'no pause line'}`);
  if (i < RUNS - 1) await sleep(45_000);
}

const all = runs.flatMap((r) => r.turns).sort((a, b) => a - b);
const q = (p) => (all.length ? all[Math.min(all.length - 1, Math.floor(all.length * p))] : null);
const patient = runs.filter((r) => r.pause && /waited/i.test(r.pause)).length;
const talkedOver = runs.filter((r) => r.pause && !/waited/i.test(r.pause)).length;
const summary = { turns: all.length, medianMs: q(0.5), p95Ms: q(0.95), minMs: all[0] ?? null, maxMs: all.at(-1) ?? null, pauseRuns: runs.length, waitedThroughPause: patient, talkedOverPause: talkedOver, bargeInRuns: runs.filter((r) => r.barge).length };
const out = `docs/evidence/loop/T2-bench-${new Date().toISOString().slice(0, 10)}.json`;
mkdirSync('docs/evidence/loop', { recursive: true });
writeFileSync(out, JSON.stringify({ gates: ['T2.2', 'T2.3', 'T2.4'], labels: ['synthetic-mic', 'live-model'], measure: 'end of simulated speech to the first sample played by the page AudioContext (T2.1)', gitSha: sha, base: BASE, at: new Date().toISOString(), summary, runs }, null, 2));
console.log(JSON.stringify(summary));
console.log(out);
