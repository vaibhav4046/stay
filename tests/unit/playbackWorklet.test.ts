import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { splitHeardAndUnheard } from '@/lib/voice/turnMachine';

function loadWorkletClass(sampleRate = 24000) {
  const workletPath = path.resolve(process.cwd(), 'public/worklets/stay-pcm-playback-processor.js');
  const code = fs.readFileSync(workletPath, 'utf8');
  let RegisteredClass: any = null;
  const messages: any[] = [];
  const sandbox: any = {
    sampleRate,
    Float32Array,
    Math,
    AudioWorkletProcessor: class {
      port = {
        onmessage: null as any,
        postMessage: (msg: any) => {
          messages.push(msg);
        },
      };
    },
    registerProcessor: (_name: string, cls: any) => {
      RegisteredClass = cls;
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  if (!RegisteredClass) {
    throw new Error('Failed to load StayPcmPlaybackProcessor');
  }
  return { ProcessorClass: RegisteredClass, messages };
}

describe('Gate 2 — StayPcmPlaybackProcessor worklet & heard/unheard split', () => {
  const sampleRate = 24000;
  const quantumSamples = 128;
  const chunkSamples100ms = 2400; // 100 ms @ 24 kHz

  it('reorders out-of-order packets within a 3-chunk window and drops duplicates', () => {
    const { ProcessorClass } = loadWorkletClass(sampleRate);
    const proc = new ProcessorClass();

    const makeChunk = (val: number) => {
      const f = new Float32Array(chunkSamples100ms);
      f.fill(val);
      return f;
    };

    // Enqueue seq 0, then seq 2 (out of order), then duplicate seq 0, then seq 1
    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 0, samples: makeChunk(0.1) } });
    expect(proc.expectedSeq).toBe(1);
    expect(proc.bufferedCount).toBe(chunkSamples100ms);

    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 2, samples: makeChunk(0.3) } });
    // seq 2 is held in reorderBuffer waiting for seq 1
    expect(proc.expectedSeq).toBe(1);
    expect(proc.bufferedCount).toBe(chunkSamples100ms);

    // Duplicate seq 0 is dropped and counted
    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 0, samples: makeChunk(0.1) } });
    expect(proc.dupDropped).toBe(1);

    // Now seq 1 arrives -> both seq 1 and held seq 2 flush into ring buffer in order
    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 1, samples: makeChunk(0.2) } });
    expect(proc.expectedSeq).toBe(3);
    expect(proc.bufferedCount).toBe(chunkSamples100ms * 3);
  });

  it('rejects stale epochs and counts staleDropped', () => {
    const { ProcessorClass } = loadWorkletClass(sampleRate);
    const proc = new ProcessorClass();
    const samples = new Float32Array(chunkSamples100ms).fill(0.2);

    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 2, replyEpoch: 3, seq: 0, samples } });
    expect(proc.bufferedCount).toBe(chunkSamples100ms);

    // Older replyEpoch
    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 2, replyEpoch: 2, seq: 1, samples } });
    expect(proc.staleDropped).toBe(1);

    // Older sessionEpoch
    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 3, seq: 1, samples } });
    expect(proc.staleDropped).toBe(2);
    expect(proc.bufferedCount).toBe(chunkSamples100ms);
  });

  it('cancels cleanly across all 5 buffer states with zero stale samples after cancel complete', () => {
    const { ProcessorClass } = loadWorkletClass(sampleRate);

    // 1. Empty (STOPPED)
    {
      const proc = new ProcessorClass();
      expect(proc.state).toBe('STOPPED');
      proc.handleMessage({ data: { type: 'cancel', sessionEpoch: 1, replyEpoch: 2 } });
      const out = [[new Float32Array(quantumSamples)]];
      proc.process([], out, {});
      expect(out[0][0].every((v: number) => v === 0)).toBe(true);
    }

    // 2. Prebuffering (BUFFERING)
    {
      const proc = new ProcessorClass();
      proc.handleMessage({
        data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 0, samples: new Float32Array(800).fill(0.5) },
      });
      expect(proc.state).toBe('BUFFERING');
      proc.handleMessage({ data: { type: 'cancel', sessionEpoch: 1, replyEpoch: 2 } });
      const out = [[new Float32Array(quantumSamples)]];
      proc.process([], out, {});
      expect(out[0][0].every((v: number) => v === 0)).toBe(true);
    }

    // 3. Playing (PLAYING) -> ramps to 0 over <= 10 ms (240 samples = 2 quanta), then 0 stale samples
    {
      const proc = new ProcessorClass();
      proc.handleMessage({
        data: {
          type: 'enqueue',
          sessionEpoch: 1,
          replyEpoch: 1,
          seq: 0,
          samples: new Float32Array(chunkSamples100ms * 3).fill(0.4),
        },
      });
      const warm = [[new Float32Array(quantumSamples)]];
      proc.process([], warm, {});
      expect(proc.state).toBe('PLAYING');

      proc.handleMessage({ data: { type: 'cancel', sessionEpoch: 1, replyEpoch: 2 } });
      // Drain the 10ms (240-sample) click-free ramp (2 quanta = 256 samples)
      for (let q = 0; q < 2; q++) {
        proc.process([], [[new Float32Array(quantumSamples)]], {});
      }
      expect(proc.state).toBe('STOPPED');
      expect(proc.bufferedCount).toBe(0);

      // Late packet from old replyEpoch 1 must be rejected
      proc.handleMessage({
        data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 1, samples: new Float32Array(chunkSamples100ms).fill(0.8) },
      });
      let staleNonZero = 0;
      for (let q = 0; q < 10; q++) {
        const post = [[new Float32Array(quantumSamples)]];
        proc.process([], post, {});
        for (const s of post[0][0]) {
          if (Math.abs(s) > 1e-6) staleNonZero++;
        }
      }
      expect(staleNonZero).toBe(0);
    }

    // 4. Underflow recovery (BUFFERING after underflow)
    {
      const proc = new ProcessorClass();
      proc.handleMessage({
        data: {
          type: 'enqueue',
          sessionEpoch: 1,
          replyEpoch: 1,
          seq: 0,
          samples: new Float32Array(chunkSamples100ms * 3).fill(0.3), // 300 ms: past the 200 ms prebuffer
        },
      });
      // Drain until underflow
      for (let q = 0; q < 80; q++) {
        proc.process([], [[new Float32Array(quantumSamples)]], {});
      }
      expect(proc.underflowCount).toBeGreaterThanOrEqual(1);
      expect(proc.state).toBe('BUFFERING');
      proc.handleMessage({ data: { type: 'cancel', sessionEpoch: 1, replyEpoch: 2 } });
      const post = [[new Float32Array(quantumSamples)]];
      proc.process([], post, {});
      expect(post[0][0].every((v: number) => v === 0)).toBe(true);
    }

    // 5. Backpressure (> 20 s buffered)
    {
      const { ProcessorClass: BPClass, messages } = loadWorkletClass(sampleRate);
      const proc = new BPClass();
      // Enqueue 21 seconds of audio (21 * 24000 = 504,000 samples)
      const bigChunk = new Float32Array(sampleRate * 21).fill(0.2);
      proc.handleMessage({
        data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 0, samples: bigChunk },
      });
      expect(messages.some((m) => m.type === 'backpressure' && m.paused === true)).toBe(true);
      proc.handleMessage({ data: { type: 'cancel', sessionEpoch: 1, replyEpoch: 2 } });
      for (let q = 0; q < 2; q++) {
        proc.process([], [[new Float32Array(quantumSamples)]], {});
      }
      expect(proc.bufferedCount).toBe(0);
      expect(proc.state).toBe('STOPPED');
    }
  });

  it('runs the full jitter matrix (0/20/40/60/80/100/120/200/400 ms) and adapts prebuffer with 10 ms/s clean decay', () => {
    const { ProcessorClass } = loadWorkletClass(sampleRate);
    const jitterMatrix = [0, 20, 40, 60, 80, 100, 120, 200, 400];
    const quantumMs = (quantumSamples / sampleRate) * 1000;

    for (const jitter of jitterMatrix) {
      const proc = new ProcessorClass();
      const chunkCount = 12;
      const arrivalsMs = Array.from({ length: chunkCount }, (_, i) => i * 100 + (i > 0 && i % 2 === 1 ? jitter : 0));
      let nextIdx = 0;
      let simMs = 0;
      let renderedSamples = 0;

      while (simMs <= arrivalsMs[arrivalsMs.length - 1] + 1000) {
        while (nextIdx < arrivalsMs.length && arrivalsMs[nextIdx] <= simMs) {
          proc.handleMessage({
            data: {
              type: 'enqueue',
              sessionEpoch: 1,
              replyEpoch: 1,
              seq: nextIdx,
              samples: new Float32Array(chunkSamples100ms).fill(0.25),
            },
          });
          nextIdx++;
          if (nextIdx === arrivalsMs.length) {
            proc.handleMessage({ data: { type: 'markEnd', sessionEpoch: 1, replyEpoch: 1 } });
          }
        }
        const out = [[new Float32Array(quantumSamples)]];
        proc.process([], out, {});
        for (const s of out[0][0]) {
          if (Math.abs(s) > 1e-6) renderedSamples++;
        }
        simMs += quantumMs;
      }

      // Every sent sample (12 * 2400 = 28,800) must be rendered without dropping unplayed audio
      expect(proc.renderedSamples).toBe(chunkCount * chunkSamples100ms);
      expect(renderedSamples).toBeGreaterThanOrEqual(chunkCount * chunkSamples100ms - proc.fadeCount * 2);
      if (jitter <= 60) {
        expect(proc.underflowCount).toBe(0);
      }
    }
  });

  it('computes heardText vs unheardText accurately from rendered samples + WordBoundaries', () => {
    const words = [
      { word: 'Here', start: 0, end: 180 },
      { word: 'is', start: 180, end: 310 },
      { word: 'one', start: 310, end: 520 },
      { word: 'tiny', start: 520, end: 820 },
      { word: 'step.', start: 820, end: 1200 },
    ];
    // At 24,000 Hz, 13,200 rendered samples = 550 ms -> "Here is one" heard, "tiny step." unheard
    const split = splitHeardAndUnheard('Here is one tiny step.', words, 13200, 24000);
    expect(split.heardText).toBe('Here is one');
    expect(split.unheardText).toBe('tiny step.');
  });
});
