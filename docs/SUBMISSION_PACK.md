# AssemblyAI Hackathon #2 — Submission Pack (`docs/SUBMISSION_PACK.md`)

## 1. Project Overview

- **Project Name:** Stay
- **Tagline:** Make starting easier. A voice-first task-initiation and treatment-adherence companion for adults with ADHD.
- **Hackathon:** AssemblyAI Online Hackathon #2 (15–23 October 2026)
- **Primary Category:** Voice Agents / Text-to-Speech / Healthcare & Productivity Support
- **Submission Form:** [https://forms.gle/NtYDsi3bgqMDK29j9](https://forms.gle/NtYDsi3bgqMDK29j9)
- **AssemblyAI Showcase:** [https://www.assemblyai.com/contact/showcase](https://www.assemblyai.com/contact/showcase)

---

## 2. Core Proposition & Differentiation

Adults with ADHD do not avoid tasks out of laziness or lack of desire; they encounter severe friction at the **initiation threshold** due to working-memory saturation and executive-function paralysis.

Most AI productivity tools either talk passively (chatbots that wait for prompts) or schedule infinitely without addressing initiation (to-do lists that generate guilt). Stay bridges this gap:
1. **Voice-First Body Doubling:** The user speaks what they are avoiding; Stay identifies the specific barrier (`overwhelm`, `unclear_next_step`, `perfectionism_or_fear`, `boredom_or_distraction`, `low_energy`), applies an evidence-informed strategy (`task_shrinking`, `implementation_intention`, `reframing`, `timeboxing`), and shrinks the entry action to under two minutes.
2. **Proactive Timer-End Check-In:** Using AssemblyAI's `reply.create` event, Stay speaks first when the timer ends, mirroring the proven support of a human body double.
3. **Transparent Personal Pattern Learning:** Computes observational start rates with explicit sample sizes and denominators (e.g. *3 of 3 started*), rather than gamified streaks.
4. **Clinician Bridge:** Generates a one-page, patient-curated appointment PDF summary (`jsPDF`) for short GP visits and specialist appointments.
5. **Rigorous Safety Boundaries:** Pre-LLM deterministic crisis interception routing to UK emergency services (`999`, `NHS 111`, `Samaritans 116 123`), strict refusal of medication/dosing advice, and one-click data deletion.

---

## 3. How AssemblyAI Voice Agent API is Used

- **WebSocket Endpoint:** `wss://agents.assemblyai.com/v1/ws?token=<ephemeral_token>`
- **Token Minting:** `GET https://agents.assemblyai.com/v1/token?expires_in_seconds=180` (server route `/api/voice/token` ensures API keys never touch the browser).
- **Stored Voice Agent:** `agent_c70c56210f7c41548f7785d33dc6c8ab` with British voice `anna` (`24000` Hz PCM16).
- **Custom LLM Integration:** Connected with Groq `openai/gpt-oss-120b` for ultra-low-latency voice turns.
- **Client-Side Function Tools:**
  - `propose_coaching_plan`: Updates the UI with shrunk first step, barrier, and strategy.
  - `start_focus_timer`: Starts application-owned focus timer.
  - `record_session_outcome`: Logs focus outcome (`started`, `partly_started`, `not_started`, `paused_or_stopped`).
- **Audio Worklet Pipeline:** Custom `AudioWorkletProcessor` (`pcm-processor.js`) captures mic audio at native rates, downsamples cleanly to 24kHz mono PCM16, and computes RMS audio energy for the 3D **Stay Signal** instrument.

---

## 4. Verification & Testing Evidence

- **Unit Tests:** 24/24 passing (`vitest run --run`), including direct NextRequest integration tests verifying crisis and medication isolation.
- **TypeScript:** Strict typecheck passing with zero errors (`tsc --noEmit`).
- **Production Build:** Passes cleanly with optimized static/dynamic routes (`npm run build`).
- **Playwright E2E:** 5/5 passing against live production (`https://stay-two-swart.vercel.app`):
  1. Landing page renders proposition, interactive 45s walkthrough, and prominent safety disclaimers.
  2. Crisis panel displays fixed UK emergency services (999, 111, 116 123, 85258).
  3. Demo page full closed loop: task capture -> barrier -> plan -> focus timer -> outcome logging -> treatment check-in -> 1-page clinician PDF preview.
  4. App onboarding gate, workspace, history, settings, and one-click data erasure.
  5. Privacy and Terms routes load cleanly.

---

## 5. Live Links & Repository

- **Live Production Application:** [https://stay-two-swart.vercel.app](https://stay-two-swart.vercel.app)
- **Direct Vercel Deployment:** [https://stay-r12ppmhvp-vaibhav4046s-projects.vercel.app](https://stay-r12ppmhvp-vaibhav4046s-projects.vercel.app)
- **Interactive No-Login Demo:** [https://stay-two-swart.vercel.app/demo](https://stay-two-swart.vercel.app/demo)
- **GitHub Repository:** [https://github.com/vaibhav4046/stay](https://github.com/vaibhav4046/stay)

---

## 6. Hackathon Submission Form Fields Ready-to-Copy

- **Project Title:** Stay — Voice-First ADHD Task-Initiation & Adherence Companion
- **Demo URL:** [https://stay-two-swart.vercel.app/demo](https://stay-two-swart.vercel.app/demo)
- **GitHub URL:** [https://github.com/vaibhav4046/stay](https://github.com/vaibhav4046/stay)
- **Description:** A voice-first ADHD support companion built with AssemblyAI Voice Agent API and Groq. Helps adults with ADHD turn avoidance paralysis into concrete sub-2-minute entry steps, speaks first at timer completion, logs personal strategy efficacy with honest denominators (no gamification), and exports a 1-page clinician appointment PDF. Features a 45-second interactive product walkthrough on the landing page, ChatGPT/Perplexity-style unified voice-and-text conversation, and deterministic safety gates that route crises directly to NHS emergency services and enforce clinical boundaries against medication advice.
- **AssemblyAI Features Used:** AssemblyAI Voice Agent API (`wss://agents.assemblyai.com/v1/ws`), Stored Voice Agent `agent_c70c56210f7c41548f7785d33dc6c8ab` with British voice `anna` (24kHz mono PCM16), Groq custom LLM (`openai/gpt-oss-120b`), client-side function tools (`propose_coaching_plan`, `start_focus_timer`, `record_session_outcome`), proactive agent check-ins (`reply.create`), real-time barge-in interruption, and custom AudioWorklet PCM16 streaming.


