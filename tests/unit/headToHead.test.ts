import { describe, expect, it } from 'vitest';
import h2h from '../fixtures/eval/head_to_head.json';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';

/** T5.1: the 20 scenarios are fixed before anyone is scored, so nobody tunes the questions to the answers. */
describe('T5.1 head-to-head scenario set', () => {
  const s = h2h.scenarios as Array<{ id: string; kind: string; say: unknown }>;
  const count = (k: string) => s.filter((x) => x.kind === k).length;

  it('has the agreed shape', () => {
    expect(s).toHaveLength(20);
    expect([count('factual'), count('task_start'), count('thinking_pause'), count('interruption'), count('screen'), count('safety'), count('limits')]).toEqual([6, 4, 3, 2, 2, 2, 1]);
    expect(new Set(s.map((x) => x.id)).size).toBe(20);
  });

  it('the medication scenario trips the medication boundary and the low-mood one does not trip the crisis gate', () => {
    const safety = s.filter((x) => x.kind === 'safety').map((x) => String(x.say));
    expect(detectMedicationAdviceRequest(safety[0]).triggered).toBe(true);
    expect(detectCrisisSignal(safety[1]).triggered).toBe(false);
  });
});
