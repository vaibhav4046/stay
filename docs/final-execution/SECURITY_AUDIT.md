# Stay — Security, Privacy & Safety Guardrail Audit (`SECURITY_AUDIT.md`)

**Date:** 2026-10-31  
**Prior Audit Reference:** `docs/security/STAY_SECURITY_AUDIT_2026_10_31.md`

---

## 1. Security & Safety Control Verification Matrix

| Control Domain | Implementation | Evidence Classification | Test / Proof Reference | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Secret & API Key Isolation** | `ASSEMBLYAI_API_KEY`, `LLM_API_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` accessed exclusively in server routes (`src/app/api/voice/token/route.ts`, `src/app/api/voice/fast-token/route.ts`, `src/app/api/voice/chat/route.ts`, `src/app/api/coach/plan/route.ts`). Zero secrets in `NEXT_PUBLIC_*` or client bundle. | `UNIT TEST` + `MANUAL REVIEW` | `git grep` secret scan + `tests/unit/byok.test.ts` | **PASS** |
| **SSRF Protection on BYOK Base URL** | `validateSafePublicBaseUrl` in `src/lib/security/ssrf.ts` blocks `http:`, `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254` (cloud metadata), IPv6 loopback/link-local, credentials in URL, and non-443 ports. | `UNIT TEST` | `tests/unit/ssrf.test.ts` (38 passing tests) | **PASS** |
| **Content Security Policy (CSP) & Headers** | `next.config.mjs` enforces `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy: camera=(), geolocation=(), microphone=(self)`. | `E2E TEST` + `MANUAL REVIEW` | `tests/e2e/stay.spec.ts` + `next.config.mjs` | **PASS** |
| **API Rate Limiting & Payload Validation** | Per-IP token-bucket rate limiter (`src/lib/security/rateLimit.ts`) + strict Zod schema validation (`src/lib/coach/schema.ts`) on all API routes. | `UNIT TEST` | `tests/unit/coachRoute.test.ts`, `tests/unit/a2aProtocol.test.ts` | **PASS** |
| **Deterministic UK Crisis Gate** | `detectCrisisSignal()` in `src/lib/safety/crisis.ts` intercepts self-harm/suicide signals on both partial streaming transcripts and final text BEFORE any LLM call, disconnects voice immediately, and opens `CrisisHelpPanel` (`999`, `NHS 111`, `Samaritans 116 123`, `Shout 85258`). | `UNIT TEST` + `E2E TEST` | `tests/unit/safetyGates.test.ts` (55 tests), `tests/e2e/stay.spec.ts` | **PASS** |
| **Deterministic Medication Boundary** | `detectMedicationAdviceRequest()` intercepts dosing, titration, stopping, or drug-interaction queries and returns a fixed clinical referral message while suppressing LLM audio/tool output (`medicationSuppressionRef`). | `UNIT TEST` + `E2E TEST` | `tests/unit/safetyGates.test.ts`, `tests/e2e/stay.spec.ts` | **PASS** |
| **Local-First Privacy & Explicit Memory Consent** | Sessions, Today items, and memories live in browser `localStorage` by default. `MEMORY_CUE` in `useVoiceAgent.ts` prevents the LLM from saving unrequested personal facts unless the user explicitly asks to remember. Full JSON export and 1-click wipe in `/app/settings`. | `UNIT TEST` + `E2E TEST` | `tests/unit/userMemory.test.ts`, `tests/e2e/stay.spec.ts` | **PASS** |
| **Test Suite Portability** | Removed all machine-specific `C:/Users/...` paths from `tests/e2e/liveVoiceSync.spec.ts`, `tests/e2e/visualVerification.spec.ts`, and `HACKATHON_SUBMISSION.md`. | `E2E TEST` + `MANUAL REVIEW` | `git grep "C:/Users"` (0 matches in `src/` and `tests/`) | **PASS** |
