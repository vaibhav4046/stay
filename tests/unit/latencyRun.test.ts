import { describe, expect, it } from 'vitest';
import { computeTurns, exportLatency, summarise } from '@/lib/voice/lab/latency';

/** T2.8: the real-microphone page turns the app's marks into rows. These check the arithmetic, not the microphone. */
describe('T2.8 latency rows', () => {
  const marks: Array<[string, number]> = [['req', 1000], ['eot', 10_000], ['aud1', 10_700], ['eot', 30_000], ['aud1', 30_900]];
  const loud = [9000, 9500, 9800, 29_200, 29_500, 29_700]; // the last loud frame before each end-of-turn call
  const plays = [10_950, 31_200];

  it('measures from the last loud microphone frame to the first sample played', () => {
    const t = computeTurns(marks, plays, loud);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ turn: 1, endOfSpeechAt: 9800, playedAt: 10_950, latencyMs: 1150, afterTurnCalledMs: 950 });
    expect(t[1]).toMatchObject({ turn: 2, endOfSpeechAt: 29_700, playedAt: 31_200, latencyMs: 1500, afterTurnCalledMs: 1200 });
  });

  it('does not give one turn the next turn\'s reply', () => {
    const t = computeTurns(marks, [31_200], loud);
    expect(t[0].playedAt).toBeNull();
    expect(t[0].latencyMs).toBeNull();
    expect(t[1].playedAt).toBe(31_200);
  });

  it('a turn with no loud frame in the look-back has no latency, and says so', () => {
    const t = computeTurns([['eot', 50_000]], [50_800], [1000]);
    expect(t[0].endOfSpeechAt).toBeNull();
    expect(t[0].latencyMs).toBeNull();
    expect(t[0].afterTurnCalledMs).toBe(800);
  });

  it('summarises only the turns that have a number, with median, 95th percentile and worst', () => {
    const turns = [900, 1000, 1100, 1200, null, 5000].map((ms, i) => ({ turn: i + 1, endOfSpeechAt: 0, calledFinishedAt: 0, playedAt: 0, latencyMs: ms, afterTurnCalledMs: ms }));
    const s = summarise(turns);
    expect(s.n).toBe(5);
    expect(s.medianMs).toBe(1100);
    expect(s.worstMs).toBe(5000);
    expect(summarise([])).toEqual({ n: 0, medianMs: null, p95Ms: null, worstMs: null });
  });

  it('exports with the labels that make it the one public-latency source, and keeps every row', () => {
    const out = JSON.parse(exportLatency(computeTurns(marks, plays, loud), { gitSha: 'abc1234', at: '2026-11-02T12:00:00Z' }));
    expect(out.labels).toEqual(['real-mic', 'live-model']);
    expect(out.turns).toHaveLength(2);
    expect(out.gitSha).toBe('abc1234');
    expect(out.summary.n).toBe(2);
  });
});
