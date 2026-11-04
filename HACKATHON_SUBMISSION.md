# Stay: AssemblyAI Voice Hackathon Submission

**Live App:** [https://stay-two-swart.vercel.app/app/today](https://stay-two-swart.vercel.app/app/today)  
**Repository:** [https://github.com/vaibhav4046/stay](https://github.com/vaibhav4046/stay)  
**Hackathon:** AssemblyAI "Voice hackathon week: Hack into speech"

---

## In one minute

**Stay helps you start the thing you keep avoiding.** You say it out loud (or type it). Stay answers in a calm voice with one small step, waits while you think, and checks in. It is built for adults with ADHD. It does not offer therapy or a diagnosis, and it never gives medication advice.

**Try it (2 minutes):**
1. Open the live app and tap **Talk** (a sheet asks before the microphone is used) or **Call Stay** (it rings, then answers).
2. Ask a real question. The first sentence of the reply is the answer.
3. Tell it something you are putting off. You get one tiny step. Pause mid-sentence: it waits. Interrupt it: it gets quiet.
4. Tap the plus button and show it your screen, the camera or a picture, then ask what is on it. It only looks when you ask.
5. With language on Auto, say a whole sentence of three or more words in Spanish, French, German, Italian or Portuguese: when that turn ends and the language is recognised with enough confidence, the voice moves to that language for the reply. It does not switch in the middle of a sentence.
6. Start a 2-minute focus block, then open **Report** for a one-page summary to bring to an appointment.

**What AssemblyAI does here:** it turns your speech into text live (Universal-3.6 Pro) and speaks Stay's replies (AssemblyAI TTS). The badge in the corner says so, and says it plainly if anything else is speaking.

**What we measured** (real AssemblyAI, synthetic speech, one machine; details in section 3): 0% of words wrong in 25 English sentences across 5 accents (3 hard-name sentences: 12.3% wrong, 3.0% with My words), language detected correctly in all 36 clips, first words on screen a median 0.95 seconds after you start speaking, voice starts a median 0.17 seconds after the reply text is sent. Measured 4 Nov 2026 at commit bdcd654 on a clean checkout: [`docs/evidence/real-provider/measure-bdcd654.json`](docs/evidence/real-provider/measure-bdcd654.json).

**Real end-to-end run** (`scripts/real-voice-e2e.mjs`, evidence in `docs/evidence/real-e2e/`, latest `run-ba6a337.json`): AssemblyAI's own voices played the human speaker into the live app's microphone stream; the app used real AssemblyAI speech-to-text, the language model and AssemblyAI text-to-speech. It heard English and a full Spanish sentence, replied in short turns, moved the voice to Spanish and answered in Spanish, and never opened the managed-agent socket. In that run: end of speech to the first audio packet reaching the browser 719 ms (the screen showed "Speaking" at 899 ms), the first packet of the Spanish reply 1.82 s after the sentence ended, and zero gaps in Stay's voice (playback underflows). That 719 ms is one call. In six longer soak runs (44 to 189 turns each, `docs/evidence/loop/soak-run5` to `soak-run10`) the first sound was played a median 1,128 to 1,300 ms after the speaker stopped, with a 95th percentile of 2,031 to 4,506 ms. The call's figures are packet-arrival times, not the moment the sound was played; runs since 2 Nov also record the first sample actually output by the audio context (see section 5). Five runs are saved in `docs/evidence/real-e2e/` (1 to 3 November; the page shows `run-ba6a337.json`, the newest file is `run-ab7c676.json`). End of speech to Stay speaking was 4.13 s in the first (`run-7162960.json`, the previous screen) and 0.75, 0.90, 1.09 and 1.16 s in the other four (median about 1.0 s). Earlier runs from my notes (2.7 to 4.4 s on the previous screen, and a figure of "10 runs") were not saved as files, so they are not claimed here. Stopping when talked over varied a lot: 187, 610, 775 and 849 ms in the four runs where Stay was speaking at the time, so treat it as "under a second, not consistent". In 2 of the 5 saved runs (`run-63cc399.json`, `run-ba6a337.json`) the first connection attempt failed because the speech-to-text socket did not answer in time; the app retries twice with fresh tokens and the retry worked both times. I did not find out why the previous screen was slower and did not re-run it to check. The call used to get stuck on Speaking after a Spanish switch; that had two causes (cancels whose acknowledgements were lost when the voice session was replaced, and a reply finished before the new Spanish voice had opened), each reproduced by a unit test that fails without its fix, plus an 8 s safety net. The real calls after the second fix all finished normally; that is a small sample. One machine, Chromium only, synthetic speaker, and AssemblyAI's account limits (5 new voice sessions a minute, a small cap on live streams) apply to everyone using the site.

**Honest limits:** not tested with a human microphone in these runs; AssemblyAI's voice speaks 6 languages (Hindi gets a Roman-letter Hinglish reply in the English voice); the in-page "Stay calls you" only works while the page is open and there is no phone number; the film on the landing page is one real call recorded in the app, with a synthetic voice for the person speaking and captions for all of it (how it was made, and its weak spots: `docs/evidence/film/README.md`); a connection that fails before it is ready is retried twice, but AssemblyAI's per-account limits (5 new voice sessions a minute, a small cap on live streams) are shared by every visitor to the site.

---
## 1. What Stay Is & Who It Helps

Stay is a calm, voice-first companion for adults with ADHD who get stuck starting avoided tasks or blank out when preparing for a doctor, counsellor, or coaching appointment. You speak a messy thought in your own language or accent; Stay gives a brief, non-shaming reply, one concrete two-minute next step, and an optional check-in question. It can also build a one-page appointment summary from your own logs, and you choose every section.

---

## 2. Exact AssemblyAI Features Used

| Feature | Implementation in Stay | Code & Evidence |
|---|---|---|
| **Universal-3.6 Pro Realtime STT** (`wss://streaming.assemblyai.com/v3/ws`) | Browser-direct 16 kHz PCM16 capture (`public/pcm-processor.js` with 2nd-order Butterworth low-pass anti-aliasing filter at 7.2 kHz), `speech_model=universal-3-6-pro`, `min_turn_silence=128`, `max_turn_silence=1280`, `vad_threshold=0.2`, `language_detection=true`. | `src/lib/voice/fastSocket.ts`, `tests/unit/assemblyaiContract.test.ts` |
| **`SpeechStarted` Two-Stage Barge-In** | Immediately ducks playback on `SpeechStarted` (after 250 ms echo guard) and commits full `Cancel` + worklet ring flush on the first non-backchannel partial or stop word. | `src/lib/voice/fastSocket.ts`, `docs/evidence/unit/dsp-worklet-bench.json` |
| **Dynamic `UpdateConfiguration.agent_context`** | Sends `{"type":"UpdateConfiguration","agent_context":"..."}` after each assistant reply so Universal-3.6 Pro biases continuation turns toward the active conversation context. | `src/lib/voice/fastSocket.ts` |
| **`keyterms_prompt` ("My words")** | Sends user-configured names, dissertation terms, medication names (for transcription accuracy only), and task phrases at session start (`<= 100` entries). | `src/lib/voice/agentTool.ts` |
| **Language detection, followed by the voice** | `language_detection=true`. In Auto, each final turn's `language_code` moves the TTS session to that language and its native voice when AssemblyAI TTS speaks it (Spanish, French, German, Italian, Portuguese, English); Hindi is answered in Roman-letter Hinglish so the voice can say it; other languages get a short English answer and an honest note. A translation route exists (`/api/voice/translate`) but is not exposed in the app. | `src/lib/voice/fastSocket.ts`, `src/lib/voice/replyLanguage.ts`, `tests/unit/fastSocket.test.ts` |
| **Streaming TTS (`assemblyai-tts-1`)** (`wss://tts.us.assemblyai.com/v1/ws`) | Connects using product-scoped ephemeral tokens (`GET https://token.us.assemblyai.com/v1/token?product=tts`) and `voice_id=` values checked against the live API (all 18 on the shortlist opened a session on 4 Nov 2026, `docs/evidence/voices/verify-2026-11-04.json`): American and British English voices plus native Spanish, French, German, Italian and Portuguese voices. Andrew (Indian English, male) and Constanza / Mateo (Mexican Spanish) are AssemblyAI voices too; AssemblyAI has no female Indian English voice, so Kavya uses Azure or the device voice and says so. | `src/app/api/voice/fast-token/route.ts`, `src/lib/voice/fastSocket.ts`, `scripts/verify-voices.mjs` |
| **Call Stay (browser call)** | A phone-style call over the same pipeline: ringback tone while it connects, a clock, mute and end, at most two quiet check-ins, 10-minute cap, and an in-page 'call me in 5, 15 or 30 minutes' ring (works only while the page is open; there is no phone number). | `src/lib/voice/callMode.ts`, `src/lib/voice/ringtone.ts`, `tests/unit/callMode.test.ts`, `tests/e2e/callMode.spec.ts` |
| **`WordBoundaries` Synced Captions & Heard/Unheard Split** | Subtracts first-frame `audio_start_ms` offset and uses AudioWorklet `renderedSamples` to highlight spoken words and split `heardText` vs `unheardText` on interruption. | `src/lib/voice/fastSocket.ts`, `docs/voice/VOICE_PROOF.md` |
| **TTS `KeepAlive` & Graceful `Terminate`** | Sends `{"type":"KeepAlive"}` every 30 s during Quiet / body-doubling blocks so the 120 s idle timeout never drops the TTS socket, and sends `{"type":"Terminate"}` before closing. | `src/lib/voice/fastSocket.ts` |

---

## 3. Measured Verification & Evidence Links

Every metric in this repository is tied to an output file generated by scripts in this repo:

- **Phase 0 Baseline Environment & Audits:**
  - Environment & commit state: [`docs/evidence/phase0-env.txt`](docs/evidence/phase0-env.txt)
  - Typecheck (`npx tsc --noEmit`): [`docs/evidence/phase0-tsc.txt`](docs/evidence/phase0-tsc.txt)
  - Unit & DSP test suite (`npx vitest run`): [`docs/evidence/phase0-vitest.txt`](docs/evidence/phase0-vitest.txt)
  - Production build (`npm run build`): [`docs/evidence/phase0-build.txt`](docs/evidence/phase0-build.txt)
  - Playwright browser suite (`npx playwright test`): [`docs/evidence/phase0-playwright.txt`](docs/evidence/phase0-playwright.txt)
  - Multi-viewport light/dark browser audit: [`docs/evidence/phase0-browser-audit.json`](docs/evidence/phase0-browser-audit.json)
- **Tier 1 Unit & AudioWorklet DSP Benchmarks:**
  - AudioWorklet ring buffer jitter & cancel benchmark: [`docs/evidence/unit/dsp-worklet-bench.json`](docs/evidence/unit/dsp-worklet-bench.json) and [`docs/voice/VOICE_PROOF.md`](docs/voice/VOICE_PROOF.md)
  - Deterministic crisis, medication, SSRF, and multi-intent checks: [`docs/evidence/unit/safety-command-checks.json`](docs/evidence/unit/safety-command-checks.json)
- **Real AssemblyAI checks (tier 3, `scripts/smoke-assemblyai.mjs` and `scripts/verify-voices.mjs`):** voices that open a session, 18 of 18 on 4 Nov 2026: [`docs/evidence/voices/verify-2026-11-04.json`](docs/evidence/voices/verify-2026-11-04.json); the smoke test: [`docs/evidence/real-provider/smoke-status.json`](docs/evidence/real-provider/smoke-status.json). The smoke test opens both sockets and streams TTS; it did not stream speech through STT (the speech measurement does: [`docs/evidence/real-provider/measure-bdcd654.json`](docs/evidence/real-provider/measure-bdcd654.json)).

---

## 4. What Stay does not do, and honest limits

- **Not a medical device, clinician, or therapy:** Stay does not diagnose ADHD or any condition, does not deliver CBT, and never comments on medication doses, timing, interactions, or side effects.
- **Deterministic safety first:** Crisis phrases in English and 23 other languages (the lists in `src/lib/safety/crisis.ts`) immediately stop TTS playback, skip the model on typed text and fast voice, and show help for where you are: UK (999, NHS 111 mental health option, Samaritans 116 123, Shout), US and Canada (988), and findahelpline.com for anywhere else. The urgent help page lists all of them. The numbers and where they were checked are in `docs/audit/SOURCES.md`. This holds for typed text, spoken turns, translation, agent tools and text read out of a picture. The phone agent (not deployed) sends each caller turn to the same check before its model is asked (`agent/agent.py`, `agent/test_agent.py`); that is tested with mocks only, not on a real call.
- **Honest language & transport labels:** AssemblyAI TTS currently speaks 6 languages (`english`, `spanish`, `french`, `german`, `italian`, `portuguese`). Hindi is understood by fast voice and answered in Roman-letter Hinglish by the English voice (`src/lib/voice/replyLanguage.ts`). Every other language gets a short English answer and one note that the voice cannot speak it yet. The browser's device voice is used only when the AssemblyAI voice session fails, and the transport badge then says "Device voice" or "Text only".
- **Evidence boundaries:** Simulated-speaker and AudioWorklet unit tests verify protocol and DSP behaviour; hardware acoustic loopback and human microphone sessions are reported separately (`NOT_RUN` unless executed by a human speaker with a live microphone).

---

## 5. Checked on 2 November 2026 (what changed in the last pass, and what it showed)

Labels: `live-model` is a real model call; `synthetic-mic` is a text-to-speech voice played in as the microphone. **Nothing below was measured with a person speaking into a microphone.** The gate-by-gate record, including what is still open, is [`docs/loop/LEDGER.md`](docs/loop/LEDGER.md).

| What | Result | Label | File |
|---|---|---|---|
| 60 prompts, typed: 20 facts, 10 how-tos, 10 follow-ups, 10 about Stay, 10 task starts | 59 of 60 on topic, 0 stock replies (first run 44, second 52, then the fixes below) | live-model, typed | [`docs/evidence/loop/T0.1-live-2026-11-02.json`](docs/evidence/loop/T0.1-live-2026-11-02.json) |
| The same prompts routed to the right kind of reply | 60 of 60 | mocked-model | [`tests/unit/evalRouting.test.ts`](tests/unit/evalRouting.test.ts) |
| A picture with planted orders | 5 of 5 answered runs did not follow them | live-model, picture | [`docs/evidence/loop/T0.8-live-2026-11-02.json`](docs/evidence/loop/T0.8-live-2026-11-02.json) |
| 20 medication-question phrasings | all get the fixed boundary reply, model not called | unit test | [`docs/evidence/loop/T0.4-after.txt`](docs/evidence/loop/T0.4-after.txt) |
| TTS voices that open a live session | 18 of 18 | live provider handshake | [`docs/evidence/voices/verify-2026-11-02.json`](docs/evidence/voices/verify-2026-11-02.json) |
| Reply timing, waiting through a pause, stopping when talked over | First sound from the speaker a median 966 ms after the simulated speaker stopped (95th percentile 1,847 ms, 24 turns, 3 runs). Waited through 20 of 20 pauses of 1.8, 2.3 and 2.5 s and answered the finished thought each time (median 1,370 ms after it; `docs/evidence/loop/T2.4-pause20-2026-11-02.txt`). Went quiet a median 371 ms after being talked over (3 tries). **My target was 900 ms and 1,500 ms; the timing target is not met.** In 3 separately timed turns the speech service called the end of the turn a median 585 ms after the speaker stopped, which is part of the reply time (`docs/evidence/loop/T2-cpu-throttle-2026-11-02.txt`) | synthetic-mic + live-model | [`docs/evidence/loop/T2-bench-2026-11-02-series2.json`](docs/evidence/loop/T2-bench-2026-11-02-series2.json) |

**What the checks found and fixed (these are the honest part):**
- The default reply prompt forced "acknowledge, tiny physical step, question" onto every turn, so "what is the difference between a virus and a bacterium" got "Sure thing! Pick one topic". The prompt now follows what the person is doing (a question gets an answer first). 44 of 60 became 59 of 60.
- Six basic questions about Stay itself ("can you see my screen", "do you remember what I tell you", "are you a real person") had no direct answer. They do now.
- Medication brand-name misspellings (adderal, ritilin, vyvance) slipped past the medication check. Fixed.
- A test browser could skip the microphone consent sheet. That exception is gone, and "delete all my data" now also clears the consent setting, which it did not before.
- The server could stop an unsafe reply to a picture, but the app showed "could not make that out" instead of the help screen. Fixed.
- `bench:voice` was timing a playback path Stay no longer uses (it hooked `AudioBufferSourceNode`, Stay now plays through an AudioWorklet). It now reads the moment the first sample is actually output.
- Two tables on the landing page had no raw data file behind them (fast voice against the managed voice; per-language error rates). They were removed rather than kept.

**Still open:** the phone agent is built on LiveKit Agents 1.8 and held to the web app's own crisis and medication checks, but it is not deployed and has no number (calls work in the browser with Call Stay); no human-microphone run; no listening test; the voice picker shows 4 recommended voices and the rest under More voices. The demo video was re-recorded on 3 Nov 2026 on the current build.
