#!/usr/bin/env node
/**
 * CI Honesty & Evidence Integrity Gate (B1)
 * Fails if:
 * 1. Any user-facing doc or landing component contains banned fabricated numbers or forbidden claims.
 * 2. Any referenced docs/evidence/... path in user-facing docs does not exist on disk.
 * 3. Any user-facing doc making numeric test/latency claims lacks a docs/evidence/ link.
 * 4. Any evidence JSON under docs/evidence/{unit,browser-simulated,real-provider,real-mic} has a missing
 *    gitSha, or one that is not among the last 50 commits (HEAD included). Older measurements that cannot be
 *    re-run belong outside those four folders, with their date and commit stated wherever they are cited.
 * 5. The speech measurement shown on the landing page (src/components/landing/currentMeasured.ts) is not the
 *    newest docs/evidence/real-provider/measure-*.json, or is missing, or did not finish (status is not PASS).
 *
 * Not failures, printed as notes: evidence measured with uncommitted changes (`dirty: true`). The stamp is then
 * the commit the working tree was based on, not an exact build.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();

const USER_FACING_FILES = [
  'README.md',
  'HACKATHON_SUBMISSION.md',
  'docs/JUDGE_RUNBOOK.md',
  'docs/SUBMISSION_PACK.md',
  'docs/voice/VOICE_PROOF.md',
  'docs/voice/VOICE_PROTOCOL_AUDIT.md',
  'src/app/page.tsx',
  'REVIEWERS.md',
  'docs/ARCHITECTURE.md',
  'docs/SAFETY.md',
  'docs/STAY_ADHD_EVIDENCE_AND_LIMITS.md',
  'src/components/landing/Results.tsx',
  'src/components/landing/BenchmarkBoard.tsx',
  'src/components/landing/ProofStrip.tsx',
  'src/components/landing/AssemblyAiArchitecture.tsx',
  'src/components/landing/AdhdScienceHistory.tsx',
  'src/components/landing/Sections.tsx',
];

const BANNED_PATTERNS = [
  { re: /\b48\s*ms\b/i, reason: 'Fabricated 48ms barge-in p50 claim' },
  { re: /\b92\s*ms\b/i, reason: 'Fabricated 92ms barge-in p95 claim' },
  { re: /\b661\b/, reason: 'Stale/unlinked 661 test count claim' },
  { re: /\b677\b/, reason: 'Stale/unlinked 677 test count claim' },
  { re: /\b128\/128\b/, reason: 'Fabricated 128/128 swarm claim' },
  { re: /\b105 of 105\b/i, reason: 'Fabricated 105-agent swarm claim' },
  { re: /\b100 of 100 personas\b/i, reason: 'Fabricated 100-personas claim' },
  { re: /clinical_actionability_verified/, reason: 'Fabricated clinical verification flag' },
  { re: /\bgapless\b/i, reason: 'Forbidden "gapless" claim (report measured gaps/underflows instead)' },
  { re: /\bproduction-ready\b/i, reason: 'Forbidden "production-ready" marketing claim' },
  { re: /\bDessa\b/i, reason: 'Forbidden "Dessa" claim' },
  { re: /\b100%\s+verified\b/i, reason: 'Forbidden "100% verified" claim' },
  { re: /\b24\/7\s+therapist\b/i, reason: 'Forbidden "24/7 therapist" medical claim' },
  { re: /\bdopamine-aligned\b/i, reason: 'Forbidden dopamine mechanism claim' },
  { re: /measured on this build/i, reason: 'Say which commit and date it was measured at ("this build" goes stale with the next commit)' },
  { re: /\bHOME to 741741\b/i, reason: 'Crisis Text Line number is not in src/lib/safety/region.ts' },
];

function getCommitShas() {
  const valid = new Set();
  try {
    // every ref, not just HEAD: a squash merge drops a pull request's commits from master's own history, but they are still this project's commits (kept on the PR branches)
    const list = execSync('git rev-list --all -n 50', { encoding: 'utf8' }).trim().split('\n');
    for (const sha of list) {
      const s = sha.trim();
      if (s) valid.add(s);
    }
  } catch {}
  return valid;
}

function collectJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...collectJsonFiles(full));
    } else if (e.isFile() && e.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

const failures = [];

for (const rel of USER_FACING_FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) continue;
  const content = fs.readFileSync(full, 'utf8');

  for (const { re, reason } of BANNED_PATTERNS) {
    const m = content.match(re);
    if (m) {
      failures.push(`${rel}: contains banned pattern "${m[0]}" (${reason})`);
    }
  }

  // Verify every referenced docs/evidence/... path exists on disk
  const evidenceRefs = content.matchAll(/(?:docs\/|\.\.\/)?evidence\/[A-Za-z0-9_./-]+\.(?:json|txt|png|md)/g);
  for (const match of evidenceRefs) {
    const rawRef = match[0];
    const normalized = rawRef.startsWith('../evidence/')
      ? path.join('docs', rawRef.slice(3))
      : rawRef.startsWith('evidence/')
        ? path.join('docs', rawRef)
        : rawRef;
    const targetPath = path.join(ROOT, normalized);
    if (!fs.existsSync(targetPath)) {
      failures.push(`${rel}: references missing evidence file "${rawRef}" (expected at ${normalized})`);
    }
  }

  // Require docs/evidence/ link in top-level markdown docs that report numbers
  if (rel.endsWith('.md') && /\b\d+\s*(?:ms|s|tests|passed)\b/i.test(content)) {
    if (!/evidence\//.test(content)) {
      failures.push(`${rel}: contains numeric metrics without linking to docs/evidence/`);
    }
  }
}

const validShas = getCommitShas();
const headSha = [...validShas][0] ?? 'unknown';
const notes = [];
const evidenceSubdirs = ['unit', 'browser-simulated', 'real-provider', 'real-mic'];
for (const sub of evidenceSubdirs) {
  const dir = path.join(ROOT, 'docs', 'evidence', sub);
  for (const jsonFile of collectJsonFiles(dir)) {
    const rel = path.relative(ROOT, jsonFile).replace(/\\/g, '/');
    try {
      const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
      if (!data.gitSha || typeof data.gitSha !== 'string') {
        failures.push(`${rel}: missing required "gitSha" field`);
      } else if (validShas.size > 0 && !validShas.has(data.gitSha)) {
        failures.push(
          `${rel}: stale gitSha "${data.gitSha.slice(0, 7)}" (not among the last 50 commits; HEAD is ${headSha.slice(0, 7)}). Re-run its script, or move it out of docs/evidence/${sub} and cite it by date.`,
        );
      } else if (data.dirty === true) {
        notes.push(`${rel}: measured at ${data.gitSha.slice(0, 7)} with uncommitted changes in the working tree (dirty: true)`);
      }
    } catch (err) {
      failures.push(`${rel}: invalid JSON (${err.message})`);
    }
  }
}

// The speech measurement the landing page shows must be the newest one, and a finished run.
const MEASURE_DIR = 'docs/evidence/real-provider';
const LANDING_MEASURE_SRC = 'src/components/landing/currentMeasured.ts';
const landingSrc = fs.existsSync(path.join(ROOT, LANDING_MEASURE_SRC)) ? fs.readFileSync(path.join(ROOT, LANDING_MEASURE_SRC), 'utf8') : '';
const shownName = landingSrc.match(/real-provider\/(measure-[0-9a-f]+\.json)/)?.[1];
const measureFiles = collectJsonFiles(path.join(ROOT, MEASURE_DIR))
  .filter((f) => /measure-[0-9a-f]+\.json$/.test(f))
  .map((f) => ({ name: path.basename(f), data: JSON.parse(fs.readFileSync(f, 'utf8')) }))
  .filter((m) => typeof m.data.timestamp === 'string')
  .sort((a, b) => b.data.timestamp.localeCompare(a.data.timestamp));
if (!shownName) {
  failures.push(`${LANDING_MEASURE_SRC}: does not import a ${MEASURE_DIR}/measure-<sha>.json file`);
} else {
  const shown = measureFiles.find((m) => m.name === shownName);
  if (!shown) failures.push(`${LANDING_MEASURE_SRC}: imports ${shownName}, which is missing or has no timestamp`);
  else {
    if (shown.data.status !== 'PASS') failures.push(`${MEASURE_DIR}/${shownName}: shown on the landing page but status is ${shown.data.status}`);
    if (measureFiles[0].name !== shownName) failures.push(`${LANDING_MEASURE_SRC}: shows ${shownName} (${shown.data.timestamp.slice(0, 10)}) but ${measureFiles[0].name} (${measureFiles[0].data.timestamp.slice(0, 10)}) is newer; re-point the import`);
  }
}

if (failures.length > 0) {
  console.error('Honesty check (check-claims.mjs) FAILED:');
  for (const f of new Set(failures)) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}

for (const n of notes) console.log(`  note: ${n}`);
console.log(
  `Honesty check (check-claims.mjs) PASSED: scanned ${USER_FACING_FILES.length} files, 0 banned claims, all evidence links and gitSha stamps verified, landing page shows the newest speech measurement${notes.length ? ` (${notes.length} note${notes.length === 1 ? '' : 's'} above)` : ''}.`,
);
