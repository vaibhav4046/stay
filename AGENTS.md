# Agent Operating Instructions (`AGENTS.md`)

## 1. Purpose of This Repository

**Stay** is a voice-first task-initiation and treatment-adherence companion for adults with ADHD, built for the AssemblyAI Online Hackathon #2 (October 2026).

## 2. Hard Rules for Any Agent Editing This Repo

1. **Secret Hygiene:**
   - Never expose `ASSEMBLYAI_API_KEY`, `GROQ_API_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` in client-side code (`src/components/**`, `src/app/**/page.tsx`), git history, or build logs.
   - Browser clients must obtain single-use voice session tokens exclusively from `GET / POST /api/voice/token`.
2. **Voice Agent Protocol Compliance (`wss://agents.assemblyai.com/v1/ws`):**
   - Connect with `?token=<ephemeral_token>`.
   - Send `{"type": "session.update", "session": {"agent_id": "<agentId>"}}` on WebSocket `open`.
   - Wait for `session.ready` before streaming `input.audio` (`24000` Hz mono PCM16 base64).
   - Treat `transcript.user.delta` as the full partial utterance so far (replace, do not append).
   - Send `tool.result` after `reply.done` (unless `status === "interrupted"`).
   - Always send `{"type": "session.end"}` before closing the WebSocket.
3. **Clinical & Safety Guardrails:**
   - Run `detectCrisisSignal()` and `detectMedicationAdviceRequest()` on user input before coaching generation.
   - Never weaken or remove the UK Crisis Help Panel (`999`, `NHS 111`, `Samaritans 116 123`) or the medical non-diagnostic disclaimers.
   - Never present strategy statistics without sample denominators (`started / attempts`).
4. **Design System Compliance (`DESIGN.md`):**
   - Preserve the warm stone palette (`#FAF8F5` canvas, `#212422` ink, `#006A67` mineral teal accent) and `DM Sans` / `Instrument Sans` typography.
   - Keep `SignalScene` lazy-loaded with `prefers-reduced-motion` and non-WebGL SVG fallback intact.
