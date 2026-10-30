import { describe, it, expect, vi } from 'vitest';
import { Pcm16Decoder } from '@/lib/voice/playback/pcm16';
import { FastSocket } from '@/lib/voice/fastSocket';
import { AzureTts } from '@/lib/voice/tts/azure';

describe('Provider Adapters Protocol Conformance', () => {
  it('Managed Voice Agent reply.audio format is decoded cleanly by Pcm16Decoder', () => {
    const decoder = new Pcm16Decoder();
    // Simulate 24kHz PCM16 sample stream
    const raw = new Int16Array([500, 1000, 1500, 2000]);
    const b64 = Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('base64');
    
    // Voice agent event payload: { type: 'reply.audio', data: b64 }
    const decoded = decoder.decode(b64);
    expect(decoded.length).toBe(4);
    expect(decoded[0]).toBe(500);
    expect(decoded[3]).toBe(2000);
  });

  it('FastSocket uses modern tts.us.assemblyai.com endpoint with negotiated sample_rate and pcm_s16le encoding', async () => {
    let capturedUrl = '';
    class MockWS {
      readyState = 1;
      onmessage: ((e: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public url: string) {
        capturedUrl = url;
        queueMicrotask(() => {
          this.onmessage?.({ data: JSON.stringify({ type: 'Begin', configuration: { sample_rate: 24000 } }) });
        });
      }
      send() {}
      close() { this.readyState = 3; }
    }

    const origWS = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWS;

    try {
      const s = new FastSocket({ sttToken: 'stt-tok', ttsToken: 'tts-tok', warmUp: false });
      s.send(JSON.stringify({ type: 'session.update', session: { voice: 'anna', ttsLanguage: 'english' } }));
      
      // Let microtasks run
      await new Promise((r) => setTimeout(r, 10));
      expect(capturedUrl).toContain('tts.us.assemblyai.com');
      expect(capturedUrl).toContain('encoding=pcm_s16le');
      expect(capturedUrl).toContain('sample_rate=24000');
    } finally {
      (globalThis as unknown as { WebSocket: unknown }).WebSocket = origWS;
    }
  });

  it('AzureTts streams 24kHz s16le PCM via fetch relay', async () => {
    const mockPcm = new Int16Array(240).fill(100);
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(mockPcm.buffer, mockPcm.byteOffset, mockPcm.byteLength));
        controller.close();
      },
    });

    const mockFetch = vi.fn(async () => new Response(mockStream, { status: 200 }));
    const azure = new AzureTts({
      voice: 'en-IN-NeerjaNeural',
      locale: 'en-IN',
      fetchImpl: mockFetch as unknown as typeof fetch,
      headers: () => ({ 'x-test': '1' }),
    });

    const messages: Array<{ type: string; audio?: string }> = [];
    azure.onmessage = (e) => messages.push(JSON.parse(e.data));

    // Wait for Begin
    await new Promise((r) => setTimeout(r, 10));
    azure.send(JSON.stringify({ type: 'Generate', text: 'Hello' }));
    azure.send(JSON.stringify({ type: 'Flush' }));

    // Wait for audio
    await new Promise((r) => setTimeout(r, 20));
    expect(messages.some((m) => m.type === 'Audio')).toBe(true);
    expect(messages.some((m) => m.type === 'FlushDone')).toBe(true);
  });
});
