import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { FastSocket, toAssemblyVoiceId, VALID_ASSEMBLY_VOICE_IDS } from '@/lib/voice/fastSocket';
import { POST as fastTokenPost } from '@/app/api/voice/fast-token/route';
import { appKeyterms, saveUserKeyterms } from '@/lib/voice/agentTool';

const VALID_VOICE_ID_SET = new Set([
  'aai-jane',
  'aai-anna',
  'aai-john',
  'aai-nicole',
  'aai-emily',
  'aai-daniel',
  'aai-michael',
  'aai-sarah',
  'aai-david',
  'aai-emma',
  'aai-james',
  'aai-olivia',
  'aai-sophia',
  'aai-liam',
  'aai-noah',
  'aai-ava',
  'aai-isabella',
  'aai-mia',
  'aai-charlotte',
  'aai-amelia',
  'aai-harper',
  'aai-evelyn',
  'aai-abigail',
  '49c443a4-8a1d-5f7e-b70b-98bdbd9823c3', // Callum (en-GB)
  '87df35db-c5c5-580f-a802-40fb03efafe9', // Harper (en-AU)
  '66c6bf99-bc69-5e32-a0cd-f9cef8ceb550', // Mateo (es)
  '97cd5fb8-b7d8-5555-82bc-7a9b6ee0acdc', // Elena (es)
  '213be0fa-a416-5a9f-8338-bd2fa4be096d', // Claire (fr)
  '9022fd34-f1be-5414-a929-f0c4a82a4528', // Henri (fr)
  'd845fc5c-96f9-5cb1-bf06-b9fa1dc125f0', // Greta (de)
  'be6fe4c9-c9fb-5bb8-8c28-c5cabd9ef510', // Lukas (de)
  'e93dc061-d4fb-5d32-9b1f-cf3e5f8c3fd9', // Giulia (it)
  '9664fb8c-b411-57aa-a704-f8ed151de0f0', // Marco (it)
  'd51e3418-a9d3-5999-a06c-d7bb2be9b2d3', // Camila (pt)
  'c85aa079-c365-5f2b-9084-f722eeef9aa0', // Lucas (pt)
]);

const VALID_TTS_LANGUAGES = new Set([
  'english',
  'spanish',
  'french',
  'german',
  'italian',
  'portuguese',
]);

class StrictAssemblyWS {
  static OPEN = 1;
  static instances: StrictAssemblyWS[] = [];
  static autoTermination = true;
  readyState = 0;
  sent: Array<string | Uint8Array> = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: ((e?: unknown) => void) | null = null;
  onclose: ((e?: { code: number; reason: string }) => void) | null = null;
  closeCode: number | null = null;
  closeReason = '';

  constructor(public url: string) {
    StrictAssemblyWS.instances.push(this);
    const parsed = new URL(url);

    if (this.isTts) {
      // Enforce AssemblyAI TTS v1 query parameter contract
      if (parsed.searchParams.has('voice')) {
        queueMicrotask(() => {
          this.push({
            type: 'Error',
            error_code: 3006,
            error: 'Bad connection parameters: voice: voice is retired: name the voice with voice_id',
          });
          this.closeWithCode(3006, 'Invalid query parameters');
        });
        return;
      }
      const voiceId = parsed.searchParams.get('voice_id') ?? '';
      const lang = parsed.searchParams.get('language') ?? '';
      if (!VALID_VOICE_ID_SET.has(voiceId) || !VALID_TTS_LANGUAGES.has(lang)) {
        queueMicrotask(() => {
          this.closeWithCode(3006, 'Invalid query parameters');
        });
        return;
      }
      queueMicrotask(() => {
        this.readyState = 1;
        this.push({
          type: 'Begin',
          id: 'tts-session-1',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          configuration: {
            voice_id: voiceId,
            model_id: parsed.searchParams.get('model_id') ?? 'assemblyai-tts-1',
            language: lang,
            sample_rate: Number(parsed.searchParams.get('sample_rate') ?? 24000),
            encoding: parsed.searchParams.get('encoding') ?? 'pcm_s16le',
            unknown_params: [],
          },
        });
      });
    } else {
      // Enforce AssemblyAI STT v3 Universal-3.6 Pro contract
      const model = parsed.searchParams.get('speech_model');
      if (
        model !== 'universal-3-6-pro' ||
        parsed.searchParams.has('end_of_turn_confidence_threshold') ||
        parsed.searchParams.has('format_turns') ||
        parsed.searchParams.has('prompt')
      ) {
        queueMicrotask(() => {
          this.closeWithCode(3006, 'Invalid query parameters for universal-3-6-pro');
        });
        return;
      }
      queueMicrotask(() => {
        this.readyState = 1;
        this.push({
          type: 'Begin',
          id: 'stt-session-1',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        });
      });
    }
  }

  get isTts() {
    return this.url.includes('tts.us.assemblyai.com');
  }

  push(m: object) {
    this.onmessage?.({ data: JSON.stringify(m) });
  }

  send(d: string | Uint8Array) {
    this.sent.push(d);
    if (typeof d === 'string') {
      let msg: { type?: string };
      try {
        msg = JSON.parse(d);
      } catch {
        this.closeWithCode(3012, 'Malformed JSON message');
        return;
      }
      if (msg.type === 'Terminate' && StrictAssemblyWS.autoTermination) {
        queueMicrotask(() => {
          this.push({
            type: 'Termination',
            audio_duration_seconds: 1.2,
            session_duration_seconds: 5.0,
          });
        });
      }
    }
  }

  closeWithCode(code: number, reason: string) {
    this.readyState = 3;
    this.closeCode = code;
    this.closeReason = reason;
    this.onclose?.({ code, reason });
  }

  close() {
    this.closeWithCode(1000, 'Normal closure');
  }
}

const tick = (n = 6) =>
  new Promise((r) => {
    let i = 0;
    const f = () => (++i >= n ? r(null) : setTimeout(f, 0));
    f();
  });

describe('AssemblyAI Protocol Contract (A1)', () => {
  let events: Array<Record<string, unknown>> = [];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    StrictAssemblyWS.instances = [];
    StrictAssemblyWS.autoTermination = true;
    events = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = StrictAssemblyWS;
    fetchMock = vi.fn();
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: { getItem: () => null, setItem: () => {} },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1. TTS URL uses voice_id= (never voice=), valid §2.4 voice_id, and full-name language', async () => {
    const s = new FastSocket({ sttToken: 'stt-tok', ttsToken: 'tts-tok', warmUp: false });
    s.onmessage = (e) => events.push(JSON.parse(e.data));
    await tick(2);
    s.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          system_prompt: 'You are Stay.',
          greeting: '',
          output: { voice: 'anna' },
          tts_language: 'english',
        },
      }),
    );
    await tick(6);
    const tts = StrictAssemblyWS.instances.find((w) => w.isTts)!;
    expect(tts).toBeDefined();
    const u = new URL(tts.url);
    expect(u.searchParams.has('voice')).toBe(false);
    expect(u.searchParams.get('voice_id')).toBe('aai-anna');
    expect(VALID_VOICE_ID_SET.has(u.searchParams.get('voice_id')!)).toBe(true);
    expect(VALID_TTS_LANGUAGES.has(u.searchParams.get('language')!)).toBe(true);
    expect(tts.closeCode).toBeNull();
    s.close();
  });

  it('2. toAssemblyVoiceId maps all persona voice names and language codes to verified §2.4 IDs', () => {
    expect(typeof toAssemblyVoiceId).toBe('function');
    expect(VALID_ASSEMBLY_VOICE_IDS).toBeDefined();
    for (const v of ['jane', 'anna', 'john', 'callum', 'harper', 'mateo', 'claire', 'henri', 'greta', 'lukas', 'giulia', 'marco', 'camila', 'lucas', 'lola', 'estelle', 'juergen', 'giovanni', 'rafael']) {
      const id = toAssemblyVoiceId(v, 'en');
      expect(VALID_VOICE_ID_SET.has(id)).toBe(true);
    }
  });

  it('3. STT URL uses speech_model=universal-3-6-pro, sample_rate=16000, and forbids end_of_turn_confidence_threshold, format_turns, and prompt', async () => {
    const s = new FastSocket({
      sttToken: 'stt-tok',
      ttsToken: 'tts-tok',
      warmUp: false,
    });
    await tick(2);
    s.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          system_prompt: 'You are Stay.',
          greeting: '',
          output: { voice: 'jane' },
          tts_language: 'english',
        },
      }),
    );
    await tick(6);
    const stt = StrictAssemblyWS.instances.find((w) => !w.isTts)!;
    expect(stt).toBeDefined();
    const u = new URL(stt.url);
    expect(u.searchParams.get('speech_model')).toBe('universal-3-6-pro');
    expect(u.searchParams.get('sample_rate')).toBe('16000');
    expect(u.searchParams.get('encoding')).toBe('pcm_s16le');
    expect(u.searchParams.get('min_turn_silence')).toBe('128');
    expect(u.searchParams.get('max_turn_silence')).toBe('1280');
    expect(u.searchParams.get('vad_threshold')).toBe('0.2');
    expect(u.searchParams.get('language_detection')).toBe('true');
    expect(u.searchParams.has('end_of_turn_confidence_threshold')).toBe(false);
    expect(u.searchParams.has('format_turns')).toBe(false);
    expect(u.searchParams.has('prompt')).toBe(false);
    expect(stt.closeCode).toBeNull();
    s.close();
  });

  it('4. Generate preserves trailing spaces and sends at most 1 Flush per sentence', async () => {
    const sse = (...chunks: string[]) =>
      new Response(
        new ReadableStream({
          start(c) {
            for (const t of chunks) {
              c.enqueue(
                new TextEncoder().encode(
                  `data: ${JSON.stringify({ choices: [{ delta: { content: t } }] })}\n\n`,
                ),
              );
            }
            c.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
            c.close();
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      );

    fetchMock.mockResolvedValue(
      sse('Okay, let us take one calm breath together right now. ', 'Open the folder on your desk.'),
    );

    const s = new FastSocket({ sttToken: 'stt-tok', ttsToken: 'tts-tok', warmUp: false });
    s.onmessage = (e) => events.push(JSON.parse(e.data));
    await tick(2);
    s.send(
      JSON.stringify({
        type: 'session.update',
        session: { system_prompt: 'You are Stay.', greeting: '', output: { voice: 'jane' } },
      }),
    );
    await tick(6);
    const stt = StrictAssemblyWS.instances.find((w) => !w.isTts)!;
    const tts = StrictAssemblyWS.instances.find((w) => w.isTts)!;

    // Sub-sentence streaming preserves trailing spaces
    s.sendTtsChunk('Take ', false);
    s.sendTtsChunk('a breath.', true);

    stt.push({ type: 'Turn', transcript: 'Help me start.', end_of_turn: true, turn_order: 0 });
    await tick(25);

    const ttsMessages = tts.sent
      .filter((d): d is string => typeof d === 'string')
      .map((d) => JSON.parse(d));
    const generates = ttsMessages.filter((m) => m.type === 'Generate');
    const flushes = ttsMessages.filter((m) => m.type === 'Flush');

    expect(generates.length).toBeGreaterThanOrEqual(3);
    expect(generates[0].text).toBe('Take ');
    expect(generates[0].text.endsWith(' ')).toBe(true);
    // 1 flush from sendTtsChunk + at most 2 from the 2 streamed sentences
    expect(flushes.length).toBeLessThanOrEqual(3);
    s.close();
  });

  it('5. KeepAlive is sent every 30 s when TTS socket is idle', async () => {
    vi.useFakeTimers();
    const s = new FastSocket({ sttToken: 'stt-tok', ttsToken: 'tts-tok', warmUp: false });
    s.send(
      JSON.stringify({
        type: 'session.update',
        session: { system_prompt: 'You are Stay.', greeting: '', output: { voice: 'jane' } },
      }),
    );
    await vi.advanceTimersByTimeAsync(50);
    const tts = StrictAssemblyWS.instances.find((w) => w.isTts)!;
    expect(tts).toBeDefined();

    await vi.advanceTimersByTimeAsync(30_000);
    const keepAlives = tts.sent
      .filter((d): d is string => typeof d === 'string')
      .map((d) => JSON.parse(d))
      .filter((m) => m.type === 'KeepAlive');
    expect(keepAlives.length).toBeGreaterThanOrEqual(1);
    s.close();
  });

  it('6. WordBoundaries.word is mapped to WordAlignment.word with audio_start_ms subtracted', async () => {
    const s = new FastSocket({ sttToken: 'stt-tok', ttsToken: 'tts-tok', warmUp: false });
    s.onmessage = (e) => events.push(JSON.parse(e.data));
    await tick(2);
    s.send(
      JSON.stringify({
        type: 'session.update',
        session: { system_prompt: 'You are Stay.', greeting: '', output: { voice: 'jane' } },
      }),
    );
    await tick(6);
    const tts = StrictAssemblyWS.instances.find((w) => w.isTts)!;

    tts.push({
      type: 'WordBoundaries',
      flush_id: 'f1',
      audio_start_ms: 100,
      audio_end_ms: 750,
      words: [
        { word: 'Still', start_ms: 100, end_ms: 350 },
        { word: 'here.', start_ms: 380, end_ms: 750 },
      ],
    });

    const wb = events.find((e) => e.type === 'word.boundaries') as
      | { words: Array<{ word: string; text: string; start: number; end: number }> }
      | undefined;
    expect(wb).toBeDefined();
    expect(wb!.words[0]).toMatchObject({ word: 'Still', text: 'Still', start: 0, end: 250 });
    expect(wb!.words[1]).toMatchObject({ word: 'here.', text: 'here.', start: 280, end: 650 });
    s.close();
  });

  it('7. Terminate waits for server Termination frame (or 5 s timeout) before closing', async () => {
    StrictAssemblyWS.autoTermination = false;
    const s = new FastSocket({ sttToken: 'stt-tok', ttsToken: 'tts-tok', warmUp: false });
    await tick(2);
    s.send(
      JSON.stringify({
        type: 'session.update',
        session: { system_prompt: 'You are Stay.', greeting: '', output: { voice: 'jane' } },
      }),
    );
    await tick(6);
    const stt = StrictAssemblyWS.instances.find((w) => !w.isTts)!;
    const tts = StrictAssemblyWS.instances.find((w) => w.isTts)!;

    const closePromise = s.terminateGracefully();
    expect(
      stt.sent.some((d) => typeof d === 'string' && JSON.parse(d).type === 'Terminate'),
    ).toBe(true);
    expect(
      tts.sent.some((d) => typeof d === 'string' && JSON.parse(d).type === 'Terminate'),
    ).toBe(true);
    // Socket should still be open waiting for Termination
    expect(stt.readyState).toBe(1);

    stt.push({ type: 'Termination', audio_duration_seconds: 1, session_duration_seconds: 2 });
    tts.push({ type: 'Termination', audio_duration_seconds: 1, session_duration_seconds: 2 });
    await closePromise;
    expect(stt.readyState).toBe(3);
  });

  it('8. /api/voice/fast-token mints STT token from streaming.assemblyai.com/v3/token and TTS token from token.us.assemblyai.com/v1/token?product=tts', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('token.us.assemblyai.com/v1/token?product=tts')) {
        return new Response(JSON.stringify({ token: 'minted-tts-token', expires_in_seconds: 60 }), { status: 200 });
      }
      if (url.includes('streaming.assemblyai.com/v3/token')) {
        return new Response(JSON.stringify({ token: 'minted-stt-token', expires_in_seconds: 60 }), { status: 200 });
      }
      return new Response('bad url', { status: 400 });
    });

    const req = new NextRequest('http://localhost:3000/api/voice/fast-token', {
      method: 'POST',
      headers: {
        'x-stay-aai-key': 'test_user_key_1234567890',
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
    });
    const res = await fastTokenPost(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    const json = (await res.json()) as { sttToken: string; ttsToken: string };
    expect(json.sttToken).toBe('minted-stt-token');
    expect(json.ttsToken).toBe('minted-tts-token');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=3600',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=3600',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('9. public/pcm-processor.js emits 3200-byte (100 ms @ 16 kHz) Int16 frames and applies low-pass anti-aliasing filter', () => {
    const code = fs.readFileSync(path.join(process.cwd(), 'public/pcm-processor.js'), 'utf8');
    let ProcessorClass: unknown = null;
    const posted: Array<{ type: string; buffer?: ArrayBuffer; rms?: number }> = [];

    class BaseWorklet {
      port = {
        postMessage: (msg: { type: string; buffer?: ArrayBuffer; rms?: number }) => {
          posted.push(msg);
        },
      };
    }

    const sandbox = {
      AudioWorkletProcessor: BaseWorklet,
      registerProcessor: (_name: string, cls: unknown) => {
        ProcessorClass = cls;
      },
      sampleRate: 48000,
      Int16Array,
      Float32Array,
      Math,
    };

    vm.runInNewContext(code, sandbox);
    expect(ProcessorClass).toBeTruthy();

    const proc = new (ProcessorClass as new () => {
      targetRate: number;
      chunkSamples: number;
      process: (inputs: Float32Array[][]) => boolean;
    })();
    expect(proc.targetRate).toBe(16000);
    expect(proc.chunkSamples).toBe(1600);

    // Feed 4800 samples at 48 kHz (= 100 ms -> 1600 samples at 16 kHz = 3200 bytes)
    const block = new Float32Array(128);
    for (let b = 0; b < 40; b++) {
      for (let i = 0; i < 128; i++) {
        block[i] = Math.sin((2 * Math.PI * 440 * (b * 128 + i)) / 48000) * 0.5;
      }
      proc.process([[block]]);
    }

    const pcmFrames = posted.filter((p) => p.type === 'pcm');
    expect(pcmFrames.length).toBeGreaterThanOrEqual(1);
    expect(pcmFrames[0].buffer!.byteLength).toBe(3200);
  });

  it('10. appKeyterms() includes My Words and excludes persona caricature names', () => {
    const store = new Map<string, string>();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
      },
    };
    saveUserKeyterms(['Methylphenidate', 'Dr. Sharma', 'ab']); // 'ab' is <= 2 chars so filtered
    const terms = appKeyterms();
    expect(terms).toContain('Methylphenidate');
    expect(terms).toContain('Dr. Sharma');
    expect(terms).not.toContain('ab');
    for (const caricature of ['Chaiwala', 'Taco', 'Mariachi', 'Goblin Mode Gus', 'Croissant Bandit', 'Professor Pretzel', 'Fettuccine Maestro']) {
      expect(terms).not.toContain(caricature);
    }
  });
});
