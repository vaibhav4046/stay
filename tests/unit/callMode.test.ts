import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CALL_MAX_MS,
  GIVE_UP_AFTER_MS,
  MAX_NUDGES,
  NUDGE_AFTER_MS,
  NUDGE_INSTRUCTIONS,
  cancelScheduledCall,
  formatClock,
  nextCallAction,
  scheduleCall,
  scheduledCallAt,
  takeDueCall,
} from '@/lib/voice/callMode';

const clock = (o: Partial<Parameters<typeof nextCallAction>[0]> = {}) => ({
  elapsedMs: 60_000,
  silentMs: 0,
  nudgesSent: 0,
  listening: true,
  ...o,
});

describe('nextCallAction', () => {
  it('stays quiet while the person is recently active', () => {
    expect(nextCallAction(clock({ silentMs: NUDGE_AFTER_MS - 1 }))).toBe('none');
  });
  it('nudges after the quiet threshold', () => {
    expect(nextCallAction(clock({ silentMs: NUDGE_AFTER_MS }))).toBe('nudge');
  });
  it('never nudges over speech, thinking or reconnects', () => {
    expect(nextCallAction(clock({ silentMs: 120_000, listening: false }))).toBe('none');
  });
  it('stops nudging after the cap, then closes kindly after more quiet', () => {
    expect(nextCallAction(clock({ nudgesSent: MAX_NUDGES, silentMs: GIVE_UP_AFTER_MS - 1 }))).toBe('none');
    expect(nextCallAction(clock({ nudgesSent: MAX_NUDGES, silentMs: GIVE_UP_AFTER_MS }))).toBe('wrap');
  });
  it('wraps at the call cap even mid-speech', () => {
    expect(nextCallAction(clock({ elapsedMs: CALL_MAX_MS, listening: false }))).toBe('wrap');
  });
  it('has one distinct instruction per allowed nudge, each a model instruction', () => {
    expect(NUDGE_INSTRUCTIONS).toHaveLength(MAX_NUDGES);
    for (const n of NUDGE_INSTRUCTIONS) expect(n.startsWith('Say ')).toBe(true);
  });
});

describe('formatClock', () => {
  it('formats mm:ss and clamps negatives', () => {
    expect(formatClock(65_000)).toBe('01:05');
    expect(formatClock(-5)).toBe('00:00');
  });
});

describe('scheduled call', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('rejects arbitrary delays', () => {
    expect(scheduleCall(7)).toBeNull();
    expect(scheduledCallAt()).toBeNull();
  });
  it('is not due early, is due once, then clears', () => {
    const at = scheduleCall(5, 1_000)!;
    expect(takeDueCall(at - 1)).toBe(false);
    expect(takeDueCall(at)).toBe(true);
    expect(takeDueCall(at + 1)).toBe(false);
  });
  it('drops a call missed by more than 30 minutes instead of replaying it', () => {
    const at = scheduleCall(5, 1_000)!;
    expect(takeDueCall(at + 31 * 60_000)).toBe(false);
    expect(scheduledCallAt()).toBeNull();
  });
  it('can be cancelled', () => {
    scheduleCall(15, 1_000);
    cancelScheduledCall();
    expect(scheduledCallAt()).toBeNull();
  });
});
