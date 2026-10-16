# Build Audit (`docs/BUILD_AUDIT.md`)

**Date:** 16 October 2026  
**Project:** Stay — Voice-first task-initiation and treatment-adherence companion for adults with ADHD  
**Target Hackathon:** AssemblyAI Online Hackathon #2 (15–23 October 2026)

---

## 1. Local Environment & Tooling Inventory

| Component | Detected State | Notes |
|---|---|---|
| OS / Shell | Windows / PowerShell | Active build environment |
| Node.js | `v24.12.0` | Supports native `fetch`, `WebSocket`, ESM |
| npm | `11.6.2` | Dependency installation & scripts |
| Git | `2.49.0.windows.1` | Initialized in `C:\Users\lalwa\.gemini\antigravity\scratch\stay` |
| GitHub CLI (`gh`) | `2.76.2` | Installed; available for repository creation/push |
| Pre-existing codebase | None (greenfield build) | Created cleanly at `C:\Users\lalwa\.gemini\antigravity\scratch\stay` |

---

## 2. Live API & Protocol Verification

### 2.1 AssemblyAI Voice Agent API (`https://agents.assemblyai.com`)
- **Documentation Verified Against Official Live Docs (Oct 2026):**
  - Overview: `https://www.assemblyai.com/docs/voice-agent-api.md`
  - Browser Integration: `https://www.assemblyai.com/docs/voice-agent-api/browser-integration.md`
  - Connect Your Own LLM: `https://www.assemblyai.com/docs/voice-agent-api/connect-your-own-llm.md`
  - Client-Side Tools: `https://www.assemblyai.com/docs/voice-agent-api/tools/client-side-tools.md`
  - Events Reference: `https://www.assemblyai.com/docs/voice-agent-api/events-reference.md`
  - Manage Agents: `https://www.assemblyai.com/docs/voice-agent-api/manage-agents.md`
- **Token Endpoint (`GET https://agents.assemblyai.com/v1/token`):**
  - Verified live HTTP `200` response.
  - Mints single-use ephemeral session tokens (`expires_in_seconds=180`, `max_session_duration_seconds=600`).
  - Raw `ASSEMBLYAI_API_KEY` stays strictly on the server (`/api/voice/token`).
- **Stored Agent Endpoint (`POST / PUT https://agents.assemblyai.com/v1/agents`):**
  - Verified live creation (`201`) and update (`200`) of stored agent `agent_c70c56210f7c41548f7785d33dc6c8ab` (`stay-adhd-companion-v1`).
  - Voice configured: `anna` (British English female voice, `24000` Hz `audio/pcm`).
  - Client-side function tools configured on agent:
    - `propose_coaching_plan`
    - `start_focus_timer`
    - `record_session_outcome`
- **WebSocket Endpoint (`wss://agents.assemblyai.com/v1/ws?token=<ephemeral_token>`):**
  - Note: The hackathon announcement text mentioned `wss://streaming-tts.assemblyai.com/v1/ws`, while official AssemblyAI documentation specifies `wss://agents.assemblyai.com/v1/ws` as the unified Voice Agent WebSocket endpoint (combining STT, LLM orchestration, and streaming TTS output).
  - Verified live handshake:
    1. Connect to `wss://agents.assemblyai.com/v1/ws?token=<token>`
    2. Send `{"type": "session.update", "session": {"agent_id": "agent_c70c56210f7c41548f7785d33dc6c8ab"}}`
    3. Receive `session.ready`
    4. Receive `reply.started`, 24kHz PCM16 base64 `reply.audio` chunks, `transcript.agent.delta` / `transcript.agent`, and `reply.done`
    5. Send `{"type": "session.end"}` before closing socket to avoid the 30-second resume window.

### 2.2 Groq OpenAI-Compatible API (`https://api.groq.com/openai/v1`)
- **Live Model Discovery (`GET /openai/v1/models`):**
  - Verified HTTP `200`.
  - Active chat models on this account: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`.
  - Configured primary model: `openai/gpt-oss-120b` with fallback to `openai/gpt-oss-20b` and AssemblyAI LLM Gateway `qwen3.5-4b-32k-fast`.
  - Stored encrypted inside AssemblyAI agent `agent_c70c56210f7c41548f7785d33dc6c8ab` for real-time voice turns and used directly in server route `/api/coach/plan` for structured text/fallback coaching plans.

---

## 3. Architecture & Persistence Strategy

- **Dual Persistence Layer:**
  - Full Supabase PostgreSQL schema and Row Level Security (`supabase/migrations/001_stay_schema.sql`) plus Supabase client/server integration (`src/lib/supabase/`).
  - Local persistent store (`localStorage` + structured repository adapter in `src/lib/storage/`) so that `/app/*` routes and `/demo` work immediately out of the box with zero external database setup required for hackathon judges, while syncing with Supabase whenever `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured.
  - Synthetic demo data in `/demo` is explicitly labeled `"Sample data · Demo mode"` and strictly isolated from user-created records.

---

## 4. Judge-Ready Upgrade Verification Audit (16 October 2026)

### 4.1 Safety Architecture Verification
- **Crisis Gate Decoupling:** In `/api/coach/plan/route.ts`, crisis detection short-circuits immediately before Groq/LLM calls, returning `timerMinutes: 0`, `safetyFlag: 'crisis'`, and fixed UK emergency services (999, 111, 116 123, 85258).
- **Medication Gate Isolation:** Dosing or prescription queries return `timerMinutes: 0`, `safetyFlag: 'medical_boundary'`, and a clinician referral. No task sprints or focus timers are generated.
- **Voice Agent Suppression:** In `useVoiceAgent.ts`, `medicationSuppressionRef` immediately suppresses model audio chunks (`reply.audio`) and model turns (`transcript.agent`) upon detecting medication queries, preventing hallucinated dosing advice.
- **Unit Integration Tests:** `tests/unit/coachRoute.test.ts` (4 direct NextRequest integration tests) + `tests/unit/core.test.ts` (20 tests) = **24/24 passing**.

### 4.2 Frontend & UX Verification
- **Landing Page Hero:** Replaced passive mock animations with `HeroInteractiveWalkthrough.tsx` (5 interactive steps: avoidance -> barrier -> shrink -> timer -> outcome) labeled `"Guided preview · example data · No mic required"`.
- **Demo Mode Tour:** Upgraded `/demo` with a 45-second judge tour bar, tab jump buttons, sample data isolation labels, and 1-click state reset (`↻ Reset demo state`).
- **ChatGPT/Perplexity Voice UX:** Integrated continuous text composer alongside voice, action receipts (`Timer started · X min`), keyboard shortcut `/`, quick starter task pills, demo fast-forward, and "I'm stuck" 60-second de-escalation breath.

### 4.3 Deployment & E2E Test Run
- **Production URL:** `https://stay-two-swart.vercel.app`
- **Vercel Deployment ID:** `dpl_9Kp2mVvR9TxtdzTsSrX13eyEYR5F`
- **Playwright Test Suite:** 5/5 passing against live production in 9.7s (`tests/e2e/stay.spec.ts`):
  1. `Landing page renders correctly with core proposition and links`: PASSED (2.5s)
  2. `Crisis panel opens and displays fixed UK emergency services`: PASSED (556ms)
  3. `Demo page: full closed loop`: PASSED (2.7s)
  4. `App: Onboarding gate, workspace, history, settings, and data erasure`: PASSED (1.5s)
  5. `Privacy and Terms routes load without error`: PASSED (1.1s)

