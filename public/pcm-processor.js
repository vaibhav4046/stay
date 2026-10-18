/**
 * Stay AudioWorkletProcessor (public/pcm-processor.js)
 * Captures Float32 mono microphone audio at the native AudioContext sampleRate,
 * downsamples/resamples to 24,000 Hz mono signed 16-bit PCM little-endian,
 * emits ~50ms chunks (1,200 samples = 2,400 bytes), and posts RMS energy (0..1)
 * to drive the Stay Signal visual instrument.
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 24000;
    this.chunkSamples = 1200; // 50ms at 24kHz
    this.buffer = new Int16Array(this.chunkSamples);
    this.writeIndex = 0;
    this.resamplePos = 0;
    this.frameCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channel = input[0];
    const sourceRate = sampleRate || 48000;
    const ratio = sourceRate / this.targetRate;

    // Compute RMS energy for smooth visual feedback
    let sumSq = 0;
    for (let i = 0; i < channel.length; i++) {
      const s = channel[i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / channel.length);
    const normalizedEnergy = Math.min(1, rms * 4.5);

    this.frameCount++;
    if (this.frameCount % 12 === 0) { // ~30 Hz is plenty; the scene interpolates between updates
      this.port.postMessage({
        type: 'energy',
        rms: normalizedEnergy,
      });
    }

    // Resample from sourceRate to 24,000 Hz and convert to Int16
    while (this.resamplePos < channel.length) {
      const idx = Math.floor(this.resamplePos);
      const frac = this.resamplePos - idx;
      const s0 = channel[idx] || 0;
      const s1 = idx + 1 < channel.length ? channel[idx + 1] : s0;
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
          [out.buffer]
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
