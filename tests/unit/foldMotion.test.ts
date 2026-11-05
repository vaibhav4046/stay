import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  AUTO_UNFOLD_MS,
  FOLD_DEG,
  START,
  angleOf,
  autoDecision,
  dragFold,
  foldCurve,
  foldReduce,
  isMoving,
  releaseVelocity,
  snapTarget,
  tweenMs,
  type FoldEvent,
  type FoldMachine,
} from '@/components/landing/foldMotion';

const run = (events: FoldEvent[], from: FoldMachine = START) => events.reduce(foldReduce, from);
const ask = (to: 'open' | 'closed', by: 'auto' | 'user' = 'user'): FoldEvent => ({ type: 'request', to, by });

describe('fold state machine', () => {
  it('goes open, closing, closed, opening, open', () => {
    const closing = run([ask('closed')]);
    expect(closing).toEqual({ state: 'closing', head: 'closed', by: 'user' });
    const closed = run([{ type: 'settled' }], closing);
    expect(closed.state).toBe('closed');
    const opening = run([ask('open')], closed);
    expect(opening).toMatchObject({ state: 'opening', head: 'open' });
    expect(run([{ type: 'settled' }], opening).state).toBe('open');
  });

  it('turns round in the middle of a fold: the person can change their mind', () => {
    expect(run([ask('closed'), ask('open')]).state).toBe('opening');
    expect(run([ask('closed'), { type: 'settled' }, ask('open'), ask('closed')]).state).toBe('closing');
  });

  it('a request for where it already is changes nothing (the same object comes back)', () => {
    expect(foldReduce(START, ask('open'))).toBe(START);
    const closed = run([ask('closed'), { type: 'settled' }]);
    expect(foldReduce(closed, ask('closed'))).toBe(closed);
    expect(foldReduce(closed, { type: 'settled' })).toBe(closed);
  });

  it('remembers who asked: the timeline folds by auto, the person by user, and a later request takes over', () => {
    expect(run([ask('closed', 'auto')]).by).toBe('auto');
    expect(run([ask('closed', 'auto'), ask('open', 'user')]).by).toBe('user');
    const left = run([ask('closed', 'user'), { type: 'settled' }]);
    expect(run([ask('closed', 'auto')], left)).toEqual({ state: 'closed', head: 'closed', by: 'auto' }); // a scene chosen while it was folded
  });

  it('holding the device: grab from any state, requests are ignored, let go goes to the chosen end', () => {
    for (const from of [START, run([ask('closed')]), run([ask('closed'), { type: 'settled' }]), run([ask('closed'), { type: 'settled' }, ask('open')])]) {
      const held = run([{ type: 'grab' }], from);
      expect(held.state).toBe('dragging');
      expect(held.by).toBe('user');
      expect(held.head).toBe(from.head); // the button still says what it said when it was picked up
      expect(foldReduce(held, ask('closed', 'auto'))).toBe(held);
      expect(foldReduce(held, ask('open'))).toBe(held);
      expect(foldReduce(held, { type: 'settled' })).toBe(held);
    }
    const held = run([{ type: 'grab' }]);
    expect(foldReduce(held, { type: 'release', to: 'closed' })).toEqual({ state: 'closing', head: 'closed', by: 'user' });
    expect(foldReduce(held, { type: 'release', to: 'open' })).toEqual({ state: 'opening', head: 'open', by: 'user' });
    expect(foldReduce(START, { type: 'release', to: 'closed' })).toBe(START); // letting go of nothing
  });

  it('knows which states are moving', () => {
    expect(['closing', 'opening', 'dragging'].every((s) => isMoving(s as FoldMachine['state']))).toBe(true);
    expect(isMoving('open')).toBe(false);
    expect(isMoving('closed')).toBe(false);
  });
});

describe('dragging and snapping', () => {
  it('turns in proportion to the drag and stops at both ends', () => {
    expect(dragFold(0, 0, 300)).toBe(0);
    expect(dragFold(0, 150, 300)).toBeCloseTo(0.5);
    expect(dragFold(0, 600, 300)).toBe(1);
    expect(dragFold(0.4, -100, 300)).toBeCloseTo(0.4 - 1 / 3);
    expect(dragFold(0.1, -500, 300)).toBe(0);
    expect(dragFold(1, -150, 300)).toBeCloseTo(0.5); // from shut, dragging the other way opens it
  });

  it('lets go past the half way point shut, short of it open', () => {
    expect(snapTarget(0.49, 0)).toBe('open');
    expect(snapTarget(0.5, 0)).toBe('closed');
    expect(snapTarget(0.9, 0)).toBe('closed');
    expect(snapTarget(0.1, 0)).toBe('open');
  });

  it('counts a flick: fast toward shut from a little way, fast toward open from a long way', () => {
    expect(snapTarget(0.3, 2.5)).toBe('closed');
    expect(snapTarget(0.7, -2.5)).toBe('open');
    expect(snapTarget(0.3, -2.5)).toBe('open');
    expect(snapTarget(0.7, 2.5)).toBe('closed');
  });

  it('measures the speed of the last 120 ms in folds per second', () => {
    expect(releaseVelocity([], 1000)).toBe(0);
    expect(releaseVelocity([{ t: 990, f: 0.2 }], 1000)).toBe(0);
    expect(releaseVelocity([{ t: 900, f: 0.1 }, { t: 950, f: 0.2 }, { t: 1000, f: 0.3 }], 1000)).toBeCloseTo(2);
    expect(releaseVelocity([{ t: 500, f: 0.1 }, { t: 990, f: 0.4 }, { t: 1000, f: 0.4 }], 1000)).toBe(0); // the old sample is too old to count
  });

  it('the angle is the fold times the turn the CSS makes', () => {
    expect(angleOf(0)).toBe(0);
    expect(angleOf(1)).toBe(FOLD_DEG);
    expect(angleOf(0.5)).toBeCloseTo(FOLD_DEG / 2);
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'app', 'fold.css'), 'utf8');
    expect(css).toContain(`* -${FOLD_DEG}deg`); // wide: rotateY
    expect(css).toContain(`* ${FOLD_DEG}deg`); // stacked: rotateX
  });
});

describe('the curves', () => {
  it('start at 0 and end at exactly 1, both ways, snapped or not', () => {
    for (const to of ['closed', 'open'] as const) {
      for (const snap of [false, true]) {
        expect(foldCurve(to, 0, snap)).toBeCloseTo(0, 6);
        expect(foldCurve(to, 1, snap)).toBeCloseTo(1, 6);
      }
    }
  });

  it('shutting never goes past shut and ends with a small rebound; opening goes a few degrees past flat and settles', () => {
    let low = 1;
    let high = 0;
    for (let i = 0; i <= 200; i++) {
      const c = foldCurve('closed', i / 200, false);
      expect(c).toBeLessThanOrEqual(1 + 1e-9);
      if (i / 200 > 0.78) low = Math.min(low, c);
      const o = foldCurve('open', i / 200, false);
      high = Math.max(high, o);
    }
    expect(low).toBeGreaterThan(0.97); // a hair
    expect(low).toBeLessThan(0.995); // but you can see it
    expect(high).toBeGreaterThan(1.01);
    expect(high).toBeLessThan(1.02); // 1.5 per cent of the turn: about 2.5 degrees
  });

  it('a fold the person started is rising all the way to the rebound', () => {
    let prev = -1;
    for (let i = 0; i <= 78; i++) {
      const c = foldCurve('closed', i / 100, true);
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });

  it('takes less time for part of the way, never under 180 ms', () => {
    expect(tweenMs(540, 0, 1)).toBe(540);
    expect(tweenMs(600, 1, 0)).toBe(600);
    expect(tweenMs(540, 0.5, 1)).toBeCloseTo(270);
    expect(tweenMs(540, 0.9, 1)).toBe(180);
  });
});

describe('the automatic timeline', () => {
  const base = { state: 'open' as const, by: 'auto' as const, foldedMs: 0, quietMs: 0, wantSwap: false };

  it('folds when the call has ended, and not before', () => {
    expect(autoDecision(base)).toBeNull();
    expect(autoDecision({ ...base, wantSwap: true })).toBe('fold');
  });

  it('waits 12 s after the person touched the device', () => {
    expect(autoDecision({ ...base, wantSwap: true, quietMs: 12000 })).toBeNull();
    expect(autoDecision({ ...base, wantSwap: true, quietMs: 60 })).toBeNull();
    expect(autoDecision({ ...base, wantSwap: true, quietMs: 0 })).toBe('fold');
  });

  it('does nothing while the person holds the device or it is already moving', () => {
    for (const state of ['dragging', 'closing', 'opening'] as const) {
      expect(autoDecision({ ...base, state, wantSwap: true })).toBeNull();
    }
  });

  it('opens a fold the person left alone after 6 s, and only theirs', () => {
    const left = { ...base, state: 'closed' as const, by: 'user' as const };
    expect(autoDecision({ ...left, foldedMs: AUTO_UNFOLD_MS - 60 })).toBeNull();
    expect(autoDecision({ ...left, foldedMs: AUTO_UNFOLD_MS })).toBe('unfold');
    expect(autoDecision({ ...left, by: 'auto', foldedMs: AUTO_UNFOLD_MS * 2 })).toBeNull(); // the timeline's own shut is handled by the scene swap
    expect(autoDecision({ ...left, foldedMs: AUTO_UNFOLD_MS, wantSwap: true })).toBe('unfold'); // never folds a folded device
  });
});
