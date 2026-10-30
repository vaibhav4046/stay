/**
 * StreamingResampler: continuous sample rate converter retaining fractional phase
 * and boundary samples between chunks to prevent seam clicks.
 */
export class StreamingResampler {
  readonly sourceRate: number;
  readonly targetRate: number;
  private readonly ratio: number; // source / target
  private lastSample = 0;
  private hasLastSample = false;
  private phase = 0; // fractional position in source samples [0, 1)

  constructor(sourceRate: number, targetRate: number) {
    this.sourceRate = sourceRate;
    this.targetRate = targetRate;
    this.ratio = sourceRate / targetRate;
  }

  reset(): void {
    this.lastSample = 0;
    this.hasLastSample = false;
    this.phase = 0;
  }

  /**
   * Resamples incoming Float32Array from sourceRate to targetRate.
   */
  process(input: Float32Array): Float32Array {
    if (this.sourceRate === this.targetRate) {
      return input;
    }
    if (input.length === 0) {
      return new Float32Array(0);
    }

    // Output length calculation based on available samples plus carry phase
    const totalSourceSamples = input.length - this.phase;
    if (totalSourceSamples <= 0) {
      this.phase -= input.length;
      return new Float32Array(0);
    }

    const estimatedOutputLength = Math.floor(totalSourceSamples / this.ratio) + 2;
    const output = new Float32Array(estimatedOutputLength);
    let outIdx = 0;

    let currentPhase = this.phase;

    while (currentPhase < input.length) {
      const idx = Math.floor(currentPhase);
      const frac = currentPhase - idx;

      // Sample interpolation with continuity from last chunk
      const s0 = idx === 0 ? (this.hasLastSample ? this.lastSample : input[0]) : input[idx - 1];
      const s1 = input[idx];

      // Linear interpolation between consecutive points
      const interpolated = s0 + frac * (s1 - s0);
      output[outIdx++] = interpolated;

      currentPhase += this.ratio;
    }

    this.lastSample = input[input.length - 1];
    this.hasLastSample = true;
    this.phase = currentPhase - input.length;

    return output.subarray(0, outIdx);
  }
}
