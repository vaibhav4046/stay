/**
 * Live Persona Evaluation Runner.
 * Refuses to emit hardcoded replies, fake latencies, or unmeasured clinical claims.
 * Requires LIVE_BENCH=1 and a running local server to measure real responses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function getGitSha() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

const OUT = path.join(process.cwd(), 'docs', 'evidence', 'real-provider', 'persona-eval.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

if (process.env.LIVE_BENCH !== '1') {
  const notRun = {
    gitSha: getGitSha(),
    status: 'NOT_RUN',
    reason: 'LIVE_BENCH=1 not set; refusing to generate unmeasured persona latencies or hardcoded replies.',
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(OUT, JSON.stringify(notRun, null, 2), 'utf8');
  console.log(`Skipped live persona evaluation (status: NOT_RUN). Wrote ${OUT}`);
  process.exit(0);
}
