# Stay — Progressive Live Caption Synchronization Audit (`CAPTION_SYNC_AUDIT.md`)

**Date:** 2026-10-31  
**Evidence Classification:** `UNIT TEST` (`tests/unit/captionSync.test.ts`, `tests/unit/fastSocket.test.ts`) + `E2E TEST` (`tests/e2e/liveVoiceSync.spec.ts`).

---

## 1. Root Cause Analysis of Previous Caption Desynchronization

During Phase 2 inspection of commit `7b9a151`, three interacting bugs were identified that caused the user-reported symptom (*"I am saying hi hello and then immediately answer is came typing but voice later"*):

1. **Premature Finalization on Network `reply.done`:**
   - AssemblyAI streaming TTS synthesizes audio at ~8x–10x real-time speed: a 2,400ms spoken reply is fully synthesized and transmitted over the WebSocket in ~250ms, followed immediately by `FlushDone` -> `FastSocket` emitting `transcript.agent` and `reply.done`.
   - In `src/lib/voice/useVoiceAgent.ts`, the `reply.done` handler previously cleared `captionTickerRef`, overwrote `liveSpokenText` with the entire `finalText`, and transitioned `visualState` from `'speaking'` to `'listening'` at `t = 250ms` — while 2,150ms of audio remained buffered and playing in `ContinuousPcmPlayer`.
2. **Multi-Flush `WordBoundaries` Reset to Zero:**
   - When `FastSocket` streamed multi-sentence replies via `takeSpeakable()`, each sentence triggered a separate `Generate` + `Flush`. AssemblyAI TTS returned `WordBoundaries` for flush #2 starting at `start: 0` relative to that flush, causing flush #2 words to satisfy `w.start <= elapsedMs` while flush #1 was still playing.
3. **Browser SpeechSynthesis Fallback (`speakDeterministicBoundary`) Pre-Speech Text Flash:**
   - When operating without a live WebSocket (or on local greeting reflex), `speakDeterministicBoundary` waited for `utterance.onstart` before setting `visualState('speaking')`. During the 100–300ms browser voice initialization window, `StayHome.tsx` saw `isAgentSpeaking === false` and rendered the entire `lastAgent.text` immediately.

---

## 2. Engineering Fixes Implemented

1. **Playback-Clock-Locked Caption Engine (`src/lib/voice/captionSync.ts` & `src/lib/voice/useVoiceAgent.ts`):**
   - Accumulated `expectedAudioDurationMsRef` from every incoming `reply.audio` PCM16 chunk (`(b64.length * 0.75) / 48` ms at 24kHz 16-bit mono).
   - Anchored `speechAudioStartTimeRef` to actual audio output (accounting for the prebuffer window and locking to `performance.now() - pcmPlayer.getPlaybackPositionMs()` when `ContinuousPcmPlayer` telemetry enters `PLAYING`).
   - Updated `reply.done` in `useVoiceAgent.ts` to set `replyDoneReceivedRef.current = true` while keeping `captionTickerRef` and `visualState = 'speaking'` active until `elapsedMs` reaches `max(expectedAudioDurationMs, lastBoundaryEnd)` (or until a barge-in cancels playback).
2. **Monotonic Multi-Flush `WordBoundaries` Alignment (`src/lib/voice/fastSocket.ts`):**
   - Added `onWordBoundaries()` in `FastSocket` tracking `wordBoundaryOffsetMs` and `lastWordEndMs` per reply (`reply_id = this.genId`). When a subsequent flush emits `start < lastWordEndMs`, all word timestamps in that flush are shifted by `lastWordEndMs + 60ms`.
3. **Immediate Speaking State & Progressive Reveal in `speakDeterministicBoundary` (`src/lib/voice/useVoiceAgent.ts`):**
   - `speakDeterministicBoundary` now sets `visualState('speaking')` and initializes progressive word-by-word reveal (`180ms/word` timer + `utterance.onboundary` sync) synchronously before calling `window.speechSynthesis.speak()`.

---

## 3. Before / After Caption Synchronization Timing

| Scenario | Before Fix (`7b9a151`) | After Fix (Current) | Verification |
| :--- | :--- | :--- | :--- |
| **Prebuffer (`t = -80ms` before first sample audible)** | First words revealed immediately on network packet arrival | Held empty (`""`) until audio is audible (`elapsedMs >= 0`) | `UNIT TEST` (`tests/unit/captionSync.test.ts`) |
| **Network `reply.done` arrives at `t = 250ms` for 2,400ms audio** | Full 10-word sentence dumped onto screen at `t = 250ms`; orb stops speaking at `250ms` | At `250ms`: `"Hey. Good"` (2 words); at `900ms`: `"Hey. Good to hear from"` (5 words); at `2,400ms`: full 10 words + transition to `listening` | `UNIT TEST` (`tests/unit/captionSync.test.ts`) |
| **Multi-Flush Two-Sentence Reply** | Sentence 2 words dumped during Sentence 1 playback (`start: 0` overlap) | Sentence 2 `WordBoundaries` monotonically offset after Sentence 1 `end` (`>= 660ms`) | `UNIT TEST` (`tests/unit/fastSocket.test.ts`) |
| **Greeting `"Hi hello"` on `/app/today`** | 35-word paragraph flashed immediately | Warm 9-word human greeting (`"Hey. Good to hear from you. What's on your mind?"`) revealed progressively with voice | `E2E TEST` (`tests/e2e/liveVoiceSync.spec.ts`) |
| **Mid-Speech Barge-In (`"stop"` at `t = 900ms`)** | Caption jumped to full text on cancel | `stopPlaybackQueue()` halts `captionTickerRef` immediately; unspoken words are never revealed | `UNIT TEST` (`tests/unit/fastSocket.test.ts`) |
