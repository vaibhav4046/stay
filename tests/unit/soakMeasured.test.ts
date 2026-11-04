import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { SOAK, soakStats } from '@/components/landing/soakMeasured';

const load = (name: string) => JSON.parse(readFileSync(`docs/evidence/loop/${name}`, 'utf8'));

describe('soak numbers on the landing page', () => {
  it('match the summary the soak script itself wrote for the same run', () => {
    // each file carries the script's own summary block (written at the end of the run)
    const six = load('soak-run6-hour-elevenlabs-genz-summary.json').summary.firstSoundMs;
    const ten = load('soak-run10-ui-watch-genz-14min.json').summary.firstSoundMs;
    const sixStats = soakStats(load('soak-run6-hour-elevenlabs-genz.json'));
    const tenStats = soakStats(load('soak-run10-ui-watch-genz-14min.json'));

    expect({ n: sixStats.timed, median: sixStats.median, p95: sixStats.p95, max: sixStats.max }).toEqual(six);
    expect({ n: tenStats.timed, median: tenStats.median, p95: tenStats.p95, max: tenStats.max }).toEqual(ten);
  });

  it('shows the longest run and a range that contains it', () => {
    expect(SOAK.longest.turns).toBe(SOAK.turns[1]);
    expect(SOAK.longest.median).toBeGreaterThanOrEqual(SOAK.median[0]);
    expect(SOAK.longest.median).toBeLessThanOrEqual(SOAK.median[1]);
    expect(SOAK.longest.p95).toBeLessThanOrEqual(SOAK.p95[1]);
  });
});
