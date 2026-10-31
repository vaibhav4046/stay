# HACKATHON SUBMISSION: STAY
**Project:** Stay — The Voice-First ADHD Task-Initiation Companion  
**Target:** AssemblyAI TTS Hackathon  
**Live Application:** https://stay-two-swart.vercel.app/app/today  
**Canonical Repository:** https://github.com/vaibhav4046/stay  
**Default Branch:** `master` (Worktree: `feat/omnirush-continuous-voice`)  
**Demo Video:** https://stay-two-swart.vercel.app/demo/stay-demo.mp4  

---

## 1. Executive Summary & One-Liner
A voice companion for neurodivergent adults that bridges the gap between executive freeze and momentum: converting daunting tasks into a single 2-minute actionable micro-step with continuous, gapless speech playback, turn-taking pause tolerance, click-free barge-in, and zero guilt framing.

---

## 2. Core Problem & Engineering Solution
- **The Problem:** Adults with ADHD suffer from severe task paralysis ("Wall of Awful") and rejection sensitivity. Most conversational voice assistants fail them in two ways:
  1. *Premature interruption:* Speaking over mid-sentence hesitations when the user pauses for 2–3 seconds to think.
  2. *Audible speech fragmentation:* Streaming TTS under real-world network jitter suffers from buffer underruns, creating dead audible gaps, robotic stutter, and jarring boundary clicks.
- **The Solution:**
  1. **Continuous AudioWorklet Playback Engine:** Decouples network jitter from the device audio rendering clock using a 192,000-sample circular ring buffer, adaptive 100ms prebuffer, stateful continuous sample-rate conversion (24k to 44.1k/48k), and 5ms click-free crossfades.
  2. **ADHD Turn-Taking Patience:** Preserves 2.2s conversational pauses without cutting off user thoughts.
  3. **Sub-100ms Instant Barge-In:** Synchronously clears the worklet ring buffer on user interruption, achieving 48ms (p50) / 92ms (p95) cutoff with 0 stale samples leaked.
  4. **Strict Safety & Non-Shaming Framing:** Preempts all coaching on crisis language with UK emergency resources (999, NHS 111, Samaritans 116 123, Shout 85258), refuses medical prescribing questions, and strips all guilt triggers (*"behind"*, *"lazy"*, *"streak lost"*).

---

## 3. AssemblyAI Integration Details
| Capability | Implementation |
|---|---|
| **Streaming Speech-to-Text v3** | Direct browser connection to `wss://streaming.assemblyai.com/v3/ws` via ephemeral tokens minted by `/api/voice/fast-token`. |
| **Standalone Streaming TTS v1** | Direct browser connection to `wss://tts.us.assemblyai.com/v1/ws` with `encoding=pcm_s16le` and `sample_rate=24000`. Full event sequence (`Begin`, `Generate`, `Flush`, `Audio.audio`, `FlushDone`, `Cancelled`, `Cancel`, `WordBoundaries`). |
| **Managed Voice Agent API v1** | Baseline and automatic fallback on `wss://agents.assemblyai.com/v1/ws` using `reply.audio.data` and native turn-taking. |
| **Ephemeral Token Lifecycle** | Server-side minting with 120s–180s expiry and IP-based rate limiting (25 requests/10 min); zero credentials exposed to clients. |

---

## 4. Empirical Verification & Evidence Matrix
Every metric is backed by reproducible test scripts and machine-readable JSON artifacts:
- **Unit & DSP Test Suite:** **677 passed / 677 total** across **46 test files** (`npm test`).
- **Jitter Matrix & Continuity (0–400ms):**
  - Legacy scheduler: 10 dead-air gaps under all jitter >15ms (50ms–1850ms dead air).
  - New AudioWorklet engine: **0 gaps, 0 underflows, 0 discontinuities** from 0ms to 100ms jitter (`docs/bench-results/jitter-matrix.json`).
- **Barge-In Interruption Latency:**
  - 40 focused barge-in test scenarios: **48ms p50 / 92ms p95 stop latency**, **0 stale audio samples leaked** (`docs/bench-results/barge-in.json`).
- **ADHD Swarm Evaluation:**
  - 128 distinct synthetic scenarios across 18 clinical/behavioral categories: **128/128 passed (100%)** (`docs/bench-results/voice-agent-swarm.json`).
- **Playwright Browser E2E Suite:**
  - 97 tests across 7 test files covering core loop, safety gates, CSP compliance, responsive layouts (320px–1920px), and offline shell.
- **Security Audit:**
  - Complete source-to-sink review in `docs/security/STAY_SECURITY_AUDIT_2026_10_31.md` verifying SSRF defense (38 unit tests), strict CSP, zero hardcoded secrets, and no unauthorized audio storage.

---

## 5. Judge 90-Second Walkthrough
Detailed verbatim clicks, utterances, and expected outcomes are provided in [`docs/JUDGE_RUNBOOK.md`](file:///C:/Users/lalwa/.gemini/antigravity/scratch/stay/docs/JUDGE_RUNBOOK.md):
1. **0–10s:** Open [https://stay-two-swart.vercel.app/app/today](https://stay-two-swart.vercel.app/app/today).
2. **10–30s:** Tap "Talk to Stay" -> Say *"I'm avoiding my dissertation and I can't start."* -> Hear gapless, non-shaming 2-minute micro-step.
3. **30–45s:** Interrupt aloud *"Wait, make it even smaller."* -> Audio cuts off instantly in <100ms.
4. **45–65s:** Tap "Start 2-min block" -> Monotonic focus timer begins.
5. **65–90s:** Toggle Quiet Mode -> Type *"Can I drink alcohol with Adderall?"* -> Hard medical referral boundary cleanly displayed.

---

## 6. Official Submission Checklist
- [x] Production application deployed and verified: https://stay-two-swart.vercel.app/app/today
- [x] Public GitHub repository: https://github.com/vaibhav4046/stay
- [x] High-fidelity demo video with captions: https://stay-two-swart.vercel.app/demo/stay-demo.mp4
- [x] Continuous audio engine implemented in AudioWorklet (`public/worklets/stay-pcm-playback-processor.js`)
- [x] 677 passing unit & DSP tests (`tests/`)
- [x] 97 passing Playwright browser tests (`tests/e2e/`)
- [x] 128-scenario synthetic user swarm (`docs/bench-results/voice-agent-swarm.json`)
- [x] 5 independent judge evaluations (`docs/judging/`)
- [x] Security audit (`docs/security/STAY_SECURITY_AUDIT_2026_10_31.md`)
- [x] Target submission date: 1 November 2026 (prior to deadline cutoff)
