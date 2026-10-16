# Stay — Make starting easier

A voice-first task-initiation and treatment-adherence companion for adults with ADHD, built with the **AssemblyAI Voice Agent API** for the AssemblyAI Online Hackathon #2 (October 2026).

**Live App**: [https://stay-two-swart.vercel.app](https://stay-two-swart.vercel.app)  
**Interactive Demo**: [https://stay-two-swart.vercel.app/demo](https://stay-two-swart.vercel.app/demo)  
**GitHub Repository**: [https://github.com/vaibhav4046/stay](https://github.com/vaibhav4046/stay)

---

## The Problem

Adults with ADHD do not avoid tasks because they lack motivation. When working memory is saturated, the brain cannot locate a manageable first physical move, creating executive-function paralysis.

Existing tools either wait passively for prompts or pile up to-do lists that generate guilt. Stay provides real-time body doubling:
1. Speak what you're avoiding (or type quietly).
2. Stay identifies the specific friction barrier and shrinks the entry action to under two minutes.
3. Start a short focus block (5, 10, or 15 minutes).
4. Stay speaks first when the timer ends to ask how it went.
5. Learn what strategies help you start, with real counts and denominators.
6. Export a clear one-page PDF summary for your clinician.

---

## Clinical & Safety Boundaries

- **Not a medical device:** Stay does not diagnose ADHD or any other condition, and does not provide psychiatric or medical care.
- **Medication guardrail:** Stay never recommends, adjusts, starts, stops, or compares medications or doses. Any question regarding prescription drugs is redirected to the user's prescribing clinician or pharmacist.
- **Fixed crisis support:** Pre-LLM deterministic pattern detection immediately halts coaching and displays UK crisis resources (`999`, `NHS 111`, `Samaritans 116 123`, `Shout 85258`).
- **Data privacy:** Audio is streamed ephemerally to AssemblyAI and never stored as recordings. All user data can be exported as JSON or permanently erased in one click from Settings.

---

## Architecture & Technology

- **Frontend & App Router:** Next.js 15, React 19, TypeScript, Tailwind CSS v4.
- **Voice Agent Pipeline:** AssemblyAI Voice Agent API (`wss://agents.assemblyai.com/v1/ws`) with single-use ephemeral token minting (`/api/voice/token`).
- **Speech & Audio Engine:** British voice `anna` (24,000 Hz mono PCM16) with custom `AudioWorkletProcessor` (`public/pcm-processor.js`) for capture, resampling, and RMS energy metering.
- **Visual Instrument ("Stay Signal"):** Original 3D WebGL Torus/Ring harmonic assembly in Three.js with full semantic state tracking, audio-reactive energy, `prefers-reduced-motion` support, and non-WebGL SVG fallback.
- **LLM Orchestration:** Groq `openai/gpt-oss-120b` (custom LLM on AssemblyAI agent + structured server fallback on `/api/coach/plan`).
- **Persistence:** Local-first browser storage (`localStorage`) + optional Supabase PostgreSQL schema with strict Row-Level Security (`auth.uid() = user_id`).
- **Reporting:** Client-side 1-page clinician appointment PDF generator using `jsPDF`.
- **Testing:** Vitest unit tests (24/24 passing) + Playwright browser E2E tests (5/5 passing against live production).

---

## Getting Started

### 1. Clone & Install
```bash
git clone https://github.com/vaibhav4046/stay.git
cd stay
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and add your keys:
```bash
cp .env.example .env.local
```

Required keys:
- `ASSEMBLYAI_API_KEY`: Your AssemblyAI API key.
- `GROQ_API_KEY`: Your Groq API key.
- `ASSEMBLYAI_AGENT_ID`: `agent_c70c56210f7c41548f7785d33dc6c8ab` (or run `npm run agent:sync` to provision a new agent).

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Verification Suites
```bash
# Unit tests
npm test

# Type-check
npm run lint

# Production build
npm run build
```

---

## Project Routes

- `/`: Landing page introducing the proposition, 4-step flow, and clinical boundaries.
- `/demo`: Full interactive demonstration mode with live voice + synthetic 7-day history (clearly labeled as sample data).
- `/app/today`: Live coaching workspace and personal strategy pattern summary.
- `/app/history`: Timeline of logged task sessions, barriers, and strategies.
- `/app/treatment`: 30-second daily treatment and focus log.
- `/app/reports`: Appointment summary preview and one-page PDF export.
- `/app/settings`: Preferences, care context, JSON export, and one-click data deletion.
- `/privacy`: Plain-language data privacy disclosure.
- `/terms`: Terms of use, evidence framing, and safety boundaries.

---

## License

MIT
