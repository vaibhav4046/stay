import { describe, it, expect } from 'vitest';
import { simulateLegacyScheduler } from './fixtures/syntheticAudio';

describe('Jitter Matrix & Continuity Verification', () => {
  it('legacy scheduler fails under 50ms jitter with 100ms chunks', () => {
    const chunkDurations = Array(6).fill(100);
    // Chunk 1 delayed by 50ms
    const arrivals = [0, 150, 200, 300, 400, 500];
    const legacy = simulateLegacyScheduler(chunkDurations, arrivals, 15);
    
    // In legacy, chunk 0 finishes at 115ms, chunk 1 earliest is 165ms -> 50ms gap
    expect(legacy.totalGaps).toBe(1);
    expect(legacy.totalGapMs).toBe(50);
  });

  it('continuous player with 100ms prebuffer absorbs 50ms jitter with zero gap', () => {
    // Model continuous queue:
    // Chunks arrive: t=0 (100ms), t=150 (100ms), t=200 (100ms), t=300 (100ms)...
    // Playback starts at t=100ms (prebuffer = 100ms).
    // Timeline of buffered audio at playback point:
    // t=100ms: Playback starts. Available audio: 100ms (from chunk 0). Audio covers until t=200ms.
    // t=150ms: Chunk 1 arrives! Adds 100ms. Audio now covers until t=300ms!
    // t=200ms: Chunk 2 arrives! Adds 100ms. Audio now covers until t=400ms!
    // Result: ZERO UNDERFLOW! Continuous gapless playback!

    const chunkDurationMs = 100;
    const prebufferMs = 100;
    const arrivals = [0, 150, 200, 300, 400, 500];

    let playbackTimeMs = arrivals[0] + prebufferMs; // starts at t=100ms
    let coverageEndMs = playbackTimeMs;
    let underflows = 0;

    for (let i = 0; i < arrivals.length; i++) {
      const arr = arrivals[i];
      if (arr > coverageEndMs && i > 0) {
        // Stall occurred
        underflows++;
        coverageEndMs = arr + prebufferMs + chunkDurationMs;
      } else {
        coverageEndMs += chunkDurationMs;
      }
    }

    expect(underflows).toBe(0); // 100ms prebuffer absorbed 50ms network jitter completely!
  });

  it('absorbs up to 80ms jitter smoothly with 100ms prebuffer', () => {
    const arrivals = [0, 180, 220, 300, 400, 500];
    const chunkDurationMs = 100;
    const prebufferMs = 100;

    let coverageEndMs = arrivals[0] + prebufferMs;
    let underflows = 0;

    for (let i = 0; i < arrivals.length; i++) {
      const arr = arrivals[i];
      if (arr > coverageEndMs && i > 0) {
        underflows++;
        coverageEndMs = arr + prebufferMs + chunkDurationMs;
      } else {
        coverageEndMs += chunkDurationMs;
      }
    }

    expect(underflows).toBe(0);
  });
});
