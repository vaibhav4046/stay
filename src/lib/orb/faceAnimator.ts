/**
 * Turns "what is the agent saying right now" into the handful of numbers the figure's vertex shader animates:
 * mouth open/wide, blink, brow, head tilt/nod/sway, breath and gaze. Runs in the orb's rAF loop, allocation-free
 * apart from the returned frame object, with no React state in the hot path.
 */
import { mouthTarget, springFollow, type LipSyncBus, type Viseme } from './lipSync';

export interface FaceFrame {
  open: number;
  wide: number;
  blink: number;
  brow: number;
  tilt: number;
  nod: number;
  sway: number;
  breath: number;
  gazeX: number;
  gazeY: number;
}

export interface FaceInputs {
  dt: number;
  /** Seconds on the animation clock. */
  time: number;
  speaking: boolean;
  listening: boolean;
  /** Level to use when the bus has no audio timeline (speech-synthesis fallback, managed-agent hiccups). */
  fallbackLevel: number;
  reduced: boolean;
}

export const REST_FACE: FaceFrame = { open: 0, wide: 0, blink: 0, brow: 0, tilt: 0, nod: 0, sway: 0, breath: 0, gazeX: 0, gazeY: 0 };

const BLINK_SECONDS = 0.17;
/** Reduced motion keeps the mouth (it is the speech cue) but quieter and slower; everything decorative stops. */
const REDUCED_MOUTH_GAIN = 0.6;

export class FaceAnimator {
  private open = 0;
  private openV = 0;
  private wide = 0;
  private wideV = 0;
  private nodImpulse = 0;
  private nodImpulseV = 0;
  private browImpulse = 0;
  private slowLevel = 0;
  private recentPeak = 0;
  private armed = true;
  private vowel: Viseme | null = null;
  private bilabial = false;
  private closeUntil = -1;
  private nextBlinkAt: number;
  private blinkStart = -1;
  private gazeAt = 0;
  private gazeTX = 0;
  private gazeTY = 0;
  private gx = 0;
  private gy = 0;
  private lastGeneration = -1;
  /** Counts detected syllable onsets; tests and the debug hook read it. */
  onsets = 0;

  constructor(private readonly bus: LipSyncBus, private readonly rng: () => number = Math.random) {
    this.nextBlinkAt = 1.2 + this.rng() * 2;
  }

  update(inp: FaceInputs): FaceFrame {
    const { dt, time, reduced } = inp;
    if (this.bus.generation !== this.lastGeneration) {
      // a reply was cut off (barge-in) or finished: forget the pending vowels and let the mouth close
      this.lastGeneration = this.bus.generation;
      this.vowel = null;
      this.bilabial = false;
      this.armed = true;
    }

    // ---- input level: the real audio timeline when present, else the fallback energy while speaking
    const env = this.bus.now();
    let level = 0;
    let bright = 0.3;
    if (env.live) {
      level = env.level;
      bright = env.bright;
    } else if (inp.speaking) {
      level = Math.min(1, inp.fallbackLevel * 1.1);
    }

    // ---- syllable onsets drive the vowel shape and the small head/brow beats
    this.slowLevel += (level - this.slowLevel) * Math.min(1, dt / 0.25);
    this.recentPeak = Math.max(level, this.recentPeak - dt * 0.9);
    const onsetThreshold = Math.max(0.14, this.slowLevel * 1.18);
    if (this.armed && level > onsetThreshold) {
      this.armed = false;
      this.onsets++;
      const syl = this.bus.nextSyllable();
      this.vowel = syl ? syl.vowel : null;
      this.bilabial = !!syl?.bilabialAfter;
      if (!reduced) {
        this.nodImpulseV += 0.55 * level;
        this.browImpulse = Math.min(1, this.browImpulse + 0.5 * level);
      }
    } else if (!this.armed && (level < this.recentPeak * 0.55 || level < 0.1)) {
      this.armed = true;
      if (this.bilabial) this.closeUntil = time + 0.07; // lips meet in the gap before the next sound
      this.bilabial = false;
    }

    // ---- mouth
    let tgt = mouthTarget(level, bright, this.vowel);
    if (time < this.closeUntil) tgt = { open: 0, wide: tgt.wide * 0.3 };
    const gain = reduced ? REDUCED_MOUTH_GAIN : 1;
    const opening = tgt.open > this.open;
    const omega = reduced ? 18 : opening ? 38 : 26;
    [this.open, this.openV] = springFollow(this.open, this.openV, tgt.open * gain, dt, omega, 0.9);
    [this.wide, this.wideV] = springFollow(this.wide, this.wideV, tgt.wide * gain, dt, reduced ? 14 : 22, 0.9);
    if (this.open < 0.004 && tgt.open === 0) this.open = 0;

    if (reduced) {
      return { ...REST_FACE, open: Math.max(0, Math.min(1, this.open)), wide: this.wide };
    }

    // ---- blink: a quick close and a slightly slower open, every few seconds, sometimes twice
    let blink = 0;
    if (this.blinkStart < 0 && time >= this.nextBlinkAt) this.blinkStart = time;
    if (this.blinkStart >= 0) {
      const u = (time - this.blinkStart) / BLINK_SECONDS;
      if (u >= 1) {
        this.blinkStart = -1;
        this.nextBlinkAt = time + (this.rng() < 0.18 ? 0.22 : 2.4 + this.rng() * 3.4);
      } else {
        blink = Math.sin(Math.PI * (u < 0.4 ? u / 0.8 : 0.5 + (u - 0.4) / 1.2));
      }
    }

    // ---- head: slow ambient drift + a nod on each syllable, leaning in a little when listening
    [this.nodImpulse, this.nodImpulseV] = springFollow(this.nodImpulse, this.nodImpulseV, 0, dt, 13, 0.55);
    this.browImpulse = Math.max(0, this.browImpulse - dt * 1.6);
    const lean = inp.listening && !inp.speaking ? 1 : 0;
    const tilt = 0.026 * Math.sin(time * 0.41) + 0.014 * Math.sin(time * 1.13 + 0.7) + lean * 0.04;
    const nod = 0.006 * Math.sin(time * 0.73 + 0.4) - this.nodImpulse * 0.022;
    const sway = 0.012 * Math.sin(time * 0.29 + 1.0);
    const breath = Math.sin(time * (inp.speaking ? 1.5 : 1.05));

    // ---- gaze: unhurried glances, mostly to the viewer while speaking
    if (time >= this.gazeAt) {
      this.gazeAt = time + 1.1 + this.rng() * 2.4;
      const toViewer = inp.speaking ? 0.7 : 0.35;
      const away = this.rng() > toViewer;
      this.gazeTX = away ? (this.rng() * 2 - 1) * 0.8 : 0;
      this.gazeTY = away ? (this.rng() * 2 - 1) * 0.4 : 0;
    }
    this.gx += (this.gazeTX - this.gx) * Math.min(1, dt * 9);
    this.gy += (this.gazeTY - this.gy) * Math.min(1, dt * 9);

    return {
      open: Math.max(0, Math.min(1, this.open)),
      wide: Math.max(-1, Math.min(1, this.wide)),
      blink,
      brow: Math.min(1, this.browImpulse * 0.6 + lean * 0.35 + level * 0.15),
      tilt,
      nod,
      sway,
      breath,
      gazeX: this.gx,
      gazeY: this.gy,
    };
  }
}
