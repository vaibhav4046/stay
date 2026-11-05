'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { CLOSE_MS, OPEN_MS, SNAP_MS, START, dragFold, foldCurve, foldReduce, releaseVelocity, snapTarget, tweenMs, type FoldEvent, type FoldMachine, type Head } from './foldMotion';

const STACKED = '(max-width: 639.98px)'; // the same breakpoint as fold.css: the spine is horizontal and the fold is dragged up and down
const SLOP = 6; // px a pointer may wander and still be a tap

type Tween = { from: number; to: number; ms: number; at: number; head: Head; snap: boolean; user: boolean };
type Drag = { id: number; ox: number; oy: number; f0: number; tall: boolean; range: number; eligible: boolean; grabbed: boolean; moved: boolean; samples: Array<{ t: number; f: number }> };

/**
 * Moves the fold. The angle is one CSS custom property, `--fold` (0 open, 1 shut), written straight to the device in requestAnimationFrame, by a
 * small tween (button, tap, the automatic fold) or by the pointer (a drag): React is told only when the state changes, never per frame.
 * A tween the person started keeps going when the example is paused; one the timeline started stops where it is, and goes on when it plays again.
 */
class FoldDriver {
  m: FoldMachine = START;
  fold = 0;
  halted = false;
  reduced = false;
  el: HTMLElement | null = null;
  sync: (m: FoldMachine) => void = () => {};
  onUser: (m: FoldMachine) => void = () => {};
  private tw: Tween | null = null;
  private raf = 0;
  private last = 0;
  private dragRaf = 0;
  private pending = 0;

  write = (v: number) => {
    this.fold = v;
    this.el?.style.setProperty('--fold', v.toFixed(4));
  };

  send = (e: FoldEvent, ms?: number) => {
    const prev = this.m;
    let next = foldReduce(prev, e);
    if (next === prev) return;
    if (this.reduced && (next.state === 'closing' || next.state === 'opening')) next = foldReduce(next, { type: 'settled' }); // no swing: it just is shut, or open
    this.m = next;
    this.sync(next);
    if (next.state === 'dragging') this.stop();
    else if (next.state === 'closing' || next.state === 'opening') this.run(next.head, next.by === 'user', ms);
    else if (this.reduced) this.write(0);
  };

  /** The button (and a tap): the person folds or unfolds. */
  toggle = () => {
    if (this.m.state === 'dragging') return;
    this.onUser(this.m);
    this.send({ type: 'request', to: this.m.head === 'closed' ? 'open' : 'closed', by: 'user' });
  };

  /** Reduced motion on or off: land where the device is going, flat; leaving it, put the angle back. */
  setReduced = (reduced: boolean) => {
    this.reduced = reduced;
    this.stop();
    if (reduced) {
      if (this.m.state === 'dragging') this.send({ type: 'release', to: this.m.head });
      this.send({ type: 'settled' });
      this.write(0);
    } else {
      if (this.m.state === 'closing' || this.m.state === 'opening') this.send({ type: 'settled' });
      this.write(this.m.state === 'closed' ? 1 : 0);
    }
  };

  setHalted = (halted: boolean) => {
    this.halted = halted;
    if (!halted) this.kick();
  };

  private run(head: Head, user: boolean, snapMs?: number) {
    const to = head === 'closed' ? 1 : 0;
    const snap = snapMs !== undefined;
    const ms = snapMs ?? tweenMs(head === 'closed' ? CLOSE_MS : OPEN_MS, this.fold, to);
    this.tw = { from: this.fold, to, ms, at: 0, head, snap, user };
    this.kick();
  }

  private stop() {
    this.tw = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private kick() {
    if (this.raf || !this.tw) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const w = this.tw;
    if (!w || (this.halted && !w.user)) return; // frozen: setHalted(false) starts it again
    w.at += this.last ? Math.min(now - this.last, 48) : 0; // a long gap (a hidden tab) is not a jump
    this.last = now;
    const p = Math.min(1, w.at / w.ms);
    this.write(w.from + (w.to - w.from) * foldCurve(w.head, p, w.snap));
    if (p < 1) {
      this.raf = requestAnimationFrame(this.frame);
      return;
    }
    this.tw = null;
    this.write(w.to);
    this.send({ type: 'settled' });
  };

  /** The pointer: a tap toggles; dragging the second half (or the lid, when shut) turns it about the spine with the pointer. */
  attach(hit: HTMLElement): () => void {
    let d: Drag | null = null;
    const down = (e: PointerEvent) => {
      if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const r = hit.getBoundingClientRect();
      const tall = window.matchMedia(STACKED).matches;
      const range = (tall ? r.height : r.width) / 2; // one half: the distance the pointer goes for a whole fold
      const along = tall ? e.clientY - r.top : e.clientX - r.left;
      d = { id: e.pointerId, ox: e.clientX, oy: e.clientY, f0: this.fold, tall, range, eligible: !this.reduced && (this.fold >= 0.5 || along >= range), grabbed: false, moved: false, samples: [] };
      try { hit.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer: nothing to capture */ }
      if (e.pointerType === 'mouse') e.preventDefault(); // no text selection, no native drag
    };
    const move = (e: PointerEvent) => {
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved) {
        if (Math.hypot(e.clientX - d.ox, e.clientY - d.oy) < SLOP) return;
        d.moved = true;
        if (!d.eligible) return;
        d.grabbed = true;
        this.send({ type: 'grab' });
        d.f0 = this.fold; // from wherever it had got to; the pointer's start is here
        d.ox = e.clientX;
        d.oy = e.clientY;
      }
      if (!d.grabbed) return;
      const travel = d.tall ? d.oy - e.clientY : d.ox - e.clientX; // toward shutting: up when stacked, left when side by side
      const f = dragFold(d.f0, travel, d.range);
      d.samples.push({ t: e.timeStamp, f });
      if (d.samples.length > 12) d.samples.shift();
      this.pending = f;
      if (!this.dragRaf) {
        this.dragRaf = requestAnimationFrame(() => {
          this.dragRaf = 0;
          this.write(this.pending);
        });
      }
    };
    const end = (e: PointerEvent, cancelled: boolean) => {
      if (!d || e.pointerId !== d.id) return;
      const g = d;
      d = null;
      try { hit.releasePointerCapture(g.id); } catch { /* already released */ }
      if (g.grabbed) {
        if (this.dragRaf) cancelAnimationFrame(this.dragRaf);
        this.dragRaf = 0;
        this.write(this.pending);
        this.onUser(this.m);
        this.send({ type: 'release', to: snapTarget(this.fold, releaseVelocity(g.samples, e.timeStamp)) }, SNAP_MS);
      } else if (!g.moved && !cancelled) {
        this.toggle();
      }
    };
    const up = (e: PointerEvent) => end(e, false);
    const cancel = (e: PointerEvent) => end(e, true);
    hit.addEventListener('pointerdown', down);
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerup', up);
    hit.addEventListener('pointercancel', cancel);
    return () => {
      hit.removeEventListener('pointerdown', down);
      hit.removeEventListener('pointermove', move);
      hit.removeEventListener('pointerup', up);
      hit.removeEventListener('pointercancel', cancel);
      if (this.dragRaf) cancelAnimationFrame(this.dragRaf);
      this.dragRaf = 0;
    };
  }

  dispose() {
    this.stop();
  }
}

export function useFoldDevice(opts: { deviceRef: RefObject<HTMLElement | null>; hitRef: RefObject<HTMLElement | null>; halted: boolean; reduced: boolean; onUser: (m: FoldMachine) => void }) {
  const [fm, setFm] = useState<FoldMachine>(START);
  const ref = useRef<FoldDriver | null>(null);
  if (!ref.current) ref.current = new FoldDriver();
  const driver = ref.current;
  driver.sync = setFm;
  driver.onUser = opts.onUser;

  useEffect(() => {
    driver.el = opts.deviceRef.current;
    const hit = opts.hitRef.current;
    const detach = hit ? driver.attach(hit) : undefined;
    return () => {
      detach?.();
      driver.dispose();
    };
  }, [driver, opts.deviceRef, opts.hitRef]);
  useEffect(() => {
    driver.setReduced(opts.reduced);
  }, [driver, opts.reduced]);
  useEffect(() => {
    driver.setHalted(opts.halted);
  }, [driver, opts.halted]);

  return { fm, driver };
}
