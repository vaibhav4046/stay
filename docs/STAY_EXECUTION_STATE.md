# STAY — EXECUTION STATE REGISTRY
**Updated:** 2026-10-30T22:41:00Z  
**Branch:** feat/omnirush-continuous-voice  
**Initial SHA:** 08f43d5  
**Rollback SHA:** 08f43d5  

## Baseline Test Status
- Vitest: 634 passed / 634 total across 37 test files
- Typecheck (tsc --noEmit): 0 errors
- Production Build (next build): 25/25 static routes generated, 0 errors
- Playwright E2E: Available & verified (Chromium functional locally)

## Voice Paths & Protocols
1. **Managed AssemblyAI Voice Agent**:
   - URL: `wss://agents.assemblyai.com/v1/ws`
   - Ingress: mono PCM16 -> `session.ready` -> `input.audio` -> `reply.audio.data` (base64 PCM16)
   - Interruption: `reply.done` with `status: "interrupted"` -> cancel local queued epoch
2. **FastSocket Cascade (AssemblyAI STT + LLM + AssemblyAI TTS)**:
   - STT: `wss://streaming.assemblyai.com/v3/ws`
   - LLM: `/api/voice/chat`
   - TTS: `wss://tts.us.assemblyai.com/v1/ws` (updating legacy streaming-tts host)
   - Frames: `Begin`, `Generate`, `Flush`, `Audio` (base64 in `audio`), `FlushDone`, `Cancelled`, `Cancel`, `WordBoundaries`
3. **Azure Speech Fallback**: `/api/voice/tts` streaming SSML PCM16 24kHz mono
4. **Browser SpeechSynthesis Fallback**: Native client synthesis with explicit UI indicator
5. **Quiet Text Mode**: Direct text chat with zero audio requirement

## Top 3 Severe Defects
1. **Audible PCM Dropout on Network Jitter**: `useVoiceAgent.ts:891-933` schedules each chunk into an independent `AudioBufferSourceNode`. When network jitter delays chunk arrival past `nextPlaybackTimeRef`, the node starts at `ctx.currentTime + 0.015`, causing a dead audible silence gap and boundary pop.
2. **Resampler Boundary Discontinuity**: Independent buffer sources reset internal browser resampler state when hardware context is 44.1kHz or 48kHz, generating phase artifacts at chunk edges.
3. **Outdated Provider Host Reference**: `fastSocket.ts` references deprecated `wss://streaming-tts.assemblyai.com/v1/ws` instead of `wss://tts.us.assemblyai.com/v1/ws`.

## Target Architecture
- Unified continuous playback engine: `public/worklets/stay-pcm-playback-processor.js` (AudioWorklet) + `src/lib/voice/playback/`
- Stateful streaming polyphase/linear resampler carrying fractional phase across chunks
- Adaptive jitter prebuffer (80-150ms initial, 60-300ms bounded)
- Monotonic session & reply epochs with instant click-free mute/flush on barge-in
- Fallback scheduled buffer player when AudioWorklet is unavailable

## Budget & Approvals
- Paid API Spend: \$0 (Mock fixtures for all test runs)
- Autonomous Scope: Internal code, unit/DSP/E2E tests, documentation, release artifacts
- User Gated Actions: Live production deployment / domain cutover, external API credit purchase
- Current Phase: Phase 3 (Reproduce Dropout & Measure Baseline)
