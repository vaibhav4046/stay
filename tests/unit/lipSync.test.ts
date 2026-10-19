import { describe, expect, it } from 'vitest';
import { FaceAnimator } from '@/lib/orb/faceAnimator';
import { ENV_HOP_SECONDS, LipSyncBus, VISEME_SHAPES, analyseChunk, mouthTarget, springFollow, textToSyllables } from '@/lib/orb/lipSync';

const tone = (freq: number, seconds: number, amp: number, rate = 24000) =>
  Float32Array.from({ length: Math.round(seconds * rate) }, (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / rate));
const noise = (seconds: number, amp: number, rate = 24000) => {
  let s = 12345;
  return Float32Array.from({ length: Math.round(seconds * rate) }, () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return amp * ((s / 4294967296) * 2 - 1);
  });
};
const seededRng = (seed: number) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

describe('level + viseme to mouth mapping', () => {
  it('silence returns the mouth to rest', () => {
    expect(mouthTarget(0, 0.5, 'AA')).toEqual({ open: 0, wide: 0 });
    expect(mouthTarget(0.02, 0.9, null)).toEqual({ open: 0, wide: 0 });
  });

  it('louder speech opens wider, monotonically', () => {
    let prev = -1;
    for (const level of [0.05, 0.1, 0.2, 0.35, 0.5, 0.8]) {
      const m = mouthTarget(level, 0.2, 'AA');
      expect(m.open).toBeGreaterThanOrEqual(prev);
      prev = m.open;
    }
    expect(mouthTarget(0.8, 0.2, 'AA').open).toBeGreaterThan(0.8);
    expect(mouthTarget(0.06, 0.2, 'AA').open).toBeLessThan(0.3);
  });

  it('open vowels open wider than closed/narrow ones at the same loudness', () => {
    const at = (v: keyof typeof VISEME_SHAPES) => mouthTarget(0.6, 0.2, v);
    expect(at('AA').open).toBeGreaterThan(at('EE').open);
    expect(at('OH').open).toBeGreaterThan(at('OO').open);
    expect(at('EE').wide).toBeGreaterThan(0.6); // spread
    expect(at('OO').wide).toBeLessThan(-0.6); // rounded
  });

  it('with no text, bright sound (s, ee) is narrow and spread, dark sound (ah, oh) is open', () => {
    const dark = mouthTarget(0.6, 0.05, null);
    const bright = mouthTarget(0.6, 0.9, null);
    expect(dark.open).toBeGreaterThan(bright.open);
    expect(bright.wide).toBeGreaterThan(dark.wide);
  });

  it('stays inside the unit ranges for any input', () => {
    for (const level of [-1, 0, 0.5, 1, 5]) {
      for (const bright of [-1, 0, 0.5, 1, 3]) {
        for (const v of [null, ...(Object.keys(VISEME_SHAPES) as Array<keyof typeof VISEME_SHAPES>)]) {
          const m = mouthTarget(level, bright, v);
          expect(m.open).toBeGreaterThanOrEqual(0);
          expect(m.open).toBeLessThanOrEqual(1);
          expect(m.wide).toBeGreaterThanOrEqual(-1);
          expect(m.wide).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('springFollow converges without overshooting wildly and is stable on a long frame', () => {
    let x = 0;
    let v = 0;
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      [x, v] = springFollow(x, v, 1, 1 / 60);
      peak = Math.max(peak, x);
    }
    expect(x).toBeCloseTo(1, 2);
    expect(peak).toBeLessThan(1.05);
    const [y] = springFollow(0, 0, 1, 10);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe('text to syllables (the viseme heuristic)', () => {
  it('finds one syllable per vowel group and the right shape class', () => {
    expect(textToSyllables('hello').map((s) => s.vowel)).toEqual(['EH', 'OH']);
    expect(textToSyllables('moon').map((s) => s.vowel)).toEqual(['OO']);
    expect(textToSyllables('see me').map((s) => s.vowel)).toEqual(['EE', 'EE']);
    expect(textToSyllables('go').map((s) => s.vowel)).toEqual(['OH']);
  });

  it('flags a bilabial after the vowel (the lips will close)', () => {
    const s = textToSyllables('number');
    expect(s[0].bilabialAfter).toBe(true); // "num|ber": m after u
    expect(textToSyllables('stay')[0].bilabialAfter).toBe(false);
    expect(textToSyllables('cap')[0].bilabialAfter).toBe(true);
  });

  it('a silent final e adds no syllable', () => {
    expect(textToSyllables('make')).toHaveLength(1);
    expect(textToSyllables('home')).toHaveLength(1);
  });

  it('punctuation, digits and other scripts do not crash (they just give no vowels)', () => {
    expect(textToSyllables('')).toEqual([]);
    expect(textToSyllables('123 !?')).toEqual([]);
    expect(textToSyllables('नमस्ते 你好')).toEqual([]);
  });
});

describe('envelope extraction from the real PCM', () => {
  it('a loud tone reads loud, silence reads zero', () => {
    const loud = analyseChunk(tone(200, 0.2, 0.3), 24000);
    const quiet = analyseChunk(new Float32Array(4800), 24000);
    expect(loud).toHaveLength(Math.round(0.2 / ENV_HOP_SECONDS));
    expect(Math.min(...loud.map((f) => f.level))).toBeGreaterThan(0.6);
    expect(Math.max(...quiet.map((f) => f.level))).toBe(0);
  });

  it('brightness separates a low vowel-like tone from hissy noise', () => {
    const low = analyseChunk(tone(180, 0.2, 0.25), 24000);
    const hiss = analyseChunk(noise(0.2, 0.25), 24000);
    const avg = (f: Array<{ bright: number }>) => f.reduce((s, x) => s + x.bright, 0) / f.length;
    expect(avg(low)).toBeLessThan(0.2);
    expect(avg(hiss)).toBeGreaterThan(0.5);
  });
});

describe('the bus reads the envelope at the playback clock, not at arrival', () => {
  it('returns the level of the audio being heard now, silence before and after, and resets on interrupt', () => {
    const bus = new LipSyncBus();
    let now = 10;
    bus.attachManualClock(() => now);
    // 0.2 s of speech scheduled to start at t=10.5, nothing before it
    bus.pushChunk(10.5, tone(200, 0.2, 0.3), 24000);
    now = 10.2;
    expect(bus.now().level).toBe(0);
    expect(bus.active).toBe(true); // audio is queued and about to play
    now = 10.6;
    expect(bus.now().level).toBeGreaterThan(0.6);
    now = 11.5;
    expect(bus.now().level).toBe(0);
    expect(bus.active).toBe(false);
    const gen = bus.generation;
    bus.reset();
    expect(bus.generation).toBe(gen + 1);
    now = 10.6;
    expect(bus.now().level).toBe(0);
  });

  it('keeps vowel text queued in order and drops it on reset', () => {
    const bus = new LipSyncBus();
    bus.pushText('hello there');
    expect(bus.nextSyllable()?.vowel).toBe('EH');
    expect(bus.nextSyllable()?.vowel).toBe('OH');
    bus.reset();
    expect(bus.nextSyllable()).toBeNull();
  });
});

describe('FaceAnimator end to end on synthetic speech', () => {
  const run = (opts: { reduced?: boolean; text?: string } = {}) => {
    const bus = new LipSyncBus();
    let now = 0;
    bus.attachManualClock(() => now);
    if (opts.text) bus.pushText(opts.text);
    // four "syllables" of 0.16 s separated by 0.08 s gaps, then silence
    for (let s = 0.2; s < 1.1; s += 0.24) {
      bus.pushChunk(s, tone(190, 0.16, 0.28), 24000);
      bus.pushChunk(s + 0.16, new Float32Array(1920), 24000);
    }
    const face = new FaceAnimator(bus, seededRng(7));
    const frames: Array<{ t: number; open: number; wide: number; blink: number; tilt: number }> = [];
    for (let i = 0; i < 60 * 4; i++) {
      now = i / 60;
      const f = face.update({ dt: 1 / 60, time: now, speaking: now > 0.15 && now < 1.2, listening: false, fallbackLevel: 0, reduced: !!opts.reduced });
      frames.push({ t: now, open: f.open, wide: f.wide, blink: f.blink, tilt: f.tilt });
    }
    return { frames, face };
  };

  it('opens while the audio plays and is closed again in silence', () => {
    const { frames, face } = run({ text: 'hello there my friend' });
    const during = frames.filter((f) => f.t > 0.3 && f.t < 1.0);
    const after = frames.filter((f) => f.t > 2.0);
    expect(Math.max(...during.map((f) => f.open))).toBeGreaterThan(0.35);
    expect(Math.max(...after.map((f) => f.open))).toBeLessThan(0.02);
    expect(face.onsets).toBeGreaterThanOrEqual(3);
  });

  it('closes between syllables (consonant gaps) instead of hanging open', () => {
    const { frames } = run({ text: 'hello there my friend' });
    const opens = frames.filter((f) => f.t > 0.25 && f.t < 1.0).map((f) => f.open);
    expect(Math.min(...opens)).toBeLessThan(Math.max(...opens) * 0.6);
  });

  it('works with no text at all (audio-only mapping)', () => {
    const { frames } = run();
    expect(Math.max(...frames.filter((f) => f.t < 1.2).map((f) => f.open))).toBeGreaterThan(0.3);
  });

  it('blinks gently and sometimes, with the lids fully up the rest of the time', () => {
    const face = new FaceAnimator(new LipSyncBus(), seededRng(3));
    let blinks = 0;
    let wasBlinking = false;
    let max = 0;
    for (let i = 0; i < 60 * 30; i++) {
      const f = face.update({ dt: 1 / 60, time: i / 60, speaking: false, listening: false, fallbackLevel: 0, reduced: false });
      max = Math.max(max, f.blink);
      if (f.blink > 0.5 && !wasBlinking) blinks++;
      wasBlinking = f.blink > 0.5;
    }
    expect(blinks).toBeGreaterThanOrEqual(4);
    expect(blinks).toBeLessThanOrEqual(16);
    expect(max).toBeGreaterThan(0.95);
  });

  it('reduced motion: the mouth still tracks speech (quieter), but no blink, tilt, nod, sway, breath or brow', () => {
    const { frames } = run({ reduced: true, text: 'hello there my friend' });
    expect(Math.max(...frames.map((f) => f.open))).toBeGreaterThan(0.2);
    expect(Math.max(...frames.map((f) => f.open))).toBeLessThan(0.7);
    expect(frames.every((f) => f.blink === 0 && f.tilt === 0)).toBe(true);
  });

  it('with no audio timeline it falls back to the energy level while speaking', () => {
    const face = new FaceAnimator(new LipSyncBus());
    let open = 0;
    for (let i = 0; i < 60; i++) open = face.update({ dt: 1 / 60, time: i / 60, speaking: true, listening: false, fallbackLevel: 0.6, reduced: false }).open;
    expect(open).toBeGreaterThan(0.2);
    for (let i = 60; i < 180; i++) open = face.update({ dt: 1 / 60, time: i / 60, speaking: false, listening: false, fallbackLevel: 0, reduced: false }).open;
    expect(open).toBe(0);
  });
});
