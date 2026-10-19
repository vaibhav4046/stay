import { describe, expect, it } from 'vitest';
import { JellySpring, SPRING_OMEGA, SPRING_ZETA, STAGGER, dotDelay, dotEase, dotProgress, springEase, MORPH_GLSL } from '@/lib/orb/morph';

describe('jelly morph easing', () => {
  it('starts at 0 and lands on exactly 1', () => {
    expect(springEase(0)).toBe(0);
    expect(springEase(-3)).toBe(0);
    expect(springEase(1)).toBe(1);
    expect(springEase(7)).toBe(1);
  });

  it('overshoots softly (a jelly, not a pogo stick) and then settles', () => {
    let peak = 0;
    let peakAt = 0;
    for (let i = 1; i < 1000; i++) {
      const t = i / 1000;
      const e = springEase(t);
      if (e > peak) {
        peak = e;
        peakAt = t;
      }
    }
    // analytic overshoot for this damping ratio is exp(-pi z / sqrt(1 - z^2)) ~ 10.6%
    const analytic = Math.exp((-Math.PI * SPRING_ZETA) / Math.sqrt(1 - SPRING_ZETA ** 2));
    expect(peak).toBeGreaterThan(1.04);
    expect(peak).toBeLessThan(1.2);
    expect(peak - 1).toBeCloseTo(analytic, 1);
    // first peak at pi / wd
    expect(peakAt).toBeCloseTo(Math.PI / (SPRING_OMEGA * Math.sqrt(1 - SPRING_ZETA ** 2)), 1);
    // it has settled to within 0.5% well before the end
    expect(Math.abs(springEase(0.95) - 1)).toBeLessThan(0.005);
  });

  it('is finite and continuous with no jump at the hand-over to the settled shape', () => {
    let prev = springEase(0);
    for (let i = 1; i <= 2000; i++) {
      const e = springEase(i / 2000);
      expect(Number.isFinite(e)).toBe(true);
      expect(Math.abs(e - prev)).toBeLessThan(0.03); // never a hard cut between consecutive steps
      prev = e;
    }
  });

  it('starts every dot from rest (zero initial velocity: no snap away from the old shape)', () => {
    expect(springEase(0.001)).toBeLessThan(0.002);
  });

  it('staggers: a later-starting dot has not moved when an early one is under way, yet everyone lands together', () => {
    const earlySeed = 0;
    const lateSeed = 1;
    const wave = 0.5;
    expect(dotDelay(earlySeed, wave)).toBeLessThan(dotDelay(lateSeed, wave));
    const mid = 0.25;
    expect(dotEase(mid, earlySeed, wave)).toBeGreaterThan(0.1);
    expect(dotEase(mid, lateSeed, wave)).toBe(0);
    expect(dotEase(1, earlySeed, wave)).toBe(1);
    expect(dotEase(1, lateSeed, wave)).toBe(1);
  });

  it('the wave term orders dots by distance from the centre of the destination', () => {
    const seed = 0.5;
    expect(dotDelay(seed, 0)).toBeLessThan(dotDelay(seed, 1));
    // the latest possible start still leaves a full dot-travel before mix reaches 1
    expect(dotProgress(1, 1)).toBeCloseTo(1, 10);
    expect(dotProgress(STAGGER, 1)).toBe(0);
  });

  it('the shader carries the same constants as the CPU maths (they cannot drift apart)', () => {
    expect(MORPH_GLSL).toContain(`SPRING_ZETA = ${SPRING_ZETA.toFixed(4)}`);
    expect(MORPH_GLSL).toContain(`SPRING_OMEGA = ${SPRING_OMEGA.toFixed(4)}`);
    expect(MORPH_GLSL).toContain(`STAGGER = ${STAGGER.toFixed(4)}`);
  });
});

describe('JellySpring (whole-body squash and stretch)', () => {
  it('rings after a kick, changes sign (a real wobble) and settles', () => {
    const j = new JellySpring();
    j.kick(2.6);
    let flips = 0;
    let last = 0;
    let maxAbs = 0;
    for (let i = 0; i < 60 * 4; i++) {
      const x = j.step(1 / 60);
      maxAbs = Math.max(maxAbs, Math.abs(x));
      if (last !== 0 && Math.sign(x) !== Math.sign(last) && x !== 0) flips++;
      if (x !== 0) last = x;
    }
    expect(flips).toBeGreaterThanOrEqual(2);
    expect(maxAbs).toBeLessThan(1.5); // bounded
    expect(Math.abs(j.x)).toBeLessThan(0.01);
    expect(Math.abs(j.v)).toBeLessThan(0.05);
  });

  it('behaves the same at 30 fps and 144 fps (frame-rate independent)', () => {
    const run = (fps: number) => {
      const j = new JellySpring();
      j.kick(2);
      let x = 0;
      for (let i = 0; i < fps * 0.5; i++) x = j.step(1 / fps);
      return x;
    };
    expect(run(30)).toBeCloseTo(run(144), 1);
  });

  it('survives a long stall without blowing up', () => {
    const j = new JellySpring();
    j.kick(3);
    const x = j.step(5);
    expect(Number.isFinite(x)).toBe(true);
    expect(Math.abs(x)).toBeLessThan(2);
  });
});
