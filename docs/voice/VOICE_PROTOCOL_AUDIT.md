# Stay Voice Companion Architecture & Realtime Protocol Audit

**Date:** 2026-11-01  
**Repository:** [https://github.com/vaibhav4046/stay](https://github.com/vaibhav4046/stay)  
**Evidence Directory:** [`docs/evidence/`](../evidence/) · [`docs/audit/AUDIT.md`](../audit/AUDIT.md)

---

## 1. Transport & Token Architecture

### 1.1 Default Fast Path (`FastSocket`)
- **Implementation:** `src/lib/voice/fastSocket.ts`
- **Token Endpoint:** `src/app/api/voice/fast-token/route.ts` mints two distinct short-lived tokens (`Cache-Control: no-store`):
  - **STT v3 token:** `GET https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=3600`
  - **TTS v1 token:** `GET https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=3600`
- **No Silent Fallback:** If either socket fails, Stay surfaces the exact reason in `TransportBadge` (`src/components/voice/TransportBadge.tsx`) rather than silently switching to `wss://agents.assemblyai.com/v1/ws`.

---

## 2. Speech-to-Text (`wss://streaming.assemblyai.com/v3/ws`)

- **Audio Capture:** `public/pcm-processor.js` applies a 2nd-order Butterworth low-pass filter ($f_c = 7200\text{ Hz}$) before downsampling to 16,000 Hz mono `pcm_s16le` in 100 ms frames (1,600 samples = 3,200 bytes).
- **Query Parameters:** `speech_model=universal-3-6-pro&sample_rate=16000&encoding=pcm_s16le&min_turn_silence=128&max_turn_silence=1280&vad_threshold=0.2&language_detection=true` plus optional `keyterms_prompt` (`<= 100` phrases from user's "My words").
- **Prohibited Legacy Parameters:** `end_of_turn_confidence_threshold`, `format_turns`, and `prompt` are never sent with `universal-3-6-pro` (`tests/unit/assemblyaiContract.test.ts`).
- **Context Continuity:** Sends `{"type":"UpdateConfiguration","agent_context":"..."}` after each assistant reply and `{"type":"Terminate"}` before closing.

---

## 3. Text-to-Speech (`wss://tts.us.assemblyai.com/v1/ws`)

- **Query Parameters:** `token=<ttsToken>&model=assemblyai-tts-1&voice_id=<id>&sample_rate=24000&encoding=pcm_s16le&language=<lang>&word_timestamps=true`.
- **Voice IDs:** Uses verified AssemblyAI voice IDs from `docs/audit/SOURCES.md` (`toAssemblyVoiceId()` in `src/lib/voice/fastSocket.ts`). The retired `voice=` parameter is never sent.
- **Word Boundaries:** Reads `msg.word` (`WordBoundaries.word`), subtracting the first `Audio.audio_start_ms` offset to align word timestamps with rendered audio samples.
- **Session Liveness:** Sends `{"type":"KeepAlive"}` every 30 s and rotates the TTS session cleanly at 55 minutes on a reply boundary.

---

## 4. AudioWorklet Playback & Barge-In

- **Processor:** `public/worklets/stay-pcm-playback-processor.js`
- **Benchmark Evidence:** See [`docs/voice/VOICE_PROOF.md`](VOICE_PROOF.md) and [`docs/evidence/unit/dsp-worklet-bench.json`](../evidence/unit/dsp-worklet-bench.json) for measured rendered samples, underflow counts, fade transitions, and post-cancel stale sample counts across the 0–400 ms jitter matrix.
