import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATTACK_MS, BREATH_PERIOD_S, NOISE_FLOOR, breath, lookFor, smoothDrive, targetDrive, type SignalState } from '@/lib/signal/signalModel';
import { signalBus } from '@/lib/signal/signalBus';

const STATES: SignalState[] = ['idle', 'connecting', 'listening', 'transcribing', 'thinking', 'speaking', 'interrupted', 'reconnecting', 'paused', 'backchannel', 'text_only_fallback', 'error', 'complete'];

describe('what drives the wave', () => {
  it('the microphone drives it only while listening or transcribing', () => {
    const levels = { input: 0.6, output: 0 };
    expect(targetDrive('listening', levels)).toBeGreaterThan(0.3);
    expect(targetDrive('transcribing', levels)).toBeGreaterThan(0.3);
    for (const s of STATES.filter((x) => !['listening', 'transcribing'].includes(x))) expect(targetDrive(s, levels), s).toBe(0);
  });

  it('rendered assistant audio drives it only while speaking, and never the microphone', () => {
    expect(targetDrive('speaking', { input: 0.9, output: 0 })).toBe(0); // a loud mic must not make Stay look like it is speaking
    expect(targetDrive('speaking', { input: 0, output: 0.5 })).toBeGreaterThan(0.3);
    expect(targetDrive('listening', { input: 0, output: 0.9 })).toBe(0); // and playback must not look like listening
  });

  it('is flat in silence and below the noise floor', () => {
    expect(targetDrive('listening', { input: 0, output: 0 })).toBe(0);
    expect(targetDrive('listening', { input: NOISE_FLOOR, output: 0 })).toBe(0);
    expect(targetDrive('listening', { input: 0.005, output: 0 })).toBe(0);
  });

  it('is bounded to 0..1 for any input, including loud and invalid', () => {
    expect(targetDrive('listening', { input: 5, output: 0 })).toBeLessThanOrEqual(1);
    expect(targetDrive('listening', { input: -1, output: 0 })).toBe(0);
  });

  it('every state has a defined look; only resting states breathe; only waiting states travel', () => {
    for (const s of STATES) {
      const l = lookFor(s);
      expect(['accent', 'warm', 'danger', 'muted']).toContain(l.tint);
      if (l.breathe) expect(['idle', 'complete']).toContain(s);
      if (l.travel) expect(['thinking', 'connecting', 'reconnecting']).toContain(s);
    }
    expect(lookFor('error').tint).toBe('danger');
    expect(lookFor('paused').meaning).toBe('stopped'); // never animated as if audio were being captured
  });
});

describe('smoothing', () => {
  it('attacks quickly: most of a step in about one attack time constant', () => {
    const v = smoothDrive(0, 1, ATTACK_MS, 'listening');
    expect(v).toBeGreaterThan(0.55);
    expect(v).toBeLessThan(0.75);
  });

  it('releases softer than it attacks for the microphone, and faster for assistant output', () => {
    const mic = smoothDrive(1, 0, 100, 'listening');
    const out = smoothDrive(1, 0, 100, 'speaking');
    expect(mic).toBeGreaterThan(out);
    expect(mic).toBeLessThan(1);
  });

  it('drops to exactly zero at once when stopped, interrupted, failed, or waiting: no ghost animation', () => {
    for (const s of ['interrupted', 'paused', 'error', 'thinking', 'connecting', 'reconnecting', 'text_only_fallback'] as SignalState[]) {
      expect(smoothDrive(0.9, 0.9, 16, s), s).toBe(0);
    }
  });

  it('settles to zero rather than hovering just above it', () => {
    let v = 0.5;
    for (let i = 0; i < 200; i++) v = smoothDrive(v, 0, 16, 'listening');
    expect(v).toBe(0);
  });

  it('ignores a negative frame time', () => {
    expect(smoothDrive(0.4, 0.4, -50, 'listening')).toBeCloseTo(0.4, 5);
  });
});

describe('breathing', () => {
  it('has a ~3.6 s period within 0..1', () => {
    expect(BREATH_PERIOD_S).toBeGreaterThanOrEqual(3.2);
    expect(BREATH_PERIOD_S).toBeLessThanOrEqual(4);
    expect(breath(0)).toBeCloseTo(0, 5);
    expect(breath(BREATH_PERIOD_S / 2)).toBeCloseTo(1, 5);
    expect(breath(BREATH_PERIOD_S)).toBeCloseTo(0, 5);
  });
});

describe('signalBus (microphone level)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    signalBus.reset();
  });
  afterEach(() => vi.useRealTimers());

  it('reads the latest level, clamped', () => {
    signalBus.setInput(0.4);
    expect(signalBus.input()).toBeCloseTo(0.4);
    signalBus.setInput(3);
    expect(signalBus.input()).toBe(1);
    signalBus.setInput(Number.NaN);
    expect(signalBus.input()).toBe(0);
  });

  it('reads zero when the microphone has gone quiet or stopped sending: stale means silent', () => {
    signalBus.setInput(0.8);
    vi.advanceTimersByTime(400);
    expect(signalBus.input()).toBe(0);
  });

  it('reset clears it', () => {
    signalBus.setInput(0.8);
    signalBus.reset();
    expect(signalBus.input()).toBe(0);
  });
});
