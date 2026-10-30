import { describe, it, expect } from 'vitest';
import { StreamingResampler } from '@/lib/voice/playback/sampleRateConverter';

describe('StreamingResampler & Phase Continuity', () => {
  it('passes through Float32 when rates match', () => {
    const resampler = new StreamingResampler(24000, 24000);
    const input = new Float32Array([0.1, 0.2, 0.3]);
    const output = resampler.process(input);
    expect(output).toBe(input);
  });

  it('correctly upsamples 24kHz to 48kHz (exact 2:1 factor)', () => {
    const resampler = new StreamingResampler(24000, 48000);
    // 100 samples at 24k -> should produce ~200 samples at 48k
    const input = new Float32Array(100).fill(0.5);
    const output = resampler.process(input);
    expect(output.length).toBe(200);
    for (let i = 0; i < output.length; i++) {
      expect(output[i]).toBeCloseTo(0.5, 4);
    }
  });

  it('maintains continuous phase and sample value across chunk boundaries without clicks', () => {
    const resampler = new StreamingResampler(24000, 48000);
    
    // Chunk 1: linear ramp 0.0 -> 0.4 (5 samples)
    const chunk1 = new Float32Array([0.0, 0.1, 0.2, 0.3, 0.4]);
    // Chunk 2: continuous continuation 0.5 -> 0.9 (5 samples)
    const chunk2 = new Float32Array([0.5, 0.6, 0.7, 0.8, 0.9]);

    const out1 = resampler.process(chunk1);
    const out2 = resampler.process(chunk2);

    expect(out1.length).toBe(10);
    expect(out2.length).toBe(10);

    // Boundary check: last sample of out1 and first sample of out2
    const lastOfChunk1 = out1[out1.length - 1];
    const firstOfChunk2 = out2[0];
    
    // In a smooth ramp without seam resets, step size should be ~0.05
    const jumpAtSeam = Math.abs(firstOfChunk2 - lastOfChunk1);
    expect(jumpAtSeam).toBeLessThan(0.1);
  });

  it('correctly converts 24000 -> 44100 rate with fractional phase carry', () => {
    const resampler = new StreamingResampler(24000, 44100);
    // 2400 samples (100ms at 24k) -> ~4410 samples at 44.1k
    const input = new Float32Array(2400).fill(0.2);
    const output = resampler.process(input);
    expect(output.length).toBe(4410);
    expect(output[0]).toBeCloseTo(0.2, 3);
  });

  it('handles empty inputs safely', () => {
    const resampler = new StreamingResampler(24000, 48000);
    const output = resampler.process(new Float32Array(0));
    expect(output.length).toBe(0);
  });
});
