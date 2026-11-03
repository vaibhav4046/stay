import type { Page, WebSocketRoute } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { grantMicConsent } from './consent';
import { replyPcm } from './fakeVoice';

// Same ids the app can send; whether the live API accepts them is checked by scripts/verify-voices.mjs.
const FAST_SOCKET_SRC = readFileSync(join(__dirname, '../../../src/lib/voice/fastSocket.ts'), 'utf8');
const VALID_VOICE_IDS = new Set<string>([
  ...(FAST_SOCKET_SRC.match(/aai-[a-z]+/g) ?? []),
  ...(FAST_SOCKET_SRC.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g) ?? []),
]);

function toBase64Pcm(pcm: Float32Array): string {
  const buf = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm[i] * 32767))), i * 2);
  }
  return buf.toString('base64');
}

export interface FakeFastVoice {
  ready(): boolean;
  sttUrl(): string | null;
  ttsUrl(): string | null;
  managedAgentSocketOpened(): boolean;
  sttSentJson(): Array<Record<string, unknown>>;
  ttsSentJson(): Array<Record<string, unknown>>;
  sttAudioFramesReceived(): number;
  pushSttSpeechStarted(timestampMs?: number): void;
  pushSttPartial(transcript: string, turnOrder?: number, utterance?: string): void;
  pushSttFinal(
    transcript: string,
    turnOrder?: number,
    words?: Array<{ text: string; start: number; end: number; confidence: number; word_is_final?: boolean }>
  ): void;
  pushTtsError(errorCode: number, error: string): void;
  closeTtsUnexpectedly(code?: number): void;
  closeSttUnexpectedly(code?: number): void;
}

export interface InstallFakeFastVoiceOptions {
  /** Override the LLM SSE response text returned by /api/voice/chat */
  chatReplyText?: string | ((lastUserText: string) => string);
  /** Answer a turn with one app tool call (e.g. { action: 'open', value: 'report' }) instead of words; null for a normal reply. */
  chatToolCall?: (lastUserText: string, withTools: boolean) => Record<string, unknown> | null;
  /** Delay in ms before TTS Audio frames are sent after Flush */
  ttsAudioDelayMs?: number;
  /** Number of 24kHz audio chunks to stream per Flush ( enables mid-speech barge-in tests ) */
  ttsChunksPerFlush?: number;
  /** Interval between TTS audio chunks in ms */
  ttsChunkIntervalMs?: number;
}

export async function installFakeFastVoice(
  page: Page,
  options: InstallFakeFastVoiceOptions = {}
): Promise<FakeFastVoice> {
  await grantMicConsent(page); // this person has already agreed; consent.spec.ts covers the first-time sheet
  let sttWs: WebSocketRoute | null = null;
  let ttsWs: WebSocketRoute | null = null;
  let sttConnectedUrl: string | null = null;
  let ttsConnectedUrl: string | null = null;
  let sttReady = false;
  let ttsReady = false;
  let managedOpened = false;
  let sttAudioCount = 0;
  let flushCounter = 0;
  let cancelEpoch = 0;

  const sttJsonLog: Array<Record<string, unknown>> = [];
  const ttsJsonLog: Array<Record<string, unknown>> = [];

  await page.addInitScript(() => {
    window.localStorage.removeItem('stay_fast_voice');
  });

  await page.route('**/api/voice/fast-token*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' },
      body: JSON.stringify({
        sttToken: 'fake-fast-stt-token',
        ttsToken: 'fake-fast-tts-token',
        keySource: 'server',
      }),
    });
  });

  await page.route('**/api/voice/chat*', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 204 });
      return;
    }
    let lastUser = '';
    let withTools = false;
    try {
      const body = JSON.parse(route.request().postData() || '{}') as {
        messages?: Array<{ role: string; content?: string }>;
        withTools?: boolean;
      };
      lastUser = [...(body.messages || [])].reverse().find((m) => m.role === 'user')?.content || '';
      withTools = body.withTools === true;
    } catch {
      lastUser = '';
    }
    const toolCall = options.chatToolCall?.(lastUser, withTools) ?? null;
    if (toolCall) {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream; charset=utf-8',
        headers: { 'Cache-Control': 'no-store' },
        body:
          `data: ${JSON.stringify({ id: 'chatcmpl-fake-tool', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'fake-call-1', type: 'function', function: { name: 'app', arguments: JSON.stringify(toolCall) } }] } }] })}\n\n` + `data: [DONE]\n\n`,
      });
      return;
    }
    const reply =
      typeof options.chatReplyText === 'function'
        ? options.chatReplyText(lastUser)
        : options.chatReplyText ??
          'I hear you. Open the document and read just the title. Want a two-minute timer?';

    const sseBody =
      `data: ${JSON.stringify({
        id: 'chatcmpl-fake-fast',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content: reply } }],
      })}\n\n` + `data: [DONE]\n\n`;

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      headers: { 'Cache-Control': 'no-store' },
      body: sseBody,
    });
  });

  await page.routeWebSocket(/agents\.assemblyai\.com/, (ws) => {
    managedOpened = true;
    ws.close({ code: 4000, reason: 'Managed agent socket should not open on default FastSocket path' });
  });

  await page.routeWebSocket(/streaming\.assemblyai\.com/, (ws) => {
    sttWs = ws;
    sttConnectedUrl = ws.url();
    const u = new URL(sttConnectedUrl);
    const model = u.searchParams.get('speech_model');
    if (model === 'universal-3-6-pro' && u.searchParams.has('end_of_turn_confidence_threshold')) {
      ws.send(
        JSON.stringify({
          type: 'Error',
          error: 'end_of_turn_confidence_threshold is not supported on universal-3-6-pro',
        })
      );
      ws.close({ code: 1008, reason: 'Unsupported param' });
      return;
    }

    sttReady = true;
    ws.send(
      JSON.stringify({
        type: 'Begin',
        id: 'fake-stt-session-id',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      })
    );

    ws.onMessage((raw) => {
      if (typeof raw !== 'string') {
        sttAudioCount++;
        return;
      }
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        sttJsonLog.push(parsed);
        if (parsed.type === 'Terminate') {
          ws.send(
            JSON.stringify({
              type: 'Termination',
              audio_duration_seconds: 1.5,
              session_duration_seconds: 2.0,
            })
          );
          ws.close({ code: 1000, reason: 'Normal closure' });
        }
      } catch {
        // ignore binary or non-JSON
      }
    });
  });

  await page.routeWebSocket(/tts\.us\.assemblyai\.com/, (ws) => {
    ttsWs = ws;
    ttsConnectedUrl = ws.url();
    const u = new URL(ttsConnectedUrl);

    if (u.searchParams.has('voice')) {
      ws.send(
        JSON.stringify({
          type: 'Error',
          error_code: 3006,
          error: 'voice is retired; use voice_id',
        })
      );
      ws.close({ code: 3006, reason: 'voice is retired; use voice_id' });
      return;
    }

    const voiceId = u.searchParams.get('voice_id') || '';
    if (!VALID_VOICE_IDS.has(voiceId)) {
      ws.send(
        JSON.stringify({
          type: 'Error',
          error_code: 3005,
          error: `Unsupported voice_id: ${voiceId}`,
        })
      );
      ws.close({ code: 3005, reason: 'Unsupported voice_id' });
      return;
    }

    ttsReady = true;
    ws.send(
      JSON.stringify({
        type: 'Begin',
        id: 'fake-tts-session-id',
        configuration: {
          model: u.searchParams.get('model') || 'assemblyai-tts-1',
          voice_id: voiceId,
          sample_rate: Number(u.searchParams.get('sample_rate') || 24000),
          unknown_params: [],
        },
      })
    );

    let pendingWords: string[] = [];

    ws.onMessage((raw) => {
      if (typeof raw !== 'string') return;
      let m: Record<string, unknown>;
      try {
        m = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        ws.send(JSON.stringify({ type: 'Error', error_code: 3012, error: 'Malformed JSON' }));
        ws.close({ code: 3012, reason: 'Malformed JSON' });
        return;
      }
      ttsJsonLog.push(m);

      if (m.type === 'Generate') {
        const text = String(m.text || '').trim();
        if (text) {
          const words = text.split(/\s+/).filter(Boolean);
          pendingWords.push(...words);
        }
      } else if (m.type === 'Flush') {
        const flushId = flushCounter++;
        const myEpoch = cancelEpoch;
        const wordsForFlush = pendingWords.splice(0, pendingWords.length);
        const wordBoundaries = wordsForFlush.map((word, idx) => ({
          word,
          start: 40 + idx * 180,
          end: 40 + idx * 180 + 160,
        }));

        const chunksCount = options.ttsChunksPerFlush ?? 3;
        const chunkInterval = options.ttsChunkIntervalMs ?? 45;
        const initialDelay = options.ttsAudioDelayMs ?? 10;

        setTimeout(() => {
          if (myEpoch !== cancelEpoch) return;
          if (wordBoundaries.length > 0) {
            ws.send(
              JSON.stringify({
                type: 'WordBoundaries',
                flush_id: flushId,
                words: wordBoundaries,
              })
            );
          }
          const pcm = replyPcm(Math.max(2, chunksCount));
          const samplesPerChunk = Math.max(1200, Math.floor(pcm.length / chunksCount));

          for (let c = 0; c < chunksCount; c++) {
            setTimeout(() => {
              if (myEpoch !== cancelEpoch) return;
              const slice = pcm.subarray(c * samplesPerChunk, (c + 1) * samplesPerChunk);
              ws.send(
                JSON.stringify({
                  type: 'Audio',
                  audio: toBase64Pcm(slice.length > 0 ? slice : pcm.subarray(0, 1200)),
                  flush_id: flushId,
                  ...(c === 0 ? { audio_start_ms: 40 } : {}),
                })
              );
              if (c === chunksCount - 1) {
                ws.send(
                  JSON.stringify({
                    type: 'FlushDone',
                    flush_id: flushId,
                  })
                );
              }
            }, c * chunkInterval);
          }
        }, initialDelay);
      } else if (m.type === 'Cancel') {
        cancelEpoch++;
        pendingWords = [];
        ws.send(
          JSON.stringify({
            type: 'Cancelled',
            audio_duration_seconds: 0.18,
          })
        );
      } else if (m.type === 'Terminate') {
        cancelEpoch++;
        ws.send(
          JSON.stringify({
            type: 'Termination',
            characters_synthesized: 64,
            audio_duration_seconds: 1.4,
            session_duration_seconds: 3.0,
          })
        );
        ws.close({ code: 1000, reason: 'Normal closure' });
      }
    });
  });

  return {
    ready: () => sttReady && ttsReady,
    sttUrl: () => sttConnectedUrl,
    ttsUrl: () => ttsConnectedUrl,
    managedAgentSocketOpened: () => managedOpened,
    sttSentJson: () => [...sttJsonLog],
    ttsSentJson: () => [...ttsJsonLog],
    sttAudioFramesReceived: () => sttAudioCount,
    pushSttSpeechStarted(timestampMs = Date.now()) {
      sttWs?.send(JSON.stringify({ type: 'SpeechStarted', timestamp: timestampMs }));
    },
    pushSttPartial(transcript: string, turnOrder = 0, utterance?: string) {
      sttWs?.send(
        JSON.stringify({
          type: 'Turn',
          turn_order: turnOrder,
          turn_is_formatted: false,
          end_of_turn: false,
          transcript,
          ...(utterance !== undefined ? { utterance } : {}),
          words: transcript
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((text, idx) => ({
              text,
              start: idx * 200,
              end: idx * 200 + 180,
              confidence: 0.96,
              word_is_final: false,
            })),
        })
      );
    },
    pushSttFinal(transcript: string, turnOrder = 0, customWords) {
      const words =
        customWords ??
        transcript
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((text, idx) => ({
            text,
            start: idx * 200,
            end: idx * 200 + 180,
            confidence: 0.98,
            word_is_final: true,
          }));
      sttWs?.send(
        JSON.stringify({
          type: 'Turn',
          turn_order: turnOrder,
          turn_is_formatted: true,
          end_of_turn: true,
          transcript,
          utterance: transcript,
          words,
        })
      );
    },
    pushTtsError(errorCode: number, error: string) {
      ttsWs?.send(JSON.stringify({ type: 'Error', error_code: errorCode, error }));
    },
    closeTtsUnexpectedly(code = 1006) {
      ttsWs?.close({ code, reason: 'Simulated unexpected TTS drop' });
    },
    closeSttUnexpectedly(code = 1006) {
      sttWs?.close({ code, reason: 'Simulated unexpected STT drop' });
    },
  };
}
