# The "perfect" gate: what must be true before the demo video is made

The demo video shows no errors. So before any frame is recorded, the product has to pass every line below, on the build that will be filmed,
with the raw output saved under `docs/evidence/loop/`. A line that cannot be measured is not on this list (nobody can promise "100%"; this is the
strongest honest bar available).

## A. A long spoken conversation (the soak)
Command: `node scripts/voice-e2e/soak.mjs http://localhost:3120 --minutes 40` on a quiet machine (CPU under 25% beforehand; no game running).
One synthetic neural voice (also in Spanish and Hindi), reactive persona, about 60 turns across: overwhelm, an avoided task, facts, thinking pauses,
interruptions, frustration, app commands (remember, list, park, history, memory, report, settings, timer), a language switch and back, Hindi,
a low-mood line, check-ins, wrap-up.

| Check | Pass line |
|---|---|
| Turns with no reply or never returning to Listening | 0 |
| "Speaking" shown over a stopped player | 0 turns over 1.5 s |
| Spoken jargon: brackets, "(2m)", ellipsis, parentheses, quotation marks, shortcuts or file names, markdown | 0 turns |
| Stock empathy or filler ("I hear you", "Need anything else?", "Sure thing") | 0 turns |
| Replies over 60 words (except when the person asked for detail) or sentences over 24 words | 0 turns |
| What Stay heard against what was said (word overlap, English and Spanish) | 90% of turns at 80% or better |
| First sound after speech (median / 95th percentile) | median 1,500 ms or less; 95th 3,000 ms or less |
| Page errors in the console | 0 |
| Audio underruns | 0 |

## B. Everything else, same build
- `npx tsc --noEmit`, `npx vitest run`, `node scripts/claims-lint.mjs`: clean.
- `npx playwright test` (full): 0 failed.
- Silent microphone test (`scripts/voice-e2e/file-mic.mjs`): every line heard, the thinking pause respected, the Spanish line answered.
- Blind comparisons (`scripts/eval/judge-panel.mjs`, `scripts/eval/old-vs-new.mjs`): Stay ahead in both.
- Live site on the same commit: the checks above that touch the server give the same answers there.
- Settings: "Export to Obsidian" gives a zip a real unzip tool opens; "Email this to me" opens a mail link.

## C. What the video may and may not show
- Only flows that passed above, on the filmed build. A take with any flagged moment is not used.
- No competitor is named on screen or in the voice-over ("a general chatbot", "the big assistants"). Stay's own answer to "why not just use a general assistant?" is its real answer from the product, not a script.
- Labelled honestly at the bottom: simulated speaker; original art; real AssemblyAI speech.
- No number appears that is not on the landing page's evidence list.

## Status, 3 Nov 2026 (what is proved, what is not)

**Not passed on the real model: section A.** The first full 40-minute run with the real model failed at turn 22: Groq's free tier allows 200,000 tokens a day per model and my testing had used 199,020, 199,247 and 199,277 of them (read from Groq's own 429 text). From then the model answered "too many requests", so later turns say nothing about Stay's quality. Evidence: `docs/evidence/loop/soak-run2-gate-failed-tpd-exhausted.*`. The real-model run has to be repeated once the daily window has freed, or on a second key.

**Passed on the voice pipeline, with a stand-in model** (`scripts/voice-e2e/stub-llm.mjs`, canned replies, so it says nothing about wording or quality; label any use of it): synthetic speaker, English / Spanish / Hindi, nothing played aloud.

| Run | Minutes | Turns | Silent turns | Stuck turns | Jargon | Heard differently | Voice reconnects / "unavailable" |
|---|---|---|---|---|---|---|---|
| `soak-run3-pipeline-stub-model-40min` (before the fix) | 40.1 | 137 | 0 | 0 | 0 | 2 | 219 / 110 |
| `soak-run4-pipeline-stub-model-guarded-22min` (after) | 22.2 | 85 | 0 | 0 | 0 | 1 | 1 / 0 |

The two "heard differently" are the speech-to-text on the line "Goodnight, Stay." (50% word overlap), not Stay's output.

What the soaks found and fixed (each with a test): a stock "Parked." said after the model had already said it; replies thrown away when the voice connection dropped (the person saw and heard nothing); voice reconnects started twice at once, which drove the service over its session limit; a replaced voice session closing late starting another; the model's stock opener "You have my whole attention".

Still open: the real-model soak above; first sound after speech is not comparable between the stand-in and the real model (the stand-in adds 260 ms).

**Real-model run on the merged build (`soak-run5-real-model-18min`, canned speaker lines, real Groq replies).** 61 turns in 18 minutes; the free daily token cap bit again from turn 9 (32 turns got the plain "too many requests" line), so only 29 turns reached the model. Those 29: first sound median 1,310 ms, 95th 2,369 ms; longest reply 54 words; one sentence of 28 words (in the scene that asks for a long explanation); no jargon, no stock empathy, no silent or stuck turn; 1 voice reconnect, 0 unavailable. It also found one new bug: the fallback model's empty `<think></think>` block appeared at the start of a reply. A stream filter now removes think blocks (`thinkFilter.ts`, with tests). The gate in section A still needs a full run with enough tokens.
