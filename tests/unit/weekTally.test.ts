import { describe, expect, it } from 'vitest';
import { weekTally, weekTallyLine } from '@/lib/coach/weekTally';

const now = new Date('2026-10-19T12:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe('weekTally', () => {
  it('counts only the last 7 days and splits outcomes', () => {
    const t = weekTally(
      [
        { createdAt: ago(0.5), outcome: 'started' },
        { createdAt: ago(2), outcome: 'partly_started' },
        { createdAt: ago(3), outcome: 'not_started' },
        { createdAt: ago(4), outcome: 'paused_or_stopped' },
        { createdAt: ago(5) },
        { createdAt: ago(9), outcome: 'started' },
        { createdAt: 'garbage', outcome: 'started' },
      ],
      now,
    );
    expect(t).toEqual({ blocks: 5, started: 1, partly: 1, notStarted: 2, open: 1 });
  });

  it('ignores sessions dated in the future', () => {
    expect(weekTally([{ createdAt: ago(-3), outcome: 'started' }], now).blocks).toBe(0);
  });

  it('writes the real denominator and never invents wins', () => {
    expect(weekTallyLine(weekTally([], now))).toMatch(/No blocks/);
    expect(weekTallyLine({ blocks: 4, started: 2, partly: 1, notStarted: 1, open: 0 })).toBe('3 of 4 blocks this week got started (1 partly).');
    expect(weekTallyLine({ blocks: 1, started: 0, partly: 0, notStarted: 1, open: 0 })).toBe('0 of 1 block this week got started.');
  });
});
