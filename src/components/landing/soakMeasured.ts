// evidence: docs/evidence/loop/soak-run6-hour-elevenlabs-genz.json
// evidence: docs/evidence/loop/soak-run5-real-model-18min.json
/**
 * Reply timing over long conversations. Each soak run (scripts/voice-e2e/soak.mjs) is one spoken conversation between a synthetic
 * speaker and Stay with the live model, nothing played aloud. "First sound" is when the first sample of Stay's voice was actually output,
 * counted from the end of the speaker's last word. The numbers are computed here from every turn in the saved files with the formula
 * the script uses for its own summary, so they match the logs (tests/unit/soakMeasured.test.ts checks that).
 * Only runs with the real model and no known outage are listed. Runs 0 to 4 (before fixes, an exhausted daily token allowance, a
 * stand-in model) are left out; their files are still in docs/evidence/loop.
 * Server components only: the files are large, so do not import this from a client component.
 */
import run5 from '../../../docs/evidence/loop/soak-run5-real-model-18min.json';
import run6 from '../../../docs/evidence/loop/soak-run6-hour-elevenlabs-genz.json';
import run7 from '../../../docs/evidence/loop/soak-run7-gate-40min-real-model.json';
import run8 from '../../../docs/evidence/loop/soak-run8-reactive-45min-elevenlabs.json';
import run9 from '../../../docs/evidence/loop/soak-run9-ui-watch-genz-24min.json';
import run10 from '../../../docs/evidence/loop/soak-run10-ui-watch-genz-14min.json';

interface SoakFile { turns: Array<{ firstSoundMs?: number | null; minute?: number }> }

export function soakStats(file: SoakFile) {
  const lat = file.turns.map((t) => t.firstSoundMs).filter((x): x is number => typeof x === 'number').sort((a, b) => a - b);
  const q = (p: number) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))];
  return { turns: file.turns.length, timed: lat.length, minutes: file.turns.at(-1)?.minute ?? 0, median: q(0.5), p95: q(0.95), max: lat.at(-1) ?? 0 };
}

const RUNS = [
  { file: 'soak-run5-real-model-18min.json', data: run5 },
  { file: 'soak-run6-hour-elevenlabs-genz.json', data: run6 },
  { file: 'soak-run7-gate-40min-real-model.json', data: run7 },
  { file: 'soak-run8-reactive-45min-elevenlabs.json', data: run8 },
  { file: 'soak-run9-ui-watch-genz-24min.json', data: run9 },
  { file: 'soak-run10-ui-watch-genz-14min.json', data: run10 },
].map((r) => ({ file: `docs/evidence/loop/${r.file}`, ...soakStats(r.data as unknown as SoakFile) }));

const longest = RUNS.reduce((a, b) => (b.turns > a.turns ? b : a));
const spread = (pick: (r: (typeof RUNS)[number]) => number) => [Math.min(...RUNS.map(pick)), Math.max(...RUNS.map(pick))] as const;

export const SOAK = {
  runs: RUNS.length,
  longest,
  median: spread((r) => r.median),
  p95: spread((r) => r.p95),
  turns: spread((r) => r.turns),
};
