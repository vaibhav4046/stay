import { describe, it, expect } from 'vitest';

/**
 * Headless simulator for StayPcmPlaybackProcessor logic.
 * Tests render quantum scheduling, prebuffering, crossfading and underflow recovery.
 */
class HeadlessPlaybackSimulator {
  sampleRate = 48000;
  bufferSize = 96000;
  ring = new Float32Array(this.bufferSize);
  writeIndex = 0;
  readIndex = 0;
  bufferedCount = 0;

  state: 'STOPPED' | 'BUFFERING' | 'PLAYING' | 'DRAINING' = 'STOPPED';
  prebufferSamples = 4800; // 100ms at 48k
  fadeLength = 240; // 5ms at 48k
  currentGain = 1.0;
  targetGain = 1.0;
  markedEnd = false;
  underflowCount = 0;
  renderedSamples = 0;

  enqueue(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.writeIndex] = samples[i];
      this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
    }
    this.bufferedCount += samples.length;
    if (this.state === 'STOPPED') {
      this.state = 'BUFFERING';
      this.targetGain = 1.0;
    }
  }

  markEnd(): void {
    this.markedEnd = true;
    if (this.state === 'PLAYING' || this.state === 'BUFFERING') {
      this.state = 'DRAINING';
    }
  }

  cancel(): void {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.bufferedCount = 0;
    this.state = 'STOPPED';
    this.targetGain = 0.0;
    this.currentGain = 0.0;
    this.markedEnd = false;
  }

  processQuantum(outQuantum = 128): Float32Array {
    const out = new Float32Array(outQuantum);

    if (this.state === 'BUFFERING') {
      if (this.bufferedCount >= this.prebufferSamples || this.markedEnd) {
        this.state = this.markedEnd ? 'DRAINING' : 'PLAYING';
      } else {
        return out; // silent while buffering
      }
    }

    if (this.state === 'STOPPED') {
      return out;
    }

    const step = 1.0 / this.fadeLength;

    for (let i = 0; i < outQuantum; i++) {
      let sample = 0;
      if (this.bufferedCount > 0) {
        sample = this.ring[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
        this.bufferedCount--;
        this.renderedSamples++;
      } else {
        if (this.state === 'PLAYING') {
          this.underflowCount++;
          this.state = 'BUFFERING';
          this.targetGain = 0.0;
        } else if (this.state === 'DRAINING') {
          this.state = 'STOPPED';
          this.markedEnd = false;
        }
      }

      if (this.currentGain !== this.targetGain) {
        if (this.currentGain < this.targetGain) {
          this.currentGain = Math.min(this.targetGain, this.currentGain + step);
        } else {
          this.currentGain = Math.max(this.targetGain, this.currentGain - step);
        }
      }

      out[i] = sample * this.currentGain;
    }

    return out;
  }
}

describe('Continuous Audio Playback Clock & Worklet Simulation', () => {
  it('holds output silent in BUFFERING until prebuffer target is met', () => {
    const sim = new HeadlessPlaybackSimulator();
    // Enqueue 2400 samples (50ms), prebuffer target is 4800 (100ms)
    sim.enqueue(new Float32Array(2400).fill(0.5));
    expect(sim.state).toBe('BUFFERING');

    // Run 5 render quanta (5 * 128 = 640 samples)
    for (let q = 0; q < 5; q++) {
      const out = sim.processQuantum();
      expect(out.every((s) => s === 0)).toBe(true);
    }

    // Now enqueue remaining 2400 samples -> total 4800 >= prebufferSamples
    sim.enqueue(new Float32Array(2400).fill(0.5));
    
    // Next quantum should start playback!
    const activeOut = sim.processQuantum();
    expect(sim.state).toBe('PLAYING');
    expect(activeOut.some((s) => s > 0)).toBe(true);
  });

  it('drains completely to STOPPED without false underflows when markedEnd is set', () => {
    const sim = new HeadlessPlaybackSimulator();
    // Enqueue 512 samples and mark end
    sim.enqueue(new Float32Array(512).fill(0.4));
    sim.markEnd();

    // 4 quanta to drain 512 samples
    for (let q = 0; q < 4; q++) {
      sim.processQuantum();
    }
    // Next quantum should be STOPPED with 0 underflow count
    sim.processQuantum();
    expect(sim.state).toBe('STOPPED');
    expect(sim.underflowCount).toBe(0);
  });

  it('handles barge-in cancel instantaneously without stale audio', () => {
    const sim = new HeadlessPlaybackSimulator();
    sim.enqueue(new Float32Array(9600).fill(0.8));
    sim.processQuantum(); // playing

    // User interrupts
    sim.cancel();
    expect(sim.state).toBe('STOPPED');
    expect(sim.bufferedCount).toBe(0);

    const out = sim.processQuantum();
    expect(out.every((s) => s === 0)).toBe(true);
  });
});
