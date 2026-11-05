import { beforeEach, describe, expect, it } from 'vitest';
import {
  addEvent,
  currentHoldMs,
  DEFAULT_HOLD_MS,
  describePatience,
  emptyPatience,
  holdFromEvents,
  loadPatience,
  MAX_HOLD_MS,
  MIN_HOLD_MS,
  patienceEnabled,
  recordHold,
  resetPatience,
  setPatienceEnabled,
  type HoldEvent,
} from '@/lib/voice/patience';

const r = (ms: number): HoldEvent => ({ k: 'r', ms });
const e = (ms: number): HoldEvent => ({ k: 'e', ms });

describe('how long Stay waits through a pause', () => {
  it('keeps the default until it has seen a few pauses', () => {
    expect(holdFromEvents([])).toBe(DEFAULT_HOLD_MS);
    expect(holdFromEvents([r(1500), r(1600), r(1700), r(1800)])).toBe(DEFAULT_HOLD_MS); // four is not enough
  });

  it('waits longer for someone who takes a long time to pick the sentence up again', () => {
    const slow = [r(2200), r(2400), r(2600), r(2500), r(2300), r(2700)];
    expect(holdFromEvents(slow)).toBeGreaterThan(DEFAULT_HOLD_MS);
  });

  it('waits less for someone who picks it up quickly', () => {
    const quick = [r(600), r(700), r(500), r(800), r(650), r(700), r(750)];
    expect(holdFromEvents(quick)).toBeLessThan(DEFAULT_HOLD_MS);
  });

  it('answers sooner for someone whose waits nearly always run out unused', () => {
    const wasted = [e(2200), e(2200), e(2200), e(2200), e(2200), e(2200), e(2200), e(2200), r(900)];
    expect(holdFromEvents(wasted)).toBeLessThan(DEFAULT_HOLD_MS);
  });

  it('never goes outside the safe limits, however strange the evidence', () => {
    expect(holdFromEvents(Array.from({ length: 10 }, () => r(19_000)))).toBe(MAX_HOLD_MS);
    expect(holdFromEvents(Array.from({ length: 10 }, () => r(10)))).toBe(MIN_HOLD_MS);
    expect(holdFromEvents(Array.from({ length: 20 }, () => e(2200)))).toBeGreaterThanOrEqual(MIN_HOLD_MS);
  });

  it('only remembers the last thirty pauses, so it follows a person who changes', () => {
    let s = emptyPatience();
    for (let i = 0; i < 40; i++) s = addEvent(s, r(3000));
    for (let i = 0; i < 30; i++) s = addEvent(s, r(600));
    expect(s.events).toHaveLength(30);
    expect(holdFromEvents(s.events)).toBeLessThan(DEFAULT_HOLD_MS);
  });

  it('ignores a stale timer or a clock jump', () => {
    const s = emptyPatience();
    expect(addEvent(s, r(-5))).toBe(s);
    expect(addEvent(s, r(1e9))).toBe(s);
    expect(addEvent(s, r(NaN))).toBe(s);
  });

  it('describes itself in one plain sentence', () => {
    expect(describePatience(emptyPatience())).toMatch(/2\.2 seconds.*starts learning/);
    const learned = [r(2200), r(2400), r(2600), r(2500), r(2300), r(2700)].reduce(addEvent, emptyPatience());
    expect(describePatience(learned)).toMatch(/about \d\.\d seconds.*last 6 pauses/);
    expect(describePatience(learned, false)).toMatch(/Learning is off/);
  });
});

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

describe('kept on this device', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: new MemStorage() };
  });

  it('learns from what the voice reports, and the wait follows', () => {
    for (let i = 0; i < 6; i++) recordHold('resumed', 2500);
    expect(loadPatience().events).toHaveLength(6);
    expect(currentHoldMs()).toBeGreaterThan(DEFAULT_HOLD_MS);
  });

  it('does nothing while learning is switched off, and the default is used', () => {
    setPatienceEnabled(false);
    expect(patienceEnabled()).toBe(false);
    for (let i = 0; i < 8; i++) recordHold('resumed', 2500);
    expect(loadPatience().events).toHaveLength(0);
    expect(currentHoldMs()).toBe(DEFAULT_HOLD_MS);
  });

  it('can be reset to the beginning', () => {
    for (let i = 0; i < 6; i++) recordHold('resumed', 2500);
    resetPatience();
    expect(loadPatience().events).toHaveLength(0);
    expect(currentHoldMs()).toBe(DEFAULT_HOLD_MS);
  });

  it('survives unreadable stored data', () => {
    window.localStorage.setItem('stay_patience_v1', '{not json');
    expect(loadPatience().events).toEqual([]);
    window.localStorage.setItem('stay_patience_v1', JSON.stringify({ v: 1, events: [{ k: 'x', ms: 1 }, { k: 'r', ms: 'a' }, { k: 'r', ms: 900 }] }));
    expect(loadPatience().events).toEqual([{ k: 'r', ms: 900 }]);
  });
});
