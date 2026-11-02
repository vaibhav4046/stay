import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

/** T2.3 "pause first, cancel second": a hold fades Stay out, keeps its place, and carries on from the same sample when released. */
function loadProcessor(sampleRate = 24000) {
  const code = fs.readFileSync(path.resolve(process.cwd(), 'public/worklets/stay-pcm-playback-processor.js'), 'utf8');
  let Cls: any = null;
  const sandbox: any = {
    sampleRate,
    currentTime: 0,
    Float32Array,
    Math,
    AudioWorkletProcessor: class { port = { onmessage: null as any, postMessage: () => {} }; },
    registerProcessor: (_n: string, c: any) => { Cls = c; },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return new Cls();
}

const Q = 128;
const render = (proc: any, quanta: number) => {
  const all: number[] = [];
  for (let q = 0; q < quanta; q++) {
    const out = [[new Float32Array(Q)]];
    proc.process([], out, {});
    all.push(...out[0][0]);
  }
  return all;
};

describe('playback hold', () => {
  it('fades out within about 30 ms, then plays silence without using up the reply', () => {
    const proc = loadProcessor();
    const ramp = new Float32Array(24000).map((_, i) => 0.5 + (i % 100) / 1000); // one second of non-silent audio
    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 0, samples: ramp } });
    proc.handleMessage({ data: { type: 'markEnd' } });
    render(proc, 60); // past the prebuffer: playing now
    expect(proc.state === 'PLAYING' || proc.state === 'DRAINING').toBe(true);

    proc.handleMessage({ data: { type: 'hold', held: true } });
    const fade = render(proc, 8); // 1,024 samples, about 43 ms
    expect(Math.abs(fade[0])).toBeGreaterThan(0.1); // it does not cut off with a click
    expect(fade.slice(-128).every((v) => v === 0)).toBe(true); // silent within the fade

    const left = proc.bufferedCount;
    const quiet = render(proc, 40); // held for about 210 ms
    expect(quiet.every((v) => v === 0)).toBe(true);
    expect(proc.bufferedCount).toBe(left); // nothing was thrown away while held
  });

  it('released, it carries on from the same place and fades back in', () => {
    const proc = loadProcessor();
    const audio = new Float32Array(24000).fill(0.4);
    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 0, samples: audio } });
    proc.handleMessage({ data: { type: 'markEnd' } });
    render(proc, 60);
    proc.handleMessage({ data: { type: 'hold', held: true } });
    render(proc, 10);
    const left = proc.bufferedCount;
    proc.handleMessage({ data: { type: 'hold', held: false } });
    const back = render(proc, 8);
    expect(back[0]).toBeLessThan(0.05); // fades in, no jump
    expect(back.at(-1)).toBeCloseTo(0.4, 2); // full level again
    expect(proc.bufferedCount).toBe(left - 8 * Q); // reading resumed from where it stopped
  });

  it('a cancel while held drops the reply and clears the hold', () => {
    const proc = loadProcessor();
    proc.handleMessage({ data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 0, samples: new Float32Array(24000).fill(0.4) } });
    render(proc, 60);
    proc.handleMessage({ data: { type: 'hold', held: true } });
    proc.handleMessage({ data: { type: 'cancel', sessionEpoch: 1, replyEpoch: 2 } });
    expect(proc.held).toBe(false);
    expect(proc.bufferedCount).toBe(0);
  });
});
