/**
 * Pcm16Decoder: decodes signed 16-bit little-endian PCM from base64 or raw Uint8Array.
 * Maintains odd-byte carry across chunk boundaries so samples split across network frames are not corrupted.
 */
export class Pcm16Decoder {
  private carryByte: number | null = null;

  /**
   * Reset any carried odd byte (e.g. on new reply epoch or cancel).
   */
  reset(): void {
    this.carryByte = null;
  }

  /**
   * Decode base64 or Uint8Array chunk to Int16Array with odd-byte preservation.
   */
  decode(input: string | Uint8Array | ArrayBuffer): Int16Array {
    let bytes: Uint8Array;
    if (typeof input === 'string') {
      const buf = typeof Buffer !== 'undefined'
        ? Buffer.from(input, 'base64')
        : Uint8Array.from(atob(input), (c) => c.charCodeAt(0));
      bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } else if (input instanceof Uint8Array) {
      bytes = input;
    } else {
      bytes = new Uint8Array(input);
    }

    if (bytes.length === 0 && this.carryByte === null) {
      return new Int16Array(0);
    }

    let src = bytes;
    if (this.carryByte !== null) {
      const merged = new Uint8Array(bytes.length + 1);
      merged[0] = this.carryByte;
      merged.set(bytes, 1);
      src = merged;
      this.carryByte = null;
    }

    // If odd length, save the last byte for the next chunk
    const evenLength = src.length & ~1;
    if (src.length > evenLength) {
      this.carryByte = src[src.length - 1];
    }

    const sampleCount = evenLength / 2;
    const out = new Int16Array(sampleCount);
    const view = new DataView(src.buffer, src.byteOffset, evenLength);

    for (let i = 0; i < sampleCount; i++) {
      out[i] = view.getInt16(i * 2, true); // little-endian
    }

    return out;
  }

  /**
   * Converts Int16Array (-32768..32767) to Float32Array (-1.0..1.0).
   */
  static toFloat32(pcm16: Int16Array): Float32Array {
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      const sample = pcm16[i];
      float32[i] = sample < 0 ? sample / 0x8000 : sample / 0x7fff;
    }
    return float32;
  }

  /**
   * Computes Root-Mean-Square energy of Float32Array in range [0, 1].
   */
  static rms(samples: Float32Array): number {
    if (samples.length === 0) return 0;
    let sumSq = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      sumSq += s * s;
    }
    return Math.min(1, Math.sqrt(sumSq / samples.length));
  }
}
