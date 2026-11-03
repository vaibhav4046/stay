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
