import { describe, expect, it } from 'vitest';
import { LocalBargeIn } from '@/lib/voice/localBargeIn';

describe('T2.3 local barge-in: duck at once, cancel later', () => {
  it('ducks on the second loud frame while Stay is audible, not the first', () => {
    const b = new LocalBargeIn();
    expect(b.feed(0.5, true, 0)).toBeNull();
    expect(b.feed(0.5, true, 20)).toBe('duck');
    expect(b.isDucked).toBe(true);
  });

  it('a single click or cough does not duck', () => {
    const b = new LocalBargeIn();
    expect(b.feed(0.9, true, 0)).toBeNull();
    expect(b.feed(0.01, true, 20)).toBeNull();
    expect(b.feed(0.9, true, 40)).toBeNull(); // the count restarted
    expect(b.isDucked).toBe(false);
  });

  it('never ducks when Stay is silent: the mic is the person alone', () => {
    const b = new LocalBargeIn();
    for (let t = 0; t < 200; t += 20) expect(b.feed(0.9, false, t)).toBeNull();
    expect(b.isDucked).toBe(false);
  });

  it('lifts by itself 600 ms after the last loud frame when no real turn followed', () => {
    const b = new LocalBargeIn();
    b.feed(0.5, true, 0);
    b.feed(0.5, true, 20);
    expect(b.feed(0.01, true, 300)).toBeNull(); // still inside the hold
    expect(b.feed(0.01, true, 700)).toBe('unduck');
    expect(b.isDucked).toBe(false);
  });

  it('keeps ducked while the person keeps talking', () => {
    const b = new LocalBargeIn();
    b.feed(0.5, true, 0);
    b.feed(0.5, true, 20);
    for (let t = 40; t < 2000; t += 20) expect(b.feed(0.5, true, t)).toBeNull();
    expect(b.isDucked).toBe(true);
  });

  it('lifts at once if Stay stops being audible (the reply ended or was cancelled)', () => {
    const b = new LocalBargeIn();
    b.feed(0.5, true, 0);
    b.feed(0.5, true, 20);
    expect(b.feed(0.5, false, 40)).toBe('unduck');
  });

  it('reset forgets a duck', () => {
    const b = new LocalBargeIn();
    b.feed(0.5, true, 0);
    b.feed(0.5, true, 20);
    b.reset();
    expect(b.isDucked).toBe(false);
    expect(b.feed(0.5, true, 40)).toBeNull(); // counting from zero
  });

  it('thresholds can be tuned', () => {
    const b = new LocalBargeIn({ threshold: 0.1, frames: 1 });
    expect(b.feed(0.2, true, 0)).toBe('duck');
  });
});
