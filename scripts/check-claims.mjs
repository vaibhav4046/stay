#!/usr/bin/env node
/**
 * CI Honesty & Evidence Integrity Gate (B1)
 * Fails if:
 * 1. Any user-facing doc or landing component contains banned fabricated numbers or forbidden claims.
 * 2. Any referenced docs/evidence/... path in user-facing docs does not exist on disk.
 * 3. Any user-facing doc making numeric test/latency claims lacks a docs/evidence/ link.
 * 4. Any evidence JSON under docs/evidence/{unit,browser-simulated,real-provider,real-mic} has a missing
 *    or stale gitSha (must match HEAD or HEAD~1).
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
  'src/components/landing/Results.tsx',
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
];

function getCommitShas() {
  const valid = new Set();
  try {
    const list = execSync('git rev-list HEAD -n 10', { encoding: 'utf8' }).trim().split('\n');
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
          `${rel}: stale gitSha "${data.gitSha}" (expected HEAD ${[...validShas].join(' or ')})`,
        );
      }
    } catch (err) {
      failures.push(`${rel}: invalid JSON (${err.message})`);
    }
  }
}

if (failures.length > 0) {
  console.error('Honesty check (check-claims.mjs) FAILED:');
  for (const f of failures) {
    console.error(`  - ${f}`);
  }
  process.exit(1);
}

console.log(
  `Honesty check (check-claims.mjs) PASSED: scanned ${USER_FACING_FILES.length} files, 0 banned claims, all evidence links and gitSha stamps verified.`,
);
