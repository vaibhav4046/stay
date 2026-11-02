# Stay loop ledger
Updated: 2026-11-02 (field-test pass)  Branch: hackathon-polish  HEAD: see `git log -1`  (nothing pushed or deployed; origin/master = 63cc399)

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
| T2.2 | NOT MET | median 966 ms, P95 1,847 ms, 24 turns in 3 valid runs (synthetic-mic + live-model, local build 3cc950a, first sound from the audio context) | `docs/evidence/loop/T2-bench-2026-11-02-series2.json`; earlier valid run `…-series1.json` | Target: median 900 ms or less, P95 1,500 ms or less, 20 turns or more. Turn count met; both timings missed (median by 66 ms). Timed separately over 3 turns: the speech service ends the turn a median 585 ms after the speaker stops. Not a real-mic number. |
| T2.3 | PARTIAL | local duck built and unit tested; barge-in measured: Stay's voice went quiet a median 371 ms after the speaker started over it (3 tries; the speech service noticed at a median 760 ms) | `src/lib/voice/localBargeIn.ts`, `tests/unit/localBargeIn.test.ts` | Not built: pause-then-cancel-after-two-words and resume-within-400-ms. Not measured: false barge-ins per minute with `--echo`. |
| T2.4 | PASS (pause target); tuning not changed | 20 patient pauses (1.8, 2.3, 2.5 s): Stay talked into the pause 0 times and answered the finished thought 20 of 20 times, median 1,370 ms after it (synthetic-mic + live-model, one session, 0 playback underruns) | `docs/evidence/loop/T2.4-pause20-2026-11-02.txt` | Settings in use (coaching preset): end-of-turn confidence 0.4, `min_turn_silence` 128 ms, `max_turn_silence` 1,280 ms; a slower "reflective" preset (700 / 2,400 ms) exists. I did not retune them: the samples are too small to tell 100 ms from noise, and a faster setting risks talking into a pause, which is what Stay is for. Not measured: short answers ("yes", "done") against the 900 ms target on their own. |
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
| T4.1 | PASS | first-time visitor reaches listening in two clicks inside 10 s; a returning one in one click (voice services faked) | `tests/e2e/fastStart.spec.ts` | Voice services faked: times the app, not AssemblyAI. |
| T4.2 | PARTIAL | | | five sections; numbers tied to evidence files |
| T4.3 | PARTIAL | axe (WCAG 2.0/2.1 A and AA rules): 0 serious or critical violations on the landing page, onboarding, the first app screen, a call with words on screen, and the menu (390 px wide); nothing scrolls sideways at 320, 375, 768, 1024, 1440 or 1920 px on the landing page or the app; with reduced motion the orb makes 0 animations (the same counter is above 0 with motion allowed); Tab reaches the talk and menu controls without landing on anything hidden | `tests/e2e/accessibility.spec.ts` | Axe found one serious issue (the mic button's accessible name did not contain its visible word); fixed. Axe checks what a machine can; it is not a screen-reader test and not a compliance claim. **Not done: the orb default.** The spec wants the orb off by default, no morphing, no face; the app morphs and shows a face. **OWNER DECISION.** |
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

### Field test, 2 Nov 2026 (the owner's recorded call) and what changed
Source: the owner watched their own recording of a real call to the live site (old build 63cc399). Each complaint, the cause found, and the fix, all on branch `hackathon-polish` (commits 46cfc04, 2548baf, 614353a, 3cc950a). Not pushed, not deployed.
| What the owner saw | Cause found | Fix | Check |
|---|---|---|---|
| "I'm right here with you… I hear you" on every turn | the prompt allowed stock empathy; nothing stopped the same opening twice | stock empathy phrases banned in the prompt; the last three replies' openings are passed in so a reply does not start the same way; anger gets a short plain reply | `serverPrompt.test.ts`, `fieldTest.test.ts` (live-model probe: `scripts/voice-e2e/probe-chat.mjs`) |
| Asked to open Netflix / close it: Stay talked as if it could | no rule about what Stay cannot do | Stay says plainly it cannot open or close other apps or sites, and offers a timer | `capabilities.ts`, `fieldTest.test.ts` |
| An unrequested 5-minute timer | the model could call the timer tool on its own | a timer starts only when the person asked (words, or "yes" after an offer); the tool is withheld otherwise, and the page ignores a timer call nobody asked for | `capabilities.ts`, `fastSocket` guard, tests |
| "What's your main differentiator?" got "I will start the task" | no answer existed for it | direct answers for why Stay, and for which voice is selected and how to change it | `aboutStay.ts`, `aboutStay.test.ts` |
| "2–3 voices" when calling | two voice sessions could be opened by a double start, and a stale socket could keep speaking | one start at a time, and events from an old socket are ignored | `oneVoice.spec.ts` |
| "Not listening" in some runs | in my own test rig, a retried session was handed a stopped microphone stream (the rig, not the app) | the rig returns a fresh stream per request; app code unchanged for this | 3 valid consecutive runs after the fix |
| Layout "left right", controls pushed off screen | the small wave in the mic button grew to ~1,300 px wide while a call was live | the wave is sized from its wrapper | `layoutStability.spec.ts`: overflow 0 px, phone and desktop |
| The orb jumped 170 px at the first spoken word | layout switch from the big orb to the small one in one frame | the orb glides there over 280 ms (reduced motion: no glide) | `layoutStability.spec.ts`: the orb passes through 10–15 positions; other layout shift 0.0167 phone, 0.0038 desktop (budget 0.02). Chrome scores the glide itself 0.062 phone, 0.021 desktop; the spec says so and does not count it |
| The landing page said Stay was slower than others | a comparison table and loss charts | removed; no other product is named on the page | `landing.test.ts`, `landing.spec.ts`, `claims-lint` |
| "Voice is breaking" | two causes seen: the double session above, and a possible slow device | double session fixed. Slow device: a synthetic call at normal, 4× and 6× slower CPU gave 0 playback underruns each (3 turns each; main thread blocked up to 620 ms at 6×) | `docs/evidence/loop/T2-cpu-throttle-2026-11-02.txt` (synthetic-mic, live-model, local build). **Not reproduced by me; a real-microphone call on the owner's machine is still the test that counts.** |
| Not tested before: do other voice agents (personas) get a good Stay? | built an agent-vs-agent test: a model plays four people (angry first-timer, a person testing the product, "open Netflix then close it", avoiding an email) and talks to Stay's real chat route with its tools on; rules flag repeated openings, stock lines, an unrequested timer, claiming to have opened or closed something, no reply, a reply too long to speak | 4 conversations × 4 turns: **0 rule failures on the 11 turns Stay answered; 5 turns were refused by the model service's 8,000-token-a-minute cap and are not scored** (live-model, typed text; not the voice) | `scripts/voice-e2e/agent-vs-agent.mjs`, `tests/fixtures/eval/personas.json`, `docs/evidence/loop/agent-vs-agent-2026-11-02.json` |
| A question set the orb shape to "exactly" and Stay said Done (found by the persona run) | the model may use any action even when it is not in the offered list | shape and colour are offered only when the words ask for a look change, and the voice path refuses and re-asks in words if one still arrives | `fieldTest.test.ts`, `fastSocket.test.ts` |

Sound: the test browsers I start are launched with `--mute-audio` and I do not play anything on the owner's speakers.

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
