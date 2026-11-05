/**
 * How the hero's foldable moves. Pure numbers and one small state machine, so it can be tested; HeroExample.tsx and useFoldDevice.ts run it.
 * The whole fold is ONE number, `fold`: 0 is open, 1 is shut. fold.css turns it into the angle, the glass, the light and the shadow, so the
 * automatic timeline, the button, a tap and a drag all move the same thing the same way.
 */
export type FoldState = 'open' | 'closing' | 'closed' | 'opening' | 'dragging';
export type Head = 'open' | 'closed'; // where the device is going (or is): the button says the opposite
export type By = 'auto' | 'user';
export type FoldMachine = { state: FoldState; head: Head; by: By };
export type FoldEvent =
  | { type: 'request'; to: Head; by: By }
  | { type: 'grab' }
  | { type: 'release'; to: Head }
  | { type: 'settled' };

export const FOLD_DEG = 180; // the second half lies exactly over the first (fold.css turns by the same number)
export const CLOSE_MS = 540;
export const OPEN_MS = 600;
export const SNAP_MS = 450; // a released drag springs to the nearer end in about this long
export const AUTO_UNFOLD_MS = 6000; // left folded by the person, it opens itself after this
export const QUIET_MS = 12000; // after any fold or unfold by the person, the automatic fold waits this long
const RECENT_MS = 120;
const MIN_TWEEN_MS = 180;
const LOOKAHEAD_S = 0.16; // a flick counts as where it would have got to in this long

export const START: FoldMachine = { state: 'open', head: 'open', by: 'auto' };

const same = (a: FoldMachine, b: FoldMachine) => a.state === b.state && a.head === b.head && a.by === b.by;
const make = (m: FoldMachine, state: FoldState, head: Head, by: By = m.by): FoldMachine => {
  const n = { state, head, by };
  return same(m, n) ? m : n;
};

/** One step. Returns the same object when nothing changes. A request while the person holds the device is ignored. */
export function foldReduce(m: FoldMachine, e: FoldEvent): FoldMachine {
  switch (e.type) {
    case 'request':
      if (m.state === 'dragging') return m;
      if (e.to === 'closed') return make(m, m.state === 'closed' ? 'closed' : 'closing', 'closed', e.by);
      return m.state === 'open' ? m : make(m, 'opening', 'open', e.by); // open already: who asked does not matter
    case 'grab':
      return make(m, 'dragging', m.head, 'user');
    case 'release':
      return m.state === 'dragging' ? make(m, e.to === 'closed' ? 'closing' : 'opening', e.to, 'user') : m;
    case 'settled':
      if (m.state === 'closing') return make(m, 'closed', 'closed');
      if (m.state === 'opening') return make(m, 'open', 'open');
      return m;
  }
}

/** Does the device keep moving (so the browser should prepare it)? */
export const isMoving = (s: FoldState) => s === 'closing' || s === 'opening' || s === 'dragging';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const angleOf = (fold: number) => fold * FOLD_DEG;

/** The fold while dragging: `travel` is how far the pointer has gone toward shutting (px), `range` how far is a whole fold. */
export const dragFold = (start: number, travel: number, range: number) => clamp01(start + travel / range);

/** Where a released drag goes: past the half way point, shut; a flick (fold per second) counts for a little more. */
export const snapTarget = (fold: number, velocity: number): Head => (fold + velocity * LOOKAHEAD_S >= 0.5 ? 'closed' : 'open');

/** Fold per second over the last moments of a drag (RECENT_MS); `samples` are {t: ms, f: fold}. */
export function releaseVelocity(samples: ReadonlyArray<{ t: number; f: number }>, now: number): number {
  const recent = samples.filter((s) => now - s.t <= RECENT_MS);
  if (recent.length < 2) return 0;
  const a = recent[0];
  const b = recent[recent.length - 1];
  return b.t > a.t ? ((b.f - a.f) / (b.t - a.t)) * 1000 : 0;
}

const inOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2); // cubic-bezier(.65, 0, .35, 1)
const out = (p: number) => 1 - Math.pow(1 - p, 3);

/**
 * How far along the way from start to end the fold is at progress p (0 to 1). Shutting arrives, touches and rebounds a hair (the little knock of
 * a hinge that has met its stop); opening goes a few degrees past flat and settles back. A drag that is let go (snap) starts quick, because the
 * hand has already given it speed.
 */
export function foldCurve(to: Head, p: number, snap: boolean): number {
  const q = clamp01(p);
  const lead = snap ? out : inOut;
  if (to === 'closed') {
    if (q < 0.78) return lead(q / 0.78);
    return 1 - 0.018 * Math.sin(((q - 0.78) / 0.22) * Math.PI);
  }
  if (q < 0.8) return 1.015 * lead(q / 0.8);
  return 1.015 - 0.015 * out((q - 0.8) / 0.2);
}

/** How long a fold from `from` to `to` takes: the full time for the whole way, less for a part of it (never under MIN_TWEEN_MS). */
export const tweenMs = (full: number, from: number, to: number) => Math.max(MIN_TWEEN_MS, full * Math.abs(to - from));

/**
 * What the automatic timeline does on this tick. `wantSwap`: the call has ended (or another scene was chosen) and the device should fold,
 * swap the scene while shut, and open. The person is in charge after they touch it: no auto fold for QUIET_MS, and a fold they leave alone
 * opens again after AUTO_UNFOLD_MS. While they hold the device nothing automatic happens.
 */
export function autoDecision(a: { state: FoldState; by: By; foldedMs: number; quietMs: number; wantSwap: boolean }): 'unfold' | 'fold' | null {
  if (a.state === 'closed' && a.by === 'user' && a.foldedMs >= AUTO_UNFOLD_MS) return 'unfold';
  if (a.state === 'open' && a.wantSwap && a.quietMs <= 0) return 'fold';
  return null;
}
