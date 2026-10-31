# Stay — Audio Continuity, Resampling & Jitter Benchmark (`AUDIO_BENCHMARK.md`)

**Date:** 2026-10-31  
**Evidence Classification:** `UNIT TEST` + `SYNTHETIC TEST` (`tests/voice-audio/*` and `docs/bench-results/audio-continuity.json`, `docs/bench-results/barge-in.json`).

---

## 1. Audio Pipeline Architecture

- **Source Format:** AssemblyAI TTS & Voice Agent emit 24,000 Hz, 16-bit signed little-endian mono PCM (`pcm_s16le`), base64-encoded over WebSocket frames.
- **Odd-Byte Boundary Decoder (`src/lib/voice/playback/pcm16.ts`):**
  - Preserves trailing odd bytes across arbitrary chunk boundaries so multi-byte Int16 samples are never byte-shifted into white noise.
  - Normalizes Int16 (`[-32768, 32767]`) to Float32 (`[-1.0, 1.0]`).
- **Stateful Fractional Resampler (`src/lib/voice/playback/sampleRateConverter.ts`):**
  - Stateful linear interpolation from `24,000 Hz` to hardware `AudioContext.sampleRate` (`44,100 Hz` or `48,000 Hz`).
  - Carries fractional phase and last sample across chunks to eliminate chunk-boundary clicks/pop artifacts.
- **AudioWorklet Ring Buffer (`public/worklets/stay-pcm-playback-processor.js`):**
  - 30-second Float32 circular buffer running on the dedicated Web Audio rendering thread.
  - **Prebuffer Gate:** Accumulates `180 ms` of audio in `BUFFERING` state before transitioning to `PLAYING`.
  - **Underflow Protection:** Applies a 64-sample raised-cosine fade-out ramp before entering `BUFFERING` if network jitter exhausts the buffer, and a 64-sample fade-in ramp when resuming.
  - **Epoch-Fenced Cancellation:** Discards stale chunks from prior `sessionEpoch` or `replyEpoch` immediately upon barge-in.

---

## 2. Synthetic Jitter & Continuity Matrix

Verified via `tests/voice-audio/pcmCodec.test.ts`, `tests/voice-audio/resampler.test.ts`, `tests/voice-audio/jitter.test.ts`, `tests/voice-audio/reproduceDropout.test.ts`, and `tests/voice-audio/playbackClock.test.ts`:

| Jitter Profile | Target Rate | Prebuffer | Underflows | Clicks / Discontinuities | Sample Loss | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0 ms (Ideal Stream)** | 48,000 Hz | 180 ms | `0` | `0` (`maxDelta < 0.09`) | `0%` | **PASS** (`SYNTHETIC TEST`) |
| **20 ms (Normal Wi-Fi)** | 48,000 Hz | 180 ms | `0` | `0` (`maxDelta < 0.09`) | `0%` | **PASS** (`SYNTHETIC TEST`) |
| **50 ms (Moderate Jitter)** | 48,000 Hz | 180 ms | `0` | `0` (`maxDelta < 0.09`) | `0%` | **PASS** (`SYNTHETIC TEST`) |
| **100 ms (Mobile/Congested)** | 48,000 Hz | 180 ms | `0` | `0` (`maxDelta < 0.09`) | `0%` | **PASS** (`SYNTHETIC TEST`) |
| **200 ms (Burst Delay)** | 44,100 Hz | 180 ms | `0` | `0` (`maxDelta < 0.09`) | `0%` | **PASS** (`SYNTHETIC TEST`) |
| **400 ms (Extreme Stall)** | 48,000 Hz | 180 ms | `1` (graceful ramp) | `0` (64-sample cosine fade prevents pop) | `0%` (resumes cleanly) | **PASS** (`SYNTHETIC TEST`) |

---

## 3. Barge-In & Epoch Cancellation Benchmark

Verified via `tests/voice-audio/epochs.test.ts` and `docs/bench-results/barge-in.json` (40 synthetic scenarios):

| Metric | Target | Measured Result | Evidence |
| :--- | :--- | :--- | :--- |
| **Barge-In Stop Latency (p50)** | `< 100 ms` | **48 ms** | `docs/bench-results/barge-in.json` (`SYNTHETIC TEST`) |
| **Barge-In Stop Latency (p95)** | `< 100 ms` | **92 ms** | `docs/bench-results/barge-in.json` (`SYNTHETIC TEST`) |
| **Stale Audio Samples Leaked After Cancel** | `0 samples` | **0 samples** | `tests/voice-audio/epochs.test.ts` (`UNIT TEST`) |
| **Odd-Byte Split Frame Integrity** | Bit-exact reconstruction | **100% bit-exact** across 1-byte to 4096-byte splits | `tests/voice-audio/pcmCodec.test.ts` (`UNIT TEST`) |
