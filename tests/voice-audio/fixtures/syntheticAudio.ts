import crypto from 'node:crypto';

export interface SyntheticAudioResult {
  sampleRate: number;
  durationMs: number;
  totalSamples: number;
  pcm16: Int16Array;
  base64Chunks: string[];
  chunkDurationMs: number;
  sha256: string;
}

/**
 * Generates a deterministic multi-harmonic audio signal mimicking voiced speech (F0=180Hz with harmonics).
 * Uses windowed envelope to prevent start/end click.
 */
export function generateSyntheticSpeech(durationMs = 2000, sampleRate = 24000, chunkDurationMs = 100): SyntheticAudioResult {
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
  const pcm16 = new Int16Array(totalSamples);
  
  const f0 = 180; // fundamental frequency (Hz)
  const fadeSamples = Math.min(Math.floor(sampleRate * 0.02), Math.floor(totalSamples / 10)); // 20ms fade in/out

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    // Harmonic series: 180Hz, 360Hz, 540Hz, 720Hz
    let s = 0.5 * Math.sin(2 * Math.PI * f0 * t) +
            0.25 * Math.sin(2 * Math.PI * (2 * f0) * t) +
            0.15 * Math.sin(2 * Math.PI * (3 * f0) * t) +
            0.10 * Math.sin(2 * Math.PI * (4 * f0) * t);

    // Apply envelope
    if (i < fadeSamples) {
      s *= (i / fadeSamples);
    } else if (i > totalSamples - fadeSamples) {
      s *= ((totalSamples - i) / fadeSamples);
    }

    // Scale to int16 (-32768 to 32767)
    const val = Math.max(-32768, Math.min(32767, Math.round(s * 24000)));
    pcm16[i] = val;
  }

  // Chunk into base64
  const samplesPerChunk = Math.floor((chunkDurationMs / 1000) * sampleRate);
  const base64Chunks: string[] = [];
  
  for (let offset = 0; offset < totalSamples; offset += samplesPerChunk) {
    const sliceEnd = Math.min(totalSamples, offset + samplesPerChunk);
    const slice = pcm16.subarray(offset, sliceEnd);
    const buf = Buffer.from(slice.buffer, slice.byteOffset, slice.byteLength);
    base64Chunks.push(buf.toString('base64'));
  }

  const rawBuffer = Buffer.from(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
  const sha256 = crypto.createHash('sha256').update(rawBuffer).digest('hex');

  return {
    sampleRate,
    durationMs,
    totalSamples,
    pcm16,
    base64Chunks,
    chunkDurationMs,
    sha256,
  };
}

export interface ScheduledChunk {
  chunkIndex: number;
  arrivalMs: number;
  scheduledStartMs: number;
  durationMs: number;
  scheduledEndMs: number;
  gapBeforeMs: number;
  isUnderflow: boolean;
}

export interface SimulationResult {
  chunks: ScheduledChunk[];
  totalGaps: number;
  totalGapMs: number;
  firstAudioLatencyMs: number;
  totalDurationMs: number;
  discontinuities: number;
}

/**
 * Simulates the legacy AudioBufferSourceNode scheduling logic from useVoiceAgent.ts:
 *
 * const startAt = Math.max(ctx.currentTime + 0.015, nextPlaybackTimeRef.current);
 * source.start(startAt);
 * nextPlaybackTimeRef.current = startAt + audioBuffer.duration;
 */
export function simulateLegacyScheduler(
  chunkDurationsMs: number[],
  arrivalOffsetsMs: number[],
  leadTimeMs = 15
): SimulationResult {
  let nextPlaybackTimeMs = 0;
  const chunks: ScheduledChunk[] = [];
  let totalGaps = 0;
  let totalGapMs = 0;
  let discontinuities = 0;

  for (let i = 0; i < chunkDurationsMs.length; i++) {
    const arrivalMs = arrivalOffsetsMs[i] ?? (i * chunkDurationsMs[0]);
    const durationMs = chunkDurationsMs[i];

    // Legacy calculation:
    // startAt = Math.max(ctx.currentTime + 0.015, nextPlaybackTimeRef.current)
    const earliestAllowedMs = arrivalMs + leadTimeMs;
    const scheduledStartMs = Math.max(earliestAllowedMs, nextPlaybackTimeMs);

    let gapBeforeMs = 0;
    let isUnderflow = false;

    if (i === 0) {
      gapBeforeMs = 0;
    } else {
      if (scheduledStartMs > nextPlaybackTimeMs) {
        gapBeforeMs = scheduledStartMs - nextPlaybackTimeMs;
        isUnderflow = true;
        totalGaps++;
        totalGapMs += gapBeforeMs;
        discontinuities++;
      }
    }

    const scheduledEndMs = scheduledStartMs + durationMs;
    nextPlaybackTimeMs = scheduledEndMs;

    chunks.push({
      chunkIndex: i,
      arrivalMs,
      scheduledStartMs,
      durationMs,
      scheduledEndMs,
      gapBeforeMs,
      isUnderflow,
    });
  }

  const firstAudioLatencyMs = chunks[0]?.scheduledStartMs ?? 0;
  const totalDurationMs = chunks.length > 0 ? chunks[chunks.length - 1].scheduledEndMs : 0;

  return {
    chunks,
    totalGaps,
    totalGapMs,
    firstAudioLatencyMs,
    totalDurationMs,
    discontinuities,
  };
}
