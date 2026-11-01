# Submission Pack: Stay (AssemblyAI Voice Hackathon)

All metrics and claims in this pack link to reproducible outputs under `docs/evidence/` and `docs/audit/`.

## Links

- **Live App:** https://stay-two-swart.vercel.app/app/today
- **Repository:** https://github.com/vaibhav4046/stay
- **Primary Submission Doc:** [`HACKATHON_SUBMISSION.md`](../HACKATHON_SUBMISSION.md)

## One-Sentence Summary

Stay is a calm, voice-first companion for adults with ADHD that turns overwhelming tasks into one two-minute starting step and prepares one-page doctor/therapist visit handouts in your own words.

## AssemblyAI Integration Summary

- **Universal-3.6 Pro Streaming STT (`wss://streaming.assemblyai.com/v3/ws`):** 16 kHz mono PCM with 7.2 kHz low-pass anti-aliasing filter, `min_turn_silence=128`, `max_turn_silence=1280`, `vad_threshold=0.2`, `language_detection=true`, `keyterms_prompt` from user's "My words", and dynamic `UpdateConfiguration.agent_context` after each reply.
- **AssemblyAI-TTS-1 Streaming TTS (`wss://tts.us.assemblyai.com/v1/ws`):** Product-scoped ephemeral tokens (`product=tts`), verified `voice_id=` parameters across 13 regional voices in 6 languages, 30 s `KeepAlive`, `WordBoundaries` caption sync, and `Cancel`/`Cancelled` barge-in.
- **AssemblyAI LLM Gateway (`/api/voice/translate`):** Parallel real-time turn translation without blocking reply generation.

## Evidence Files

- `docs/evidence/phase0-tsc.txt` — TypeScript check
- `docs/evidence/phase0-vitest.txt` — Unit, contract, and DSP test run
- `docs/evidence/phase0-build.txt` — Production Next.js build
- `docs/evidence/phase0-playwright.txt` — Playwright E2E suite
- `docs/evidence/phase0-browser-audit.json` — Multi-viewport contrast & layout audit
- `docs/evidence/unit/dsp-worklet-bench.json` — AudioWorklet jitter & cancel benchmark
- `docs/evidence/unit/safety-command-checks.json` — Deterministic crisis, medication, and SSRF checks
