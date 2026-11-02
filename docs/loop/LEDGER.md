# Stay loop ledger
Updated: 2026-11-02  Branch: hackathon-polish  HEAD: see `git log -1`  (nothing pushed or deployed; origin/master = 63cc399)

Labels (H8): `synthetic-mic` = a TTS "person" injected as the microphone. `real-mic` = a human speaking. `mocked-model` / `live-model`. Only `real-mic` + `live-model` supports a public latency or quality claim. **Nothing in this ledger is `real-mic`.**

## Scoreboard
| Gate | Status | Number (label) | Evidence | Notes |
|------|--------|----------------|----------|-------|
| T0.1 | PASS (local) | offline 60/60 routed (mocked-model); live 59/60 on topic, 0 stock replies (live-model, typed text, local build) | `docs/evidence/loop/T0.1-live-2026-11-02.json`; earlier runs `T0.1-before-live-…` (44/60), `T0.1-run2-live-…` (52/60) | Spec asks for the live run against an owner-approved preview deploy: HUMAN to re-run there. The 1 miss was an empty reply, seen once and not reproduced in 8 retries; the empty-stream check was hardened anyway. Groq's 8,000 tokens a minute on this key caused rate-limit replies mid-eval (shown honestly, retried by the test). |
| T0.2 | PASS | 5 failure kinds and every question intent get the honest text, never a template (mocked-model) | `tests/unit/conversation.test.ts` | |
| T0.3 | PARTIAL | typed, spoken (same route), translation, agent tools, vision-read text, region-aware contacts: unit tests pass | `tests/unit/crisisPaths.test.ts`, `docs/audit/SOURCES.md` | **Phone agent not covered** (`agent/agent.py`: `check_crisis` is defined, never called; no medication gate; no AI line). Not run here (needs LiveKit); no number bought, so nothing exposed. US 988 page was not opened (SOURCES). |
| T0.4 | PASS (web) | 20 phrasings, detector + chat route, model never called | `docs/evidence/loop/T0.4-before.txt`, `-after.txt` | 3 misspellings were slipping through; fixed. Phone: see T0.3. |
| T0.5 | PASS | 8 consent e2e; full suite green | `tests/e2e/consent.spec.ts` | Removed the `navigator.webdriver` bypass; every start path asks first. Delete-all now also clears `stay:` keys. "Before" is by code reading, not a recorded red run. Benchmark scripts now pre-seed consent as "a person who already agreed". |
| T0.6 | PASS | `claims-lint` clean; 29 self-tests; strict CI step | `scripts/claims-lint.mjs`, `tests/unit/claimsLint.test.ts` | Removed from the landing page: the fast-vs-managed table and per-language percentages (no raw files). Head-to-head numbers kept (raw reports in `docs/bench-results/realproducts/`; the lint accepts that folder). They are `synthetic-mic`: strictly H8 says not a public latency claim: **OWNER DECISION**. |
| T0.7 | PASS (web) | first voice session speaks and shows the AI line, the second does not; a failed first connect that is retried still says it | `tests/e2e/disclosure.spec.ts`, `tests/unit/disclosure.test.ts` | 18+ and AI notice on onboarding. Phone: not done. |
| T0.8 | PASS | offline: fixture picture + mocked model, obeyed replies blocked; live: 5/5 answered runs did not follow planted orders, 4/5 described the note (live-model, picture) | `tests/unit/pictureInstructions.test.ts`, `docs/evidence/loop/T0.8-live-2026-11-02.json` | Found and fixed on the way: the app showed "could not make that out" instead of the help screen when the server stopped a picture reply. |
| T1.1 | PASS | 18 of 18 voices open a live TTS session (live provider handshake) | `docs/evidence/voices/verify-2026-11-02.json` | Says a voice opens, not how it sounds (T1.6). |
| T1.2 | PARTIAL | | `src/components/VoicePicker.tsx` | Previews and persistence exist. Not done: reduce to 6–9 shortlisted voices and hide any voice that failed the handshake; the picker still lists the old persona set. Reason not done: a large change to code three e2e specs lean on. |
| T1.3 | NOT STARTED | baseline 1,824 ms | | |
| T1.4 | PASS | 49 cases: numbers, units, times, money, ordinals, 20-word sentences, breathing commas, English only | `tests/unit/speechText.test.ts` | |
| T1.5 | PASS | 14 overload phrases, 8 non-overload; prompt gets the short-reply clause only then (text only, never the voice) | `tests/unit/overload.test.ts` | Not measured on a live model. |
| T1.6 | HUMAN | | | `/lab/voices` not built. |
| T1.7 | NOT STARTED | | | My words already feed STT `keyterms_prompt`; TTS pronunciation control not checked. |
| T2.1 | PASS | the worklet marks the first non-silent sample rendered and the page maps it to the performance clock; older "first sound" figures relabelled packet receipt | `tests/unit/playbackWorklet.test.ts` | The benchmark scripts (`sim-human`, `real-voice-e2e`) now report time to first sample played. `bench:voice` had been timing a playback path Stay no longer uses. |
| T2.2 | {{T22}} | {{T22N}} | `docs/evidence/loop/T2-bench-2026-11-02.json` | Target: median 900 ms or less, P95 1,500 ms or less, 20 turns or more. |
| T2.3 | PARTIAL | local duck built and unit tested; barge-in measured: {{T23N}} | `src/lib/voice/localBargeIn.ts`, `tests/unit/localBargeIn.test.ts` | Not built: pause-then-cancel-after-two-words and resume-within-400-ms. Not measured: false barge-ins per minute with `--echo`. |
| T2.4 | {{T24}} | | | Tuning of `min_turn_silence`/`max_turn_silence` not changed this pass. |
| T2.5 | NOT STARTED | | | |
| T2.6 | NOT STARTED | | | |
| T2.7 | NOT STARTED | | | |
| T2.8 | HUMAN | | | `/lab/latency` not built. This is the only evidence allowed for public latency numbers. |
| T3.1 | PARTIAL | | `src/lib/voice/toolSelfCheck.ts`, `tests/unit/agenticTools.test.ts` | The self-check exists and is wired into the voice hook; per-tool coverage not re-audited this pass. |
| T3.2 | PARTIAL | screen / camera / picture built and tested end to end with the real vision model (live-model) | `tests/e2e/vision.spec.ts`, `scripts/vision-real.mjs` | Not done: "frame older than 30 s is mentioned as older" (frames are taken at the moment of the question, so it rarely applies); a vision question and a tool in one turn; fixture images other than the planted-instruction one. |
| T3.3 | NOT STARTED | | | `/api/voice/translate` exists, now behind the safety gate, not exposed in the app. |
| T3.4 | PARTIAL | | `src/lib/pdf/clinicianReport.ts` | "Prepare for a Visit" with a PDF exists from before; not re-verified this pass. |
| T3.5 | HUMAN / FAIL | | `agent/agent.py` | Uses the old `livekit.agents.pipeline.VoicePipelineAgent` API; the docs in SOURCES.md are for livekit-agents 1.8. Needs a rewrite, the owner's approval to deploy and to buy a number. Cut-list item. |
| T3.6 | PARTIAL | | | auto language works in the fast path; no new measurement |
| T4.1 | {{T41}} | | `tests/e2e/fastStart.spec.ts` | Voice services faked: times the app, not AssemblyAI. |
| T4.2 | PARTIAL | | | five sections; numbers tied to evidence files |
| T4.3 | NOT STARTED | | | The spec wants the orb off by default, no morphing, no face; the app morphs and shows a face. Not changed: **OWNER DECISION**. axe not installed. |
| T4.4 | PASS (pending your read) | | `README.md`, `HACKATHON_SUBMISSION.md` | What it is, the three-minute path, the diagram, an evidence table, limits and safety; every number links to a file. |
| T4.5 | HUMAN | | `docs/DEMO_SCRIPT.md`, `docs/submission/demo-captions-draft.vtt` | Script and captions written. The composed video is from an earlier build; commands to rebuild it are in the script. |
| T4.6 | HUMAN | | `docs/submission/POSTS.md` | X (280 characters, link counted as 23) and LinkedIn drafts. Nothing posted. |
| T5.1 | PASS | 20 scenarios fixed | `tests/fixtures/eval/head_to_head.json`, `docs/benchmark/HEAD_TO_HEAD.md` | |
| T5.2 | PASS (written) | | `docs/benchmark/HEAD_TO_HEAD.md` | Scoring axes and the frame-count timing method are written; nothing scored. |
| T5.3 | HUMAN | | | ChatGPT Voice and Gemini Live runs are the owner's. Dessa: not tested. |
| T5.4 | NOT STARTED | | | needs T5.3 |

## Iteration log
Commits, oldest first: 9640f01 (T0.1–T0.3, T0.8 part), 695b345 (T0.4), f1e3454 (T0.5), 81d47f1 (T0.6), 4fedd6a (T0.7), fe089d5 (T0.3), 900c586 (T0.1), 2f0f71a (first ledger), 4378275 (T0.8, T1.4, T1.5), 1e7279f (T1.1, T2.1), 0c9075e (T2.3 and T0.7 fix), 07072e1 (T4.5), b0465b5 (worklet, posts), fe449d7 (T5.1, T4.1).

Regression set at the end of this pass: see `docs/evidence/loop/regression-2026-11-02.txt`.

### What the checks found (the useful part)
- The fast path's system prompt forced "acknowledge, tiny physical step, question" on every turn, so factual questions got "Sure thing! Pick one topic" (live eval 44/60 → 59/60 once the prompt followed the intent).
- Six basic questions about Stay had no direct answer; the model was left to guess what Stay can do.
- A test browser could skip the microphone consent sheet; delete-all left the consent setting behind.
- Medication brand-name misspellings slipped past the check.
- A server-side block on an unsafe picture reply was shown as "could not make that out".
- `bench:voice` timed a playback path that no longer exists, so its "first audio" would have been empty.
- A regex in a landing test (`/\brated\b/`) had been corrupted into backspace characters in an earlier session, so that check never matched anything. Restored.
- Test wording updated (H12, said here): `userMemory.test.ts` (the word AGI left the prompt), `core.test.ts` (`UK_CRISIS_RESOURCES` renamed), `core.spec.ts` (two checks on the removed fast-vs-managed table; now assert it stays gone), `speechText.test.ts` (one input changed because "then breathe" now correctly gets a comma). No assertion about safety, consent or honesty was removed.
- Groq limits this key to 8,000 tokens a minute. That is about four replies a minute for the whole site: judges using it at once will see "I am getting too many requests right now". See the owner requests.

## Handoff
Next gate: T1.2 (picker: the shortlist, hide failed voices), T2.3 (pause then cancel), T2.4 tuning, T1.3 (warm TTS for the next language), T3.1 per-tool tests, then the lab pages for T1.6 and T2.8.

Owner requests waiting (nothing is done until you say yes, per H9):
1. **Push `hackathon-polish` and open a PR**, and/or deploy a preview, so the live eval can be re-run against it and your phone can try it.
2. **Groq plan.** The key allows 8,000 tokens a minute. With judges trying the site together, replies will fail with the plain "too many requests" message. Options: upgrade the Groq tier, add a second provider key, or tell judges to bring their own key (Settings). Only you can change that.
3. **Real-microphone run** (T2.8, 20 turns, headphones) and the **listening test** (T1.6): the pages are not built yet; say if you want them built first.
4. Confirm the **deadline** on Discord (7 Nov 2026 19:00 GMT is what we have).
5. Keep or drop the **synthetic-mic head-to-head table** on the landing page (H8).
6. **Orb:** the spec says off by default, no morphing, no face. Change the default?
7. **Phone (T3.5):** rewrite for livekit-agents 1.x, deploy, buy a number, or hide "Call Stay" for the phone and say so.
8. **Video and posts:** record with `docs/DEMO_SCRIPT.md`, then post `docs/submission/POSTS.md`. I will not post.

Open questions: none blocking.
