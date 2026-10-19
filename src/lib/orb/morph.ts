/**
 * Jelly morph maths, shared by the CPU (mid-flight retargeting, tests) and mirrored in the vertex shader.
 *
 * Each dot follows an under-damped spring (a ~11% overshoot, then it settles), starts at its own moment
 * (partly random, partly by distance from the centre of the destination so the shape pours outward like a
 * wobbling jelly), and the whole body squashes and stretches on a separate soft spring.
 */

export const SPRING_ZETA = 0.58;
export const SPRING_OMEGA = 10;
/** Fraction of the morph timeline spent on staggered starts. */
export const STAGGER = 0.4;
/** How much of a dot's start delay comes from its place in the destination (0 = pure random). */
export const WAVE_MIX = 0.6;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Step response of a damped spring: 0 at t=0, a soft overshoot, exactly 1 at t=1. */
export function springEase(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const root = Math.sqrt(1 - SPRING_ZETA * SPRING_ZETA);
  const wd = SPRING_OMEGA * root;
  const raw = 1 - Math.exp(-SPRING_ZETA * SPRING_OMEGA * t) * (Math.cos(wd * t) + (SPRING_ZETA / root) * Math.sin(wd * t));
  // the last few percent of the residue are blended out so the morph ends on exactly 1 (no pop on hand-over)
  return raw + (1 - raw) * smoothstep(0.9, 1, t);
}

/** Start delay of one dot in 0..1 from its random seed and its normalised distance from the destination centre. */
export function dotDelay(seed: number, wave: number): number {
  return seed + (clamp01(wave) - seed) * WAVE_MIX;
}

/** Local progress of one dot for the global morph progress `mix` (0..1). */
export function dotProgress(mix: number, delay: number): number {
  return clamp01((mix - delay * STAGGER) / (1 - STAGGER));
}

/** Eased position (0..1, may overshoot) of one dot. */
export function dotEase(mix: number, seed: number, wave: number): number {
  return springEase(dotProgress(mix, dotDelay(seed, wave)));
}

/**
 * The body-wide squash/stretch spring. Kick it when a morph starts and when most dots have landed; it rings
 * for about a second and settles. Semi-implicit Euler in fixed sub-steps so it is stable at any frame rate.
 */
export class JellySpring {
  x = 0;
  v = 0;
  constructor(private readonly k = 95, private readonly c = 5.2) {}
  kick(velocity: number): void {
    this.v += velocity;
  }
  step(dt: number): number {
    const h = 1 / 240;
    let left = Math.min(dt, 0.1);
    while (left > 1e-6) {
      const s = Math.min(h, left);
      this.v += (-this.k * this.x - this.c * this.v) * s;
      this.x += this.v * s;
      left -= s;
    }
    return this.x;
  }
}

/** GLSL twin of springEase/dotDelay/dotProgress, built from the same constants so the two cannot drift apart. */
export const MORPH_GLSL = /* glsl */ `
  const float SPRING_ZETA = ${SPRING_ZETA.toFixed(4)};
  const float SPRING_OMEGA = ${SPRING_OMEGA.toFixed(4)};
  const float STAGGER = ${STAGGER.toFixed(4)};
  const float WAVE_MIX = ${WAVE_MIX.toFixed(4)};
  float springEase(float t) {
    if (t <= 0.0) return 0.0;
    if (t >= 1.0) return 1.0;
    float root = sqrt(1.0 - SPRING_ZETA * SPRING_ZETA);
    float wd = SPRING_OMEGA * root;
    float raw = 1.0 - exp(-SPRING_ZETA * SPRING_OMEGA * t) * (cos(wd * t) + (SPRING_ZETA / root) * sin(wd * t));
    return raw + (1.0 - raw) * smoothstep(0.9, 1.0, t);
  }
  float dotT(float mixv, float seed, float wave) {
    float delay = seed + (clamp(wave, 0.0, 1.0) - seed) * WAVE_MIX;
    return clamp((mixv - delay * STAGGER) / (1.0 - STAGGER), 0.0, 1.0);
  }
`;
