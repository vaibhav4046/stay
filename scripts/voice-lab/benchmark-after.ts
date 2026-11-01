import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execSync } from 'node:child_process';
import { generateSyntheticSpeech } from '../../tests/voice-audio/fixtures/syntheticAudio';

interface WorkletRunResult {
  jitterConditionMs: number;
  chunkDurationMs: number;
  totalChunks: number;
  renderedNonZeroSamples: number;
  underflows: number;
  overflows: number;
  fadeTransitions: number;
  measuredGapMs: number;
  staleSamplesAfterCancel: number;
  enqueueToFirstRenderMs: number;
}

function loadWorkletClass(sampleRate: number) {
  const workletPath = path.resolve(__dirname, '../../public/worklets/stay-pcm-playback-processor.js');
  const code = fs.readFileSync(workletPath, 'utf8');
  let RegisteredClass: any = null;
  const sandbox: any = {
    sampleRate,
    Float32Array,
    Math,
    AudioWorkletProcessor: class {
      port = {
        onmessage: null as any,
        postMessage: () => {},
      };
    },
    registerProcessor: (_name: string, cls: any) => {
      RegisteredClass = cls;
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  if (!RegisteredClass) {
    throw new Error('Failed to load StayPcmPlaybackProcessor from worklet file');
  }
  return RegisteredClass;
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function runWorkletDiagnostics() {
  const root = path.resolve(__dirname, '../..');
  const sampleRate = 24000;
  const quantumSamples = 128;
  const quantumMs = (quantumSamples / sampleRate) * 1000;
  const ProcessorClass = loadWorkletClass(sampleRate);

  const speech = generateSyntheticSpeech(2000, sampleRate, 100);
  const jitterMatrix = [0, 20, 40, 60, 80, 100, 120, 200, 400];
  const chunkCount = speech.base64Chunks.length;
  const chunkDurationMs = speech.chunkDurationMs;
  const samplesPerChunk = Math.floor((chunkDurationMs / 1000) * sampleRate);

  const results: WorkletRunResult[] = [];

  for (const jitter of jitterMatrix) {
    const proc = new ProcessorClass();
    const arrivalsMs: number[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const nominal = i * chunkDurationMs;
      const delay = i > 0 && i % 2 === 1 ? jitter : 0;
      arrivalsMs.push(nominal + delay);
    }

    let nextChunkIdx = 0;
    let simTimeMs = 0;
    let firstRenderMs: number | null = null;
    let renderedNonZeroSamples = 0;
    let fadeTransitions = 0;
    let silenceGapSamplesMidStream = 0;
    let hasStartedPlaying = false;
    let prevState = proc.state;

    const maxSimMs = arrivalsMs[arrivalsMs.length - 1] + 1500;
    while (simTimeMs <= maxSimMs) {
      while (nextChunkIdx < arrivalsMs.length && arrivalsMs[nextChunkIdx] <= simTimeMs) {
        const samples = new Float32Array(samplesPerChunk);
        samples.fill(0.25);
        proc.handleMessage({
          data: {
            type: 'enqueue',
            sessionEpoch: 1,
            replyEpoch: 1,
            seq: nextChunkIdx,
            samples,
          },
        });
        nextChunkIdx++;
        if (nextChunkIdx === arrivalsMs.length) {
          proc.handleMessage({
            data: { type: 'markEnd', sessionEpoch: 1, replyEpoch: 1 },
          });
        }
      }

      const out = [[new Float32Array(quantumSamples)]];
      proc.process([], out, {});
      if (proc.state === 'PLAYING') hasStartedPlaying = true;
      if (proc.state !== prevState && (proc.state === 'BUFFERING' || prevState === 'BUFFERING')) {
        fadeTransitions++;
      }
      prevState = proc.state;

      const ch = out[0][0];
      for (let s = 0; s < ch.length; s++) {
        if (Math.abs(ch[s]) > 1e-6) {
          renderedNonZeroSamples++;
          if (firstRenderMs === null) {
            firstRenderMs = Number(simTimeMs.toFixed(2));
          }
        } else if (hasStartedPlaying && proc.state !== 'STOPPED') {
          silenceGapSamplesMidStream++;
        }
      }

      simTimeMs += quantumMs;
    }

    // Measure cancel in PLAYING state and count any stale samples after cancel ramp completes
    const cancelProc = new ProcessorClass();
    const activeChunk = new Float32Array(samplesPerChunk * 4);
    activeChunk.fill(0.4);
    cancelProc.handleMessage({
      data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 0, samples: activeChunk },
    });
    const warmOut = [[new Float32Array(quantumSamples)]];
    cancelProc.process([], warmOut, {});
    cancelProc.handleMessage({
      data: { type: 'cancel', sessionEpoch: 1, replyEpoch: 2 },
    });
    // Drain the 10ms (240-sample = 2 quanta) click-free ramp
    for (let r = 0; r < 2; r++) {
      cancelProc.process([], [[new Float32Array(quantumSamples)]], {});
    }
    // Attempt to enqueue a late chunk from old epoch 1
    cancelProc.handleMessage({
      data: { type: 'enqueue', sessionEpoch: 1, replyEpoch: 1, seq: 1, samples: activeChunk },
    });
    let staleSamplesAfterCancel = 0;
    for (let q = 0; q < 10; q++) {
      const postCancelOut = [[new Float32Array(quantumSamples)]];
      cancelProc.process([], postCancelOut, {});
      for (const v of postCancelOut[0][0]) {
        if (Math.abs(v) > 1e-6) staleSamplesAfterCancel++;
      }
    }

    const measuredGapMs = Number(((silenceGapSamplesMidStream / sampleRate) * 1000).toFixed(2));

    results.push({
      jitterConditionMs: jitter,
      chunkDurationMs,
      totalChunks: chunkCount,
      renderedNonZeroSamples,
      underflows: proc.underflowCount,
      overflows: proc.overflowCount,
      fadeTransitions,
      measuredGapMs,
      staleSamplesAfterCancel,
      enqueueToFirstRenderMs: firstRenderMs ?? 0,
    });
  }

  const evidenceDir = path.join(root, 'docs/evidence/unit');
  const voiceDir = path.join(root, 'docs/voice');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.mkdirSync(voiceDir, { recursive: true });

  const gitSha = getGitSha();
  const timestamp = new Date().toISOString();
  const payload = {
    gitSha,
    dirty: true,
    tier: 'unit',
    scenarioId: 'dsp-worklet-jitter-matrix',
    timestamp,
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
    sampleRate,
    quantumSamples,
    runs: results,
  };

  const outJsonPath = path.join(evidenceDir, 'dsp-worklet-bench.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(payload, null, 2));

  const rowsMd = results
    .map(
      (r) =>
        `| ${r.jitterConditionMs} ms | ${r.renderedNonZeroSamples} | ${r.underflows} | ${r.fadeTransitions} | ${r.measuredGapMs} ms | ${r.enqueueToFirstRenderMs} ms | ${r.staleSamplesAfterCancel} |`,
    )
    .join('\n');

  const proofMd = `# VOICE PROOF: AUDIOWORKLET RING BUFFER BENCHMARK (TIER 1 SYNTHETIC DSP)

**Generated:** ${timestamp}  
**Commit (\`gitSha\`):** \`${gitSha}\`  
**Evidence JSON:** [\`docs/evidence/unit/dsp-worklet-bench.json\`](../evidence/unit/dsp-worklet-bench.json)  
**Worklet Under Test:** \`public/worklets/stay-pcm-playback-processor.js\` (executed directly in Node \`vm\` at 24,000 Hz, 128-sample render quanta)

## Scope & Honest Limits
- This report measures the **AudioWorklet ring buffer and epoch cancellation logic** under synthetic packet arrival schedules.
- It is a **Tier 1 unit/DSP measurement**, not a real-microphone or network RTT measurement. \`enqueueToFirstRenderMs\` measures the prebuffer hold before the first non-zero sample is emitted by \`process()\`.

## Jitter Matrix Results (20 chunks × 100 ms @ 24 kHz = 48,000 samples)

| Alternating Packet Jitter | Rendered Non-Zero Samples | Measured Underflows | Fade Transitions | Measured Gap | \`enqueueToFirstRenderMs\` | Stale Samples After \`cancel\` |
|---|---|---|---|---|---|---|
${rowsMd}
`;

  fs.writeFileSync(path.join(voiceDir, 'VOICE_PROOF.md'), proofMd);
  console.log(`Wrote real worklet DSP evidence to ${outJsonPath} and docs/voice/VOICE_PROOF.md`);
}

runWorkletDiagnostics();
