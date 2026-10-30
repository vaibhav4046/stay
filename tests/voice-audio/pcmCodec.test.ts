import { describe, it, expect } from 'vitest';
import { Pcm16Decoder } from '@/lib/voice/playback/pcm16';

describe('Pcm16Decoder & Codec Rigor', () => {
  it('correctly decodes signed 16-bit little-endian boundaries', () => {
    const decoder = new Pcm16Decoder();
    // Test values: -32768, -1, 0, 1, 32767
    const expected = [-32768, -1, 0, 1, 32767];
    const bytes = new Uint8Array(10);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < expected.length; i++) {
      view.setInt16(i * 2, expected[i], true);
    }

    const decoded = decoder.decode(bytes);
    expect(decoded.length).toBe(5);
    for (let i = 0; i < expected.length; i++) {
      expect(decoded[i]).toBe(expected[i]);
    }
  });

  it('correctly handles odd-byte frame splits across chunks', () => {
    const decoder = new Pcm16Decoder();
    // Sample 0x1234 (4660) in little endian: byte 0 = 0x34, byte 1 = 0x12
    // Split across two chunks: chunk 1 has 3 bytes [0x00, 0x00, 0x34], chunk 2 has 3 bytes [0x12, 0x56, 0x78]
    const chunk1 = new Uint8Array([0x00, 0x00, 0x34]); // 1 full sample (0) + 1 partial byte (0x34)
    const chunk2 = new Uint8Array([0x12, 0x01, 0x00]); // finishes sample (0x1234 = 4660) + 1 full sample (1)

    const res1 = decoder.decode(chunk1);
    expect(res1.length).toBe(1);
    expect(res1[0]).toBe(0);

    const res2 = decoder.decode(chunk2);
    expect(res2.length).toBe(2);
    expect(res2[0]).toBe(0x1234);
    expect(res2[1]).toBe(1);
  });

  it('resets odd byte carry on reset()', () => {
    const decoder = new Pcm16Decoder();
    decoder.decode(new Uint8Array([0x01])); // carry 1 byte
    decoder.reset();
    const res = decoder.decode(new Uint8Array([0x00, 0x00]));
    expect(res.length).toBe(1);
    expect(res[0]).toBe(0);
  });

  it('safely handles empty frames and base64 strings', () => {
    const decoder = new Pcm16Decoder();
    expect(decoder.decode('').length).toBe(0);
    expect(decoder.decode(new Uint8Array(0)).length).toBe(0);

    // Base64 encoding of 2 zero samples (4 bytes)
    const b64 = Buffer.from(new Uint8Array(4)).toString('base64');
    const res = decoder.decode(b64);
    expect(res.length).toBe(2);
    expect(res[0]).toBe(0);
  });

  it('normalizes to Float32 [-1.0, 1.0] without clipping', () => {
    const int16 = new Int16Array([-32768, 0, 32767]);
    const float32 = Pcm16Decoder.toFloat32(int16);
    expect(float32[0]).toBe(-1.0);
    expect(float32[1]).toBe(0.0);
    expect(float32[2]).toBeCloseTo(1.0, 4);
    expect(float32[2]).toBeLessThanOrEqual(1.0);
  });

  it('calculates accurate RMS', () => {
    expect(Pcm16Decoder.rms(new Float32Array(0))).toBe(0);
    const ones = new Float32Array([1, 1, 1, 1]);
    expect(Pcm16Decoder.rms(ones)).toBe(1);
    const half = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    expect(Pcm16Decoder.rms(half)).toBeCloseTo(0.5, 5);
  });
});
