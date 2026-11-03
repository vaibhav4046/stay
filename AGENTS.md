# Agent Operating Instructions (`AGENTS.md`)

## 1. Purpose of This Repository

**Stay** is a voice companion for adults with ADHD (task starting, answers, patience through pauses), built for AssemblyAI's TTS-1 hackathon week (November 2026). Start with [`REVIEWERS.md`](REVIEWERS.md): how to verify every claim, where the code is, and the honest limits. The live voice path is the fast path in `src/lib/voice/fastSocket.ts` (AssemblyAI streaming STT -> `/api/voice/chat` -> AssemblyAI TTS-1); the managed Voice Agent protocol below is the fallback path.

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
