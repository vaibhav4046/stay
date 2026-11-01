# Stay

Start the thing you've been avoiding, or prepare for your next appointment without blanking out. Stay is a calm, voice-first companion for adults with ADHD: speak a messy thought, get one concrete two-minute first step, run a visible focus block, or build a one-page appointment handout in your own words.

Built on **AssemblyAI Universal-3.6 Pro Streaming STT**, **AssemblyAI-TTS-1 Streaming TTS**, and **AssemblyAI LLM Gateway** for AssemblyAI's *"Voice hackathon week: Hack into speech"*.

- **Live:** https://stay-two-swart.vercel.app/app/today
- **Submission & Evidence Index:** [`HACKATHON_SUBMISSION.md`](HACKATHON_SUBMISSION.md)
- **Audit & Sources:** [`docs/audit/AUDIT.md`](docs/audit/AUDIT.md) · [`docs/audit/SOURCES.md`](docs/audit/SOURCES.md) · [`docs/audit/EXECUTION.md`](docs/audit/EXECUTION.md)

## What It Does

1. **Talk, call, or type.** Talk by voice, press Call Stay for a phone-style call in the browser (it rings, then connects; Stay checks in at most twice if you go quiet; 10 minutes at most), or use Quiet mode (type only) from the menu. Typing never silently turns on the microphone, and the first microphone click shows an in-app consent sheet before `getUserMedia` is called.
2. **Real AssemblyAI Voice Pipeline (`FastSocket`).**
   - **STT:** Browser-direct 16 kHz mono PCM (`public/pcm-processor.js` with a 7.2 kHz Butterworth low-pass anti-aliasing filter) streamed to `wss://streaming.assemblyai.com/v3/ws` (`speech_model=universal-3-6-pro`, `min_turn_silence=128`, `max_turn_silence=1280`, `vad_threshold=0.2`, `language_detection=true`, `keyterms_prompt`, and post-turn `UpdateConfiguration.agent_context`).
   - **TTS:** Browser-direct streaming synthesis over `wss://tts.us.assemblyai.com/v1/ws` using product-scoped tokens (`GET https://token.us.assemblyai.com/v1/token?product=tts`) and verified `voice_id=` identifiers across 13 regional accents and 6 languages, with 30 s `KeepAlive` heartbeats and `WordBoundaries.word` caption synchronization.
   - **No silent fallbacks:** A persistent top-bar transport badge shows `AssemblyAI voice`, `Backup voice — <reason>`, `Device voice (<lang>)`, or `Text only`, with a click-to-open Diagnostics sheet.
3. **Two-Stage Barge-In & AudioWorklet Playback.**
   - `SpeechStarted` after a 250 ms echo guard ducks playback; the first non-backchannel partial or stop word (`"stop"`, `"wait"`, `"pause"`, `"hold on"`, `"actually"`) sends `Cancel`, flushes the AudioWorklet ring buffer, and splits `heardText` vs `unheardText` using rendered sample counts (`docs/voice/VOICE_PROOF.md`).
4. **Deterministic Wispr-Style Voice Corrections & "My Words".**
   - Say `"scratch that"`, `"actually, change that to..."`, `"repeat the last thing"`, or `"show me what you heard"` to edit turns in place with an Undo toast, without creating duplicate bubbles. Add custom vocabulary in Settings → My Words (`keyterms_prompt`).
5. **"Prepare for a Visit" (Doctor / Therapist / Coach).**
   - A 7-question voice or text interview that organizes your top 3 questions, recent dated examples, what helped or didn't, and medications *verbatim as you described them* into a one-page PDF handout with a personal-notes disclaimer.

## Safety and Privacy

- **Crisis wording stops coaching immediately.** A deterministic detector (`src/lib/safety/crisis.ts`) runs before any LLM call across 30+ languages, halts TTS, and displays regional emergency numbers (`999`/`111` UK, `988` US/Canada, `112` EU, `9152987821` India).
- **No medical or medication advice.** Questions about dosing, mixing, side effects, or diagnosis receive a fixed refusal referring to a prescriber or pharmacist. Ordinary medication-list entry during appointment prep is recorded verbatim without advice.
- **Local-first storage & in-memory BYOK.** Conversation history and check-ins stay in your browser (export or delete in one tap). Optional BYOK keys default to in-memory session storage.

## Run Locally

```bash
npm ci
cp .env.example .env.local   # Add ASSEMBLYAI_API_KEY and GROQ_API_KEY
npm run dev
```

## Verification Commands & Evidence

```bash
npx tsc --noEmit                           # Typecheck (docs/evidence/phase0-tsc.txt)
npx vitest run                             # Unit, contract & DSP tests (docs/evidence/phase0-vitest.txt)
npm run build                              # Production build (docs/evidence/phase0-build.txt)
npx playwright test                        # Browser E2E tests (docs/evidence/phase0-playwright.txt)
npx tsx scripts/voice-lab/benchmark-after.ts  # AudioWorklet DSP benchmark (docs/evidence/unit/dsp-worklet-bench.json)
node scripts/check-claims.mjs              # Honesty & gitSha evidence verifier
```

## Honest Limits

- **Simulated vs. real microphone:** Automated browser and DSP tests use injected PCM/WAV fixtures (`docs/evidence/unit/dsp-worklet-bench.json` and `docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md`), not a human speaking into a physical room microphone.
- **TTS language coverage:** AssemblyAI TTS supports English, Spanish, French, German, Italian, and Portuguese. Other spoken output languages (including Hindi) use the browser's device voice and display an explicit `Device voice` badge.
- **Clinical evidence:** Breaking tasks into small steps and using external timers is informed by adult ADHD skills trials (Safren et al., 2010, *JAMA*, $n=86$; Solanto et al., 2010, *Am J Psychiatry*, $n=88$) and implementation-intention research (Gollwitzer & Sheeran, 2006, $d=0.65$). Stay itself has not been clinically trialled and is not therapy or CBT.

## License

MIT
