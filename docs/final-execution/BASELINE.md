# Stay — Final Execution Baseline (`BASELINE.md`)

**Date:** 2026-10-31  
**Repository:** `https://github.com/vaibhav4046/stay`  
**Live Deployment:** `https://stay-two-swart.vercel.app`  
**Starting Commit:** `7b9a15150260489b58c0d486bdb08352b153da9c` (`7b9a151`)  
**Rollback Reference Branch:** `backup-pre-final-execution`

---

## 1. Repository & Build Baseline

| Check | Baseline Status | Details |
| :--- | :--- | :--- |
| **Git Working Tree** | Clean (`master...origin/master`) | Rollback ref `backup-pre-final-execution` created at `7b9a151` |
| **Unit & Audio Tests (`npm test`)** | 47 / 47 files PASS (682 tests) | Includes `tests/unit/*` and `tests/voice-audio/*` |
| **Next.js Production Build (`npm run build`)** | PASS (27 routes) | Static & dynamic routes compile with zero TypeScript errors |
| **Audio Playback Engine** | `ContinuousPcmPlayer` + `stay-pcm-playback-processor.js` | Single canonical AudioWorklet ring-buffer engine with fallback scheduling |

---

## 2. Initial Defects & Gaps Identified During Phase 0 Inspection

### Defect 1: Premature Caption Dump on `reply.done` (Root Cause of "Typing Immediately, Voice Later")
- **Location:** `src/lib/voice/useVoiceAgent.ts` (lines 2293–2386)
- **Root Cause:** AssemblyAI streaming TTS synthesizes audio 5x–10x faster than real-time playback (a 3.0s spoken reply downloads in ~250ms) and immediately emits `FlushDone` -> `FastSocket` emits `transcript.agent` and `reply.done` at ~250ms. In `useVoiceAgent.ts`, the `reply.done` handler immediately cleared `captionTickerRef`, set `liveSpokenText` to the full text, and transitioned `visualState` to `'listening'` while 2.5+ seconds of audio remained buffered and playing in `ContinuousPcmPlayer`.
- **Fix Required:** Track `expectedAudioDurationMsRef` from incoming PCM16 chunks, anchor `speechAudioStartTimeRef` to actual audio playback (`ContinuousPcmPlayer` `PLAYING` telemetry / prebuffer offset), and keep `captionTickerRef` + `visualState = 'speaking'` running after `reply.done` until playback actually finishes (or barge-in cancels it).

### Defect 2: Multi-Flush `WordBoundaries` Offset Reset
- **Location:** `src/lib/voice/fastSocket.ts` (line 309)
- **Root Cause:** When `FastSocket` streams multi-sentence LLM output via `takeSpeakable()`, it sends multiple `Generate` + `Flush` pairs. AssemblyAI TTS returns `WordBoundaries` per flush where `start` resets to `0` for flush #2+, causing flush #2 words to satisfy `w.start <= elapsedMs` immediately while flush #1 is still being spoken.
- **Fix Required:** Normalize `WordBoundaries` timestamps to milliseconds and accumulate monotonic `wordBoundaryOffsetMs` across flushes within a reply epoch (`reply_id`).

### Defect 3: Browser SpeechSynthesis Fallback (`speakDeterministicBoundary`) Lacked Progressive Reveal & Immediate Speaking State
- **Location:** `src/lib/voice/useVoiceAgent.ts` (lines 782–914, 1626–1640)
- **Root Cause:** When offline or using typed input without an open WebSocket, `speakDeterministicBoundary` waited for `utterance.onstart` before setting `visualState('speaking')`, allowing `StayHome.tsx` to flash the entire `lastAgent.text` before speech started, and lacked a progressive word-reveal timer when `utterance.onboundary` was not fired by the OS voice.
- **Fix Required:** Set `visualState('speaking')` and clear `liveSpokenText` immediately on `speakDeterministicBoundary` invocation, and drive progressive word-by-word caption reveal via a timer synced with `onboundary`.

### Defect 4: Full-Duplex Overlap Classification (1-Word Stop vs. 2-Word Backchannel)
- **Location:** `src/lib/voice/fastSocket.ts` (line 329)
- **Root Cause:** `if (this.agentSpeaking && text.split(/\s+/).length < 2) return;` blocked 1-word explicit interruptions (`"stop"`, `"wait"`, `"pause"`) while allowing 2-word conversational acknowledgements (`"uh huh"`, `"got it"`, `"yeah okay"`) to falsely barge in and cancel assistant speech.
- **Fix Required:** Explicitly classify backchannels (`isBackchannelOnly`) vs. explicit interruptions (`isExplicitInterruption`), add `ENDPOINTING_PRESETS` (`coaching`, `reflective`, `crisis`), and trigger early speculation on AssemblyAI `Turn.utterance`.

### Defect 5: Hardcoded Machine Paths in Playwright Specs & Docs
- **Location:** `tests/e2e/liveVoiceSync.spec.ts`, `tests/e2e/visualVerification.spec.ts`, `HACKATHON_SUBMISSION.md`
- **Root Cause:** Hardcoded `C:/Users/lalwa/.gemini/antigravity/...` paths break portability on Linux/macOS CI runners and judge machines.
- **Fix Required:** Replace all hardcoded paths with portable repository-relative paths (`test-results/` and `docs/verification-screenshots/`).
