import { describe, it, expect } from 'vitest';
import { generateSyntheticSpeech, simulateLegacyScheduler } from './fixtures/syntheticAudio';

describe('Legacy AudioBufferSourceNode Dropout Reproduction', () => {
  it('identifies dead audio gaps under 40ms jitter with 100ms chunks', () => {
    const speech = generateSyntheticSpeech(1000, 24000, 100); // 10 chunks of 100ms
    expect(speech.base64Chunks.length).toBe(10);

    // Chunks normally arrive every 100ms.
    // In chunk 2, network introduces 50ms delay: arrival at 250ms instead of 200ms.
    const chunkDurations = Array(10).fill(100);
    const arrivals = [0, 100, 250, 350, 450, 550, 650, 750, 850, 950];

    const result = simulateLegacyScheduler(chunkDurations, arrivals, 15);
    
    // Chunk 0: starts at 15ms, ends at 115ms
    // Chunk 1: starts at 115ms (100+15=115 <= 115), ends at 215ms
    // Chunk 2: arrives at 250ms. earliestAllowed = 250 + 15 = 265ms.
    // nextPlaybackTime was 215ms. 265 > 215 -> GAP of 50ms!
    expect(result.totalGaps).toBeGreaterThan(0);
    expect(result.discontinuities).toBeGreaterThan(0);
    expect(result.totalGapMs).toBe(50);
  });

  it('proves that lack of prebuffering in legacy scheduler fails under realistic jitter matrix', () => {
    const chunkDurations = Array(10).fill(100);
    // Jitter perturbation profile: [0, 20, 40, 60, 80, 100, 120, 200]
    const jitters = [0, 20, 40, 60, 80, 100, 120, 200];
    
    for (const jitter of jitters.slice(1)) {
      // Chunk 1 delayed by jitter
      const arrivals = [0, 100 + jitter, 200 + jitter, 300 + jitter, 400 + jitter];
      const result = simulateLegacyScheduler(chunkDurations.slice(0, 5), arrivals, 15);
      
      // If jitter > 15ms, chunk 0 ends at 115ms, but chunk 1 earliest is 100 + jitter + 15 > 115ms -> GAP!
      expect(result.totalGaps).toBeGreaterThan(0);
      expect(result.totalGapMs).toBe(jitter);
    }
  });

  it('demonstrates chunk burst delivery causes no buffer absorbing in legacy system', () => {
    // 3 chunks arrive together at 150ms after a stall
    const chunkDurations = [100, 100, 100];
    const arrivals = [0, 150, 150]; // stall on chunk 1, burst on chunk 2

    const result = simulateLegacyScheduler(chunkDurations, arrivals, 15);
    expect(result.chunks[1].gapBeforeMs).toBe(50); // 50ms dead air
  });
});
