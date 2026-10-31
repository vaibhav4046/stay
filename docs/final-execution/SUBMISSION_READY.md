# Stay — Hackathon Submission Readiness (`SUBMISSION_READY.md`)

**Project Name:** Stay  
**Tagline:** A calm, voice-first executive-function and task-initiation companion for adults with ADHD.  
**Live Deployment:** [https://stay-two-swart.vercel.app](https://stay-two-swart.vercel.app)  
**GitHub Repository:** [https://github.com/vaibhav4046/stay](https://github.com/vaibhav4046/stay)

---

## 1. Submission Checklist

- [x] **Real-Time AssemblyAI Voice Integration:**
  - Dual-engine architecture: `FastSocket` (`wss://streaming.assemblyai.com/v3/ws` `universal-3-6-pro` + `/api/voice/chat` + `wss://tts.us.assemblyai.com/v1/ws`) and Managed Voice Agent (`wss://agents.assemblyai.com/v1/ws`).
  - Speculative turn preparation on complete partials, greetings, and `Turn.utterance` (~1.4s p50 reply latency).
  - Full-duplex overlap classification: ignores backchannels (`"yeah"`, `"mm-hmm"`, `"got it"`) while honoring 1-word interruptions (`"stop"`, `"wait"`) in <100ms.
  - ADHD pause tolerance (`soundsUnfinished()` 2.2s hold window) + configurable `ENDPOINTING_PRESETS` (`coaching`, `reflective`, `crisis`).
- [x] **Gapless WebAudio Playback & Synchronized Live Captions:**
  - `ContinuousPcmPlayer` + `stay-pcm-playback-processor.js` AudioWorklet ring buffer (`24kHz -> 44.1kHz/48kHz` stateful resampling, odd-byte carry, 180ms prebuffer, 64-sample cosine fade).
  - `computeProgressiveCaption()` locked to actual audio playback duration and monotonic multi-flush `WordBoundaries`.
- [x] **Complete ADHD Task-Initiation Loop:**
  - 60–120 second micro-step decomposition, monotonic focus timer (`+5 min`, `Too big? Make it smaller`), shame-free outcome logging (`Started`, `Partly started`, `Didn't start`, `Paused`), Brain Dump capture, Parking Lot, Today list, and Clinician Summary export.
- [x] **Deterministic Clinical Safety Boundaries:**
  - Pre-LLM UK Crisis Help Panel (`999`, `NHS 111`, `Samaritans 116 123`, `Shout 85258`) and fixed medication boundary referral.
- [x] **Complete Verification Package (`docs/final-execution/`):**
  - `STATUS.json`, `BASELINE.md`, `VOICE_PROTOCOL_AUDIT.md`, `AUDIO_BENCHMARK.md`, `CAPTION_SYNC_AUDIT.md`, `BROWSER_QA.md`, `SECURITY_AUDIT.md`, `JUDGE_EVALUATION.md`, `RELEASE_REPORT.md`, `SUBMISSION_READY.md`.
