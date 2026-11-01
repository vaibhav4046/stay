import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALL_STYLE_INSTRUCTION, RING_MS, startTone } from '@/lib/voice/ringtone';

const gainCalls: number[] = [];
let closed = 0;
let oscStarted = 0;

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  resume = () => Promise.resolve();
  close = () => ((closed += 1), Promise.resolve());
  createGain = () => ({ gain: { value: 0, setTargetAtTime: (v: number) => void gainCalls.push(v) }, connect: () => {} });
  createOscillator = () => ({ frequency: { value: 0 }, connect: () => {}, start: () => void (oscStarted += 1) });
}

beforeEach(() => {
  gainCalls.length = 0;
  closed = 0;
  oscStarted = 0;
  vi.useFakeTimers();
  vi.stubGlobal('AudioContext', FakeAudioContext);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('startTone', () => {
  it('ringback: two tones, on for 2 s, off for 4 s, repeating', () => {
    const stop = startTone('ringback');
    expect(oscStarted).toBe(2);
    expect(gainCalls).toEqual([0.07]); // on immediately
    vi.advanceTimersByTime(2000);
    expect(gainCalls).toEqual([0.07, 0]); // off after 2 s
    vi.advanceTimersByTime(4000);
    expect(gainCalls).toEqual([0.07, 0, 0.07]); // rings again after 4 s
    stop();
  });

  it('stop silences and closes the audio context exactly once', () => {
    const stop = startTone('incoming');
    stop();
    stop();
    vi.advanceTimersByTime(1000);
    expect(gainCalls[gainCalls.length - 1]).toBe(0);
    expect(closed).toBe(1);
    const before = gainCalls.length;
    vi.advanceTimersByTime(10_000);
    expect(gainCalls.length).toBe(before); // no ticks after stop
  });

  it('is a safe no-op when Web Audio is unavailable', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => startTone('ringback')()).not.toThrow();
  });
});

describe('call constants', () => {
  it('rings long enough to hear but not longer than one ring', () => {
    expect(RING_MS).toBeGreaterThanOrEqual(1500);
    expect(RING_MS).toBeLessThanOrEqual(2000);
  });
  it('tells Stay to sound like a person on a phone, without dropping its short-reply shape', () => {
    expect(CALL_STYLE_INSTRUCTION).toMatch(/phone call/);
    expect(CALL_STYLE_INSTRUCTION).toMatch(/no emoji/);
    expect(CALL_STYLE_INSTRUCTION).toMatch(/one tiny next step/);
  });
});
