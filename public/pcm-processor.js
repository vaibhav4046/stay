/**
 * Stay AudioWorkletProcessor (public/pcm-processor.js)
 * Captures Float32 mono microphone audio at the native AudioContext sampleRate,
 * applies a 2nd-order Butterworth low-pass biquad anti-aliasing filter (fc = 7200 Hz)
 * when downsampling from >16 kHz, decimates to 16,000 Hz mono signed 16-bit PCM little-endian,
 * emits 100 ms chunks (1,600 samples = 3,200 bytes) per AssemblyAI Universal-3.6 Pro spec,
 * and posts RMS + speech-band energy to drive local VAD and the subtle presence indicator.
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.chunkSamples = 1600; // 100ms at 16kHz = 3,200 bytes
    this.buffer = new Int16Array(this.chunkSamples);
    this.writeIndex = 0;
    this.resamplePos = 0;
    this.frameCount = 0;

    // Biquad low-pass filter state (Direct Form II Transposed)
    this.FilterRate = 0;
    this.b0 = 1;
    this.b1 = 0;
    this.b2 = 0;
    this.a1 = 0;
    this.a2 = 0;
    this.z1 = 0;
    this.z2 = 0;
    this.filteredBlock = new Float32Array(256);
  }

  updateLowPassCoeffs(fs) {
    if (this.FilterRate === fs) return;
    this.FilterRate = fs;
    if (fs <= this.targetRate) {
      this.b0 = 1;
      this.b1 = 0;
      this.b2 = 0;
      this.a1 = 0;
      this.a2 = 0;
      return;
    }
    // 2nd-order Butterworth low-pass at fc = 7200 Hz (< 8000 Hz Nyquist)
    const fc = 7200;
    const omega = (2 * Math.PI * fc) / fs;
    const sn = Math.sin(omega);
    const cs = Math.cos(omega);
    const alpha = sn / Math.SQRT2;
    const a0 = 1 + alpha;
    this.b0 = (1 - cs) / 2 / a0;
    this.b1 = (1 - cs) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * cs) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channel = input[0];
    const sourceRate = sampleRate || 48000;
    this.updateLowPassCoeffs(sourceRate);
    const ratio = sourceRate / this.targetRate;

    if (this.filteredBlock.length < channel.length) {
      this.filteredBlock = new Float32Array(channel.length);
    }

    let sumSq = 0;
    let diffSq = 0;
    let prev = 0;
    const useFilter = sourceRate > this.targetRate;

    for (let i = 0; i < channel.length; i++) {
      const x = channel[i];
      let y = x;
      if (useFilter) {
        y = this.b0 * x + this.z1;
        this.z1 = this.b1 * x - this.a1 * y + this.z2;
        this.z2 = this.b2 * x - this.a2 * y;
      }
      this.filteredBlock[i] = y;
      sumSq += y * y;
      const d = y - prev;
      diffSq += d * d;
      prev = y;
    }

    const rms = Math.sqrt(sumSq / channel.length);
    const speechBandRms = Math.sqrt(diffSq / channel.length);
    const normalizedEnergy = Math.min(1, rms * 4.5);

    this.frameCount++;
    if (this.frameCount % 12 === 0) {
      this.port.postMessage({
        type: 'energy',
        rms: normalizedEnergy,
        rawRms: rms,
        speechBandRms,
      });
    }

    // Resample from filteredBlock (sourceRate) to 16,000 Hz and convert to Int16
    while (this.resamplePos < channel.length) {
      const idx = Math.floor(this.resamplePos);
      const frac = this.resamplePos - idx;
      const s0 = this.filteredBlock[idx] || 0;
      const s1 = idx + 1 < channel.length ? this.filteredBlock[idx + 1] : s0;
      const sample = s0 + frac * (s1 - s0);

      const clamped = Math.max(-1, Math.min(1, sample));
      this.buffer[this.writeIndex++] =
        clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);

      if (this.writeIndex >= this.chunkSamples) {
        const out = this.buffer.slice(0);
        this.port.postMessage(
          {
            type: 'pcm',
            buffer: out.buffer,
          },
          [out.buffer],
        );
        this.writeIndex = 0;
      }

      this.resamplePos += ratio;
    }

    this.resamplePos -= channel.length;
    if (this.resamplePos < 0) {
      this.resamplePos = 0;
    }

    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
