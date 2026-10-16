# Test Plan (`docs/TEST_PLAN.md`)

## 1. Overview & Verification Strategy

The Stay testing strategy validates every layer of the closed-loop system:
1. **Unit tests (`tests/unit/core.test.ts` via Vitest):**
   - Deterministic crisis detection with exact match boundaries.
   - Medical advice and dosing boundary intercept.
   - Evidence-informed strategy selection, barrier mapping, and <2-minute first-step generation.
   - Personalisation heuristics: requiring `attempts >= 3` and `>= 60%` success rate before overriding default barrier strategy; preventing premature personalisation on small samples (`attempts < 3`).
   - AssemblyAI Voice Agent tool argument parsing and clamping.
   - Transparent denominator calculations (`started / attempts`) and preliminary sample warnings.
2. **End-to-End browser tests (`tests/e2e/stay.spec.ts` via Playwright):**
   - Landing page rendering and medical disclaimer visibility.
   - Fixed UK crisis panel interaction, link accessibility (`999`, `NHS 111`, `Samaritans 116 123`), and keyboard escape handling.
   - Full closed-loop demonstration on `/demo`: Task capture -> Barrier picker -> Strategy plan -> Focus timer -> Outcome logging -> Treatment check-in -> Clinician PDF preview and download.
   - App onboarding gate, care context selection, quiet mode toggle, history timeline, and data deletion.
   - Privacy and terms route compliance.
3. **Live Voice Agent WebSocket testing:**
   - Single-use ephemeral token minting (`POST /api/voice/token`).
   - Stored agent provisioning (`scripts/sync-assemblyai-agent.mjs`).
   - Live WebSocket handshake (`wss://agents.assemblyai.com/v1/ws?token=...`).
   - AudioWorklet 24kHz PCM16 streaming, barge-in interruption, and clean `session.end` teardown.

---

## 2. Test Execution Commands

```bash
# Run unit test suite
npm test

# Run TypeScript type-check
npm run lint

# Build production bundle
npm run build

# Run Playwright E2E suite
npx playwright test
```
