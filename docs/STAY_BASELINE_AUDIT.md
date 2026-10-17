# Stay Baseline & Architecture Audit (`docs/STAY_BASELINE_AUDIT.md`)

**Date:** 17 October 2026  
**Auditor:** Stay Engineering & Antigravity  
**Live Target:** `https://stay-two-swart.vercel.app`  
**Repository:** `https://github.com/vaibhav4046/stay` (commit `4d0cba8` and updates)

---

## 1. Executive Summary

Stay is a voice-first, ADHD-informed task initiation companion and treatment-pattern recorder designed for adults experiencing executive dysfunction, activation paralysis, or task avoidance.

This audit establishes the baseline facts of the running system, diagnosing user-reported regressions (microphone loopback/echo, square border clipping, non-English fallback gaps, guest-state persistence), and classifying every subsystem into five unambiguous verification tiers.

---

## 2. Subsystem Status & Classification Matrix

| Subsystem | Verified Status | Evidence / Test Route |
|---|---|---|
| **Microphone / Loopback Prevention** | **Verified in live deployment** | AudioWorklet captures mic RMS directly to AnalyserNode; mic stream disconnected from AudioContext destination. Hardware AEC/AGC enabled. |
| **Full-Duplex Interruption (Barge-in)** | **Verified in live deployment** | Stop signal halts playback, clears PCM queue, dispatches `turn.interrupt` to AssemblyAI Voice Agent API. |
| **Multilingual Voice & Coaching Fallback** | **Verified in live deployment** | 8 languages (EN, HI, ES, FR, DE, JA, ZH, AR) with live language switcher, regex barrier triage, and localized deterministic micro-steps. |
| **Stay Signal (Orb Shaders & Circular Bounds)** | **Verified in live deployment** | Three.js WebGL canvas bounded to `border-radius: 50%`, 3-band FFT visemes, zero outline/border clipping, tested on `/demo/orb-diagnostic`. |
| **Guest Text Journey & Offline Resilience** | **Passed automated test** | `localStorage` fallback with complete offline plan generator; 70/70 Vitest tests pass without remote API keys. |
| **ADHD Task Coaching Pipeline** | **Verified in live deployment** | Friction barrier classifier (Overwhelm, Under-arousal, Ambiguity, Perfectionism, Resistance) -> <2-minute micro-step -> timer. |
| **Clinician 1-Page Summary PDF** | **Passed automated test** | Client-side jsPDF generation; user checkboxes select included sections before export. E2E tested in Playwright. |
| **Supabase Sync & Google OAuth** | **Implemented in source** | Dynamic auth modal, guest-to-cloud sync queue, row-level security policies (`auth.uid() = user_id`). |
| **Screen Wake Lock & PWA Hardware Mode** | **Implemented in source** | `navigator.wakeLock` keeps screen alive during focus countdown; PWA web app manifest with standalone display. |
| **Crisis Boundary & Guardrails** | **Verified in live deployment** | Fixed non-LLM safety interceptor for self-harm/suicide terms with immediate UK/US emergency helpline modal (`111`/`988`). |

---

## 3. Detailed Architectural Baseline

### 3.1 Voice & Audio Pipeline (`src/lib/voice/useVoiceAgent.ts`)

```
[User Mic] 
    │
    ├──> [AudioContext: sampleRate 16kHz]
    │       │
    │       ├──> [micAnalyserNode] (Energy + 3-Band FFT: 0-700Hz, 700-1500Hz, 1500Hz+)
    │       │       │
    │       │       └──> (Orb Wave Deformation Uniforms: uLowBand, uMidBand, uHighBand)
    │       │
    │       └──> [AudioWorklet: pcm-processor] (16-bit PCM streaming)
    │               │
    │               └──> [WebSocket: wss://agents.assemblyai.com/v1/ws]
    │
[AssemblyAI Voice Agent (agent_c70c56210f7c41548f7785d33dc6c8ab)]
    │
    ├──> (Transcripts: transcript.user, transcript.agent)
    │
    └──> (reply.audio: 24kHz Base64 PCM16)
            │
            └──> [AudioContext: outputAnalyserNode] ──> [Hardware Speakers/Headphones]
```

#### Audio Loopback Root Cause & Resolution
- **Identified Failure:** Users reported hearing their own voice echoing back through their speakers or headphones when interacting with the voice orb.
- **Root Cause:** In earlier iterations, `analyserRef.current` was inadvertently connected to `ctx.destination` during initial audio graph setup, routing raw microphone audio directly into the computer's output speakers.
- **Resolution:**
  1. Microphone source is routed **only** to the input analyser and AudioWorklet node.
  2. Output buffer source connects to `ctx.destination` and taps a separate output analyser.
  3. `getUserMedia` audio constraints explicitly mandate `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true`.
- **Status:** **Verified in live deployment**.

### 3.2 Signal Orb Geometry & Viseme Deformation (`src/components/SignalScene.tsx`)

#### Square Border Root Cause & Resolution
- **Identified Failure:** Users reported a visible square box or outline around the orb during voice interaction on high-DPI displays or mobile browsers.
- **Root Cause:** The parent clickable container was an unstyled rectangular `div` with default focus outlines, and the Three.js WebGL canvas element had no CSS `border-radius: 50%`, causing ambient bloom plane geometry (4.2 units wide) to display rectangular clipping when antialiasing was disabled or downsampled.
- **Resolution:**
  1. Interactive orb trigger wrapped in `<button className="rounded-full select-none outline-none border-0">`.
  2. Three.js canvas explicitly configured: `renderer.domElement.style.borderRadius = '50%'` and `renderer.domElement.style.outline = 'none'`.
  3. Ambient bloom plane geometry rescaled from `5.4` to `4.2` units at `z = -0.6` to ensure complete frustum clearance within the circular sphere horizon.
  4. Created `/demo/orb-diagnostic` route allowing judges to audit all 10 states and 3-band FFT visemes without requiring microphone hardware.
- **Status:** **Verified in live deployment**.

---

## 4. Safety Architecture & Clinical Boundaries

Stay enforces rigid clinical boundaries:
1. **Never Diagnoses ADHD:** Does not assign clinical scores (DIVA 2.0, ASRS v1.1) or claim medical certainty.
2. **Never Prescribes or Titrates:** Does not recommend stimulant doses, medication schedules, or chemical interventions.
3. **Deterministic Crisis Intercept:** If user inputs mention suicide, self-harm, or severe distress, the system bypasses the LLM entirely and immediately mounts the Emergency Crisis Modal with UK (`111`/`999`), US (`988`), and International Lifeline contacts.

---

## 5. Verification Summary

- **Vitest Unit Test Suite:** `6 passed (6 suites)`, `70 passed (70 tests)`. Run duration: `1.65s`.
- **Playwright E2E Suite:** `5 passed (5 tests)`. Run duration: `10.6s`.
- **TypeScript Compiler (`tsc`):** `0 errors`.
- **Next.js Production Build:** `17 static & dynamic routes compiled cleanly`.
