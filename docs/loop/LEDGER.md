# Stay loop ledger
Updated: 2026-11-02  Branch: hackathon-polish  HEAD: see `git log -1`  (nothing pushed or deployed; origin/master = 63cc399)

Labels (H8): `synthetic-mic` = a TTS "person" injected as the microphone. `real-mic` = a human speaking. `mocked-model` / `live-model`. Only `real-mic` + `live-model` supports a public latency or quality claim. Nothing in this ledger is `real-mic`.

## Scoreboard
| Gate | Status | Number (label) | Evidence | Notes |
|------|--------|----------------|----------|-------|
| T0.1 | PASS (local) | offline 60/60 routed (mocked-model); live 59/60 grounded, 0 canned (live-model, typed text, local build) | `docs/evidence/loop/T0.1-live-2026-11-02.json`; earlier runs `T0.1-before-live-…` (44/60) and `T0.1-run2-live-…` (52/60) | The spec asks for the live run against an owner-approved preview deploy: HUMAN to re-run there (`STAY_EVAL_URL=<preview> npx vitest run tests/unit/groundingLive.test.ts`). The 1 miss was an empty model reply, seen once, not reproduced in 8 retries. |
| T0.2 | PASS | 5 failure kinds + every question intent get the honest text, never a template (mocked-model) | `tests/unit/conversation.test.ts` | Live: a provider rate limit came back as the plain 503 message during the eval (seen, not hidden). |
| T0.3 | PARTIAL | typed, spoken (same route), translation, agent tools (MCP), vision-read text, region-aware contacts: unit tests pass | `tests/unit/crisisPaths.test.ts`, `docs/audit/SOURCES.md` | Phone agent (`agent/agent.py`) NOT covered: `check_crisis` is defined but never called, no medication gate, no AI line. Not run here (needs LiveKit). Owner has not approved a number, so nothing is exposed. See T3.5. US 988 page not opened (see SOURCES). |
| T0.4 | PASS (web) | 20 phrasings, detector + chat route, model never called | `docs/evidence/loop/T0.4-before.txt`, `-after.txt` | 3 misspellings (adderal, ritilin, vyvance) were slipping through; fixed. Phone: see T0.3. |
| T0.5 | PASS | 8 e2e + full suite 165 passed, 2 skipped | `tests/e2e/consent.spec.ts` | Removed the `navigator.webdriver` bypass; every start path (button, call, `?voice=auto`, hardware key, host command) asks first. Delete-all now also clears `stay:` keys (consent, scheduled call) — it did not before. "Before" evidence is by code reading (the bypass line), not a recorded red run. |
| T0.6 | PASS | `node scripts/claims-lint.mjs` clean; 29 self-tests; strict CI step | `scripts/claims-lint.mjs`, `tests/unit/claimsLint.test.ts`, `.github/workflows/ci.yml` | Removed from the landing page: the "fast voice vs managed voice" table and the per-language error percentages (no raw files exist; ticks only now). Head-to-head numbers kept: raw reports are in `docs/bench-results/realproducts/` (the lint accepts that folder as raw evidence; spec says `docs/evidence`). Those are `synthetic-mic`, so strictly H8 says they are not a public latency claim: OWNER DECISION whether to keep them (they are labelled on the page and show Stay slower). `claims-lint-allow:` markers are used on user-vocabulary lists and one book title. |
| T0.7 | PASS | first voice session speaks and shows the line, second does not (mocked voice); 18+ and AI notice on onboarding | `tests/e2e/disclosure.spec.ts`, `tests/unit/disclosure.test.ts` | Phone: not done (agent.py). Marked as seen when the session opens, not when audio finishes. |
| T0.8 | IN_PROGRESS | rule is in the vision prompt (tested) | `tests/unit/conversation.test.ts` | Fixture image + output medication check + live check still to do. |
| T1.1 | NOT STARTED | | `scripts/verify-voices.mjs` exists | Needs the real key (available locally). |
| T1.2 | NOT STARTED | | | |
| T1.3 | NOT STARTED | baseline 1,824 ms | | |
| T1.4 | NOT STARTED | | `src/lib/voice/speechText.ts` exists | needs 30 cases, number/unit spelling, 20-word sentences |
| T1.5 | NOT STARTED | | | |
| T1.6 | HUMAN | | | `/lab/voices` page not built; owner runs with 5 people. |
| T1.7 | NOT STARTED | | | |
| T2.1 | NOT STARTED | | | |
| T2.2 | NOT STARTED | no new number | | old: see `docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md` (synthetic-mic) |
| T2.3 | NOT STARTED | baseline 849 ms | | `playback.duck` events are emitted by FastSocket but not applied (`pcmPlayer.setDucked` is never called). |
| T2.4 | NOT STARTED | | | |
| T2.5 | NOT STARTED | | | |
| T2.6 | NOT STARTED | | | |
| T2.7 | NOT STARTED | | | |
| T2.8 | HUMAN | | | `/lab/latency` not built. |
| T3.1 | NOT STARTED | | | |
| T3.2 | PARTIAL | screen/camera/picture built and tested end to end with the real vision model (live-model) | `tests/e2e/vision.spec.ts`, `scripts/vision-real.mjs` | frame-age mention, vision + tool in one turn, fixture images: not done. |
| T3.3 | NOT STARTED | | | |
| T3.4 | NOT STARTED | | | |
| T3.5 | HUMAN / FAIL | | `agent/agent.py` uses the old `livekit.agents.pipeline.VoicePipelineAgent` API; the plugin docs in SOURCES.md are for livekit-agents 1.8 | Needs rewrite, the owner's approval to deploy and to buy a number. Cut-list item. |
| T3.6 | PARTIAL | | | auto language works in the fast path; no new measurement |
| T4.1 | NOT STARTED | | | |
| T4.2 | PARTIAL | | | landing is 5 sections; numbers now tied to evidence |
| T4.3 | NOT STARTED | | | The spec wants the orb off by default, no morphing, no face. The app currently morphs and shows a face. Not changed yet: tell the owner. axe not installed. |
| T4.4 | NOT STARTED | | | `HACKATHON_SUBMISSION.md` needs the vision / five-section / new-number update |
| T4.5 | HUMAN | | `scripts/demo-video/*` built, final render not done | owner records or approves the composed video |
| T4.6 | HUMAN | | | drafts to be written |
| T5.1–T5.4 | NOT STARTED / HUMAN | | | ChatGPT Voice and Gemini Live runs are the owner's. |

## Iteration log
### Iteration 1: T0.1–T0.3, T0.8 (part)
Commit 9640f01. New `src/lib/conversation/{intent,response,visionGate,grounding}.ts`; the chat route, FastSocket and the voice hook say what went wrong in plain words instead of inventing a reply; vision text goes through the crisis gate before anyone sees it.
Commands: `npx tsc --noEmit` clean; `npx vitest run` 909 passed.

### Iteration 2: T0.4
Commit 695b345. Before `docs/evidence/loop/T0.4-before.txt` (3 of 20 detector cases failed); after `T0.4-after.txt` (23 passed).

### Iteration 3: T0.5
Commit f1e3454. Full e2e on the new build: 165 passed, 2 skipped, 0 failed (6.1 min). Specs touched: helpers now start from "already agreed" through `grantMicConsent`.

### Iteration 4: T0.6
Commit 81d47f1. Test wording updated (H12, said here): `tests/unit/userMemory.test.ts` now expects `PERSISTENT USER MEMORY & KNOWLEDGE GRAPH` (the word AGI was removed from the prompt). `tests/e2e/landing.spec.ts` had a regex corrupted into backspace characters in an earlier session (`/\brated\b/`), so that "no fake ratings" check never matched anything; restored.

### Iteration 5: T0.7
Commit 4fedd6a.

### Iteration 6: T0.3
Commit fe089d5. `tests/unit/core.test.ts` renamed `UK_CRISIS_RESOURCES` to `CRISIS_RESOURCES` (wording only).

### Iteration 7: T0.1
Commit 900c586. Root cause of the generic replies: the fast path's system prompt forced "acknowledge + tiny physical step + question" on every turn, so "what is the difference between a virus and a bacterium" got "Sure thing! Pick one topic". The prompt now follows the classified intent. Six basic questions about Stay (can you see my screen, do you remember, are you a real person, languages, how do I show you something, who made you) had no direct answer; added.
Live runs (live-model, typed, local build, Groq `openai/gpt-oss-120b`): 44/60 → 52/60 (6 of the 8 misses were the provider's rate limit, reported honestly) → 59/60.

## Handoff
Next gate: finish T0.8 (fixture image, medication check on vision output), then T1.4, T1.1/T1.2, T2.1–T2.3.
Owner requests waiting (nothing is done until you say yes, per H9):
1. Push `hackathon-polish` and open a PR, or deploy a preview, so T0.1 can be re-run live against it.
2. Confirm the hackathon deadline on Discord (7 Nov 2026 19:00 GMT is what we have).
3. Keep or drop the synthetic-mic head-to-head table on the landing page (H8).
4. Orb: the spec says off by default, no morphing, no face. The current app has them. Change the default?
5. The phone path (T3.5): rewrite for livekit-agents 1.x, deploy, buy a number — or hide "Call Stay" for the phone.
Open questions: none blocking.
