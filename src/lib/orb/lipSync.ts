/**
 * Lip sync for the dot figure. Two honest inputs, no model and no network:
 *  - the REAL output audio of the agent: a short-window envelope (loudness) and a brightness measure (how much
 *    of the energy is high-frequency, i.e. s/f/ee versus ah/oh) are computed from the PCM we already decode, and
 *    looked up at the playback clock, so the mouth follows what is being heard, not what has merely arrived;
 *  - the text being spoken, where we have it: each vowel group becomes a mouth shape that is advanced at every
 *    detected syllable onset, and a bilabial (m, b, p) after the vowel closes the lips at the next dip.
 * Everything here is pure maths or a tiny store; nothing touches React or the network.
 */

export type Viseme = 'AA' | 'EH' | 'EE' | 'OH' | 'OO' | 'IH' | 'UH';

export interface MouthShape {
  /** 0 = lips together, 1 = fully open. */
  open: number;
  /** -1 = rounded "oo", 0 = neutral, +1 = spread "ee". */
  wide: number;
}

/** Mouth shape each vowel class aims for at full loudness. */
export const VISEME_SHAPES: Record<Viseme, MouthShape> = {
  AA: { open: 1.0, wide: 0.15 },
  EH: { open: 0.62, wide: 0.55 },
  IH: { open: 0.42, wide: 0.6 },
  EE: { open: 0.3, wide: 1.0 },
  OH: { open: 0.74, wide: -0.55 },
  UH: { open: 0.55, wide: -0.1 },
  OO: { open: 0.32, wide: -1.0 },
};

export interface Syllable {
  vowel: Viseme;
  /** The consonant right after this vowel is a lip-closer (m, b, p): the lips meet in the gap that follows. */
  bilabialAfter: boolean;
}

const DIGRAPHS: Array<[RegExp, Viseme]> = [
  [/^(oo|ew|ue|ou|u(?=[^aeiou]e))/, 'OO'],
  [/^(ee|ea|ie|ei|y$)/, 'EE'],
  [/^(oa|ow|oh|o(?=[^aeiou]e))/, 'OH'],
  [/^(ai|ay|ey)/, 'EH'],
  [/^(au|aw)/, 'AA'],
];
const SINGLE: Record<string, Viseme> = { a: 'AA', e: 'EH', i: 'IH', o: 'OH', u: 'UH', y: 'IH' };

/** Rough English-ish vowel groups with the following bilabial flag. Other scripts return [] (audio-only mapping). */
export function textToSyllables(text: string): Syllable[] {
  const words = text.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const out: Syllable[] = [];
  for (const word of words) {
    let i = 0;
    while (i < word.length) {
      if (!/[aeiouy]/.test(word[i])) {
        i++;
        continue;
      }
      // a final silent "e" after a consonant adds no syllable ("make", "home")
      if (word[i] === 'e' && i === word.length - 1 && i > 1 && out.length > 0 && !/[aeiou]/.test(word[i - 1])) {
        i++;
        continue;
      }
      const rest = word.slice(i);
      let vowel: Viseme | null = null;
      let len = 1;
      for (const [re, v] of DIGRAPHS) {
        const m = rest.match(re);
        if (m) {
          vowel = v;
          len = Math.max(1, m[0].length);
          break;
        }
      }
      if (!vowel) vowel = SINGLE[word[i]] ?? 'EH';
      // a lone final e in a short word is "ee" (me, he, she, we, be)
      if (vowel === 'EH' && word[i] === 'e' && i === word.length - 1 && !/[aeiouy]/.test(word.slice(0, i))) vowel = 'EE';
      let j = i + len;
      while (j < word.length && /[aeiouy]/.test(word[j])) j++; // swallow the rest of a vowel run
      out.push({ vowel, bilabialAfter: j < word.length && 'mbp'.includes(word[j]) });
      i = j;
    }
  }
  return out;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * Where the mouth wants to be this instant. `level` is the loudness envelope (0..1), `bright` the high-frequency
 * share (0..1), `vowel` the current text-derived class when there is one.
 */
export function mouthTarget(level: number, bright: number, vowel: Viseme | null): MouthShape {
  const L = clamp01(level);
  if (L < 0.035) return { open: 0, wide: 0 };
  const loud = smooth(0.04, 0.5, L); // a quiet word opens a little, a full voice opens fully
  let shape: MouthShape;
  if (vowel) {
    shape = VISEME_SHAPES[vowel];
    // bright energy (s, sh, f, ee) narrows the opening and spreads the lips even when the text says "ah"
    const b = smooth(0.4, 0.85, bright);
    shape = { open: shape.open * (1 - 0.45 * b), wide: shape.wide + (1 - shape.wide) * 0.45 * b };
  } else {
    // audio only: dark/warm sound = open vowel, bright sound = narrow spread mouth, in between = mid
    const b = smooth(0.18, 0.8, bright);
    shape = { open: 1 - 0.7 * b, wide: -0.35 + 1.3 * b };
  }
  return { open: clamp01(shape.open * (0.16 + 0.84 * loud)), wide: Math.max(-1, Math.min(1, shape.wide)) };
}

/** Critically-damped-ish follower: returns the new [value, velocity]. Stable for any dt (sub-stepped). */
export function springFollow(value: number, velocity: number, target: number, dt: number, omega = 28, zeta = 0.95): [number, number] {
  let x = value;
  let v = velocity;
  let left = Math.min(dt, 0.1);
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120);
    v += (-omega * omega * (x - target) - 2 * zeta * omega * v) * h;
    x += v * h;
    left -= h;
  }
  return [x, v];
}

// ---------------------------------------------------------------- envelope extraction

/** One envelope sample every 20 ms is plenty for a mouth (50 Hz) and keeps the per-chunk cost trivial. */
export const ENV_HOP_SECONDS = 0.02;

export interface EnvelopeFrame {
  level: number;
  bright: number;
}

/**
 * Loudness and brightness per 20 ms window of mono audio. Loudness is RMS scaled so normal speech lands around
 * 0.3 to 0.9; brightness is the share of energy in the sample-to-sample difference (a cheap high-pass), which is
 * high for sibilants and front vowels and low for open back vowels.
 */
export function analyseChunk(samples: Float32Array, sampleRate: number): EnvelopeFrame[] {
  const hop = Math.max(1, Math.round(sampleRate * ENV_HOP_SECONDS));
  const out: EnvelopeFrame[] = [];
  for (let s = 0; s < samples.length; s += hop) {
    const end = Math.min(samples.length, s + hop);
    let e = 0;
    let d = 0;
    let prev = s > 0 ? samples[s - 1] : 0;
    for (let i = s; i < end; i++) {
      const x = samples[i];
      e += x * x;
      const dx = x - prev;
      d += dx * dx;
      prev = x;
    }
    const n = end - s;
    const rms = Math.sqrt(e / n);
    // a first difference of white noise carries 2x the energy; of a 200 Hz vowel at 24 kHz almost none
    const ratio = e > 1e-9 ? Math.sqrt(d / e) : 0;
    out.push({ level: clamp01(rms * 3.8), bright: clamp01(ratio / 1.2) });
  }
  return out;
}

// ---------------------------------------------------------------- the bus between the audio path and the orb

const RING = 2048; // 40 s of 20 ms frames: far more than ever scheduled ahead

/**
 * A timeline of envelope frames keyed by AudioContext time, plus the text being spoken. The voice hook pushes
 * into it from the hot audio path (microseconds); the orb reads it from requestAnimationFrame. It is a plain
 * singleton on purpose: routing 50 Hz mouth data through React state would re-render the page.
 */
export class LipSyncBus {
  private times = new Float64Array(RING);
  private levels = new Float32Array(RING);
  private brights = new Float32Array(RING);
  private head = 0; // next write slot
  private count = 0;
  private lastEnd = 0;
  private clock: (() => number) | null = null;
  private ctx: object | null = null;
  private latency: () => number = () => 0;
  private syllables: Syllable[] = [];
  private syllableCursor = 0;
  /** Bumped on reset(); lets tests and readers detect an interrupted reply. */
  generation = 0;

  /** Wire the playback clock (an AudioContext). Latency is subtracted so the mouth matches what is audible now. */
  attachClock(ctx: { currentTime: number; outputLatency?: number; baseLatency?: number }): void {
    if (this.ctx === ctx) return; // called for every chunk; only the first call per AudioContext does anything
    this.ctx = ctx;
    this.clock = () => ctx.currentTime;
    this.latency = () => (Number.isFinite(ctx.outputLatency) ? (ctx.outputLatency as number) : Number.isFinite(ctx.baseLatency) ? (ctx.baseLatency as number) : 0);
  }

  /** Test seam: drive the clock by hand. */
  attachManualClock(now: () => number): void {
    this.ctx = null;
    this.clock = now;
    this.latency = () => 0;
  }

  /** Push one decoded chunk that is scheduled to start playing at `startAt` (AudioContext seconds). */
  pushChunk(startAt: number, samples: Float32Array, sampleRate: number): void {
    const frames = analyseChunk(samples, sampleRate);
    for (let i = 0; i < frames.length; i++) {
      const slot = this.head;
      this.times[slot] = startAt + i * ENV_HOP_SECONDS;
      this.levels[slot] = frames[i].level;
      this.brights[slot] = frames[i].bright;
      this.head = (this.head + 1) % RING;
      if (this.count < RING) this.count++;
    }
    this.lastEnd = Math.max(this.lastEnd, startAt + frames.length * ENV_HOP_SECONDS);
  }

  /** Append the sentence about to be spoken; the vowel groups queue up behind any text still unspoken. */
  pushText(text: string): void {
    this.syllables.push(...textToSyllables(text));
    if (this.syllables.length > 400) {
      const drop = this.syllables.length - 400;
      this.syllables.splice(0, drop);
      this.syllableCursor = Math.max(0, this.syllableCursor - drop);
    }
  }

  /** A new reply begins: drop vowels left over from a reply whose audio never played (e.g. it was suppressed). */
  clearText(): void {
    this.syllables = [];
    this.syllableCursor = 0;
  }

  /** The next syllable the mouth should use; null when there is no text (audio-only mapping). */
  nextSyllable(): Syllable | null {
    return this.syllables[this.syllableCursor++] ?? null;
  }
  peekSyllable(): Syllable | null {
    return this.syllables[this.syllableCursor] ?? null;
  }

  /** Interrupted or finished: forget everything that was still queued. */
  reset(): void {
    this.head = 0;
    this.count = 0;
    this.lastEnd = 0;
    this.syllables = [];
    this.syllableCursor = 0;
    this.generation++;
  }

  /** True while real audio is (or is about to be) audible. */
  get active(): boolean {
    if (!this.clock || this.count === 0) return false;
    return this.clock() - this.latency() < this.lastEnd + 0.05;
  }

  /** Envelope at the instant being heard right now, interpolated. */
  now(): EnvelopeFrame & { live: boolean } {
    if (!this.clock || this.count === 0) return { level: 0, bright: 0, live: false };
    const t = this.clock() - this.latency();
    return { ...this.at(t), live: t < this.lastEnd + 0.05 };
  }

  /** Envelope at an absolute time. Frames before the oldest or after the newest read as silence. */
  at(t: number): EnvelopeFrame {
    if (this.count === 0) return { level: 0, bright: 0 };
    // frames are appended in time order; walk back from the newest (the playhead is always near the tail)
    let idx = (this.head - 1 + RING) % RING;
    if (t > this.times[idx] + ENV_HOP_SECONDS) return { level: 0, bright: 0 };
    let steps = 0;
    while (steps < this.count && this.times[idx] > t) {
      idx = (idx - 1 + RING) % RING;
      steps++;
    }
    if (steps >= this.count) return { level: 0, bright: 0 };
    const nxt = (idx + 1) % RING;
    const t0 = this.times[idx];
    const hasNext = steps > 0 && this.times[nxt] > t0;
    const f = hasNext ? clamp01((t - t0) / (this.times[nxt] - t0)) : 0;
    if (t - t0 > ENV_HOP_SECONDS * 1.5 && !hasNext) return { level: 0, bright: 0 };
    return {
      level: this.levels[idx] + (hasNext ? (this.levels[nxt] - this.levels[idx]) * f : 0),
      bright: this.brights[idx] + (hasNext ? (this.brights[nxt] - this.brights[idx]) * f : 0),
    };
  }
}

/** The one bus the voice hook writes and the orb reads. */
export const lipSyncBus = new LipSyncBus();
