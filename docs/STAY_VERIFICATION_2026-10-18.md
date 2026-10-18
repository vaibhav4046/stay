# Stay verification, 2026-10-18

Everything below was measured on this machine in this session. Nothing is carried over from earlier reports.

## Part 1. Defects found and fixed

| # | Defect | Evidence | Fix |
|---|--------|----------|-----|
| 1 | **Live voice config was rejected by the server** (wrapped tools, invented session fields, invented voice ids). | `scripts/probe-voice-protocol.mjs`: voice `oliver` -> `invalid_value`, socket closed 1008; wrapped tools -> `invalid_value`, 1008; invented fields -> `invalid_format`. | Documented schema: flat tools, `input.*`, `output.voice`. New schema: `session.updated` -> `session.ready` -> greeting. |
| 2 | Every `session.error` (and a bogus `UpdateConfiguration` frame) started the browser speech engine on top of the live agent. | Code read against the events reference. | Only fatal codes fall back. |
| 3 | 6 of 8 offered voices did not exist. | Voices doc + live `invalid_value`. | Real ids; native-accent voices for es/fr/de/it/pt added. |
| 4 | "Silence saver" dropped audio frames, starving server turn detection (billing is per session-hour, so it saved nothing). | Code read. | Removed. |
| 5 | Mid-session voice change did nothing (`restartVoiceRef` was never assigned) and `output.voice` is immutable. | Code read + docs. | Clean restart is wired. |
| 6 | Crisis detector missed 25 of 27 genuine phrasings and every non-English one; medication gate missed 12 of 15. | Adversarial probe. | Rewritten, 30+ languages, spacing-evasion; unit + HTTP tests with false-positive cases. |
| 7 | "Delete all my data" left memory and prefs; cloud delete reported success unchecked. | Code read. | Wipes every `stay_*` key, acts as the user under RLS, reports failure. |
| 8 | New users were shown fabricated "memories" ("prefers 20-minute blocks"). | Code read. | Memory starts empty. |
| 9 | Orb motion: per-frame constants, hundreds of React renders per second, orb overlapped hero text. | p95 frame 16.7 ms, 0 long tasks after fix. | See Part 3. |

## Part 2. Live voice, measured (synthesized speech into real sessions, not a human microphone)

Per-language test: one spoken sentence per language streamed into a live session; transcription accuracy as character error rate (CER) against the known sentence, and whether the reply stayed in the speaker's language/script.

**Verified on auto-detect (CER <= 20% and same-language reply): 23 of 29 tested**

en 0%, es 0%, fr 0%, de 0%, it 0%, pt 13%, hi 5%, ja 0%, zh 0%, ko 0%, nl 0%, ru 0%, tr 0%, ar 3%, sv 0%, no 2%, da 0%, fi 0%, ro 2%, vi 0%, id 4%, ms 1%, he 2%.

Pinning `input.language_codes` to the spoken language improved accuracy: pt 13% -> 0%, hi 5% -> 0%; es, ja, ru stayed 0%.

**Not verified (misheard on auto-detect; silent when pinned): pl 58%, hu 38%, el, uk, bn, ta, te, th (all ~100%).** For these the app uses the browser's speech recognition. Czech could not be tested (the test voice returned no audio). Browser recognition itself was not tested here.

Other live results:
- Reply latency after the end of speech: about 1.0 to 2.6 s (ja 0.1 to 0.4 s).
- Client tool from speech: `start_focus_timer {minutes: 15, firstStep: "open the tax folder"}`.
- Barge-in: `input.speech.started` about 1.1 s after the user begins; `vad_threshold` and `interruption_delay` did not change it.
- The provider documents only six languages for the Voice Agent (en es fr de it pt). The other 17 verified here are measured, not promised.

## Part 3. The orb and the site

- The orb is one field of 3,200 to 5,200 dots. A shape is a different place for the same dots to gather: dots leave the old shape, swirl through the middle at different times, and settle into the new one. Nothing but dots is drawn (no image or SVG overlay; a test checks this).
- Shape sources, fastest first: 37 hand-built shapes (instant, offline); an offline word table (about 200 words); a shape service where an LLM only names the best emoji (`openai/gpt-oss-20b`, about 350 ms, about 150 tokens; it correctly chose 🦔 hedgehog, 💍 wedding, 🏛️ cathedral, 🛹 skateboard, 🎷 saxophone, 🐙 octopus); a deterministic rosette for anything else. The emoji glyph is sampled into dots in its own colours.
- Only up to three keywords go to the shape service. Crisis and medication wording is withheld server-side and by the client, and returns the calm orb.
- The voice agent can also reshape the orb itself with a `show_shape` tool.
- Removed: `/demo`, the preview tour, the video-card showcase, the old two-mode workspace, the research globe, and clinical-jargon labels. Landing page is now one hero (orb plus a field that reshapes it), three steps, an honest trust section.
- An LLM asked to author shapes as geometry directly was tried and rejected: umbrella, guitar and dragon came out poor and the model hit a 8k tokens/min limit after six calls.

## Gates

- `tsc --noEmit`: 0 errors
- `vitest run`: 223 passed
- `next build`: all routes
- `playwright test`: 32 tests (landing, shapes, loop, safety, memory, two-user isolation, layout 320 to 1920 px, frame pacing)

## Not verified

- A real human microphone and speakers (echo, AEC leakage, earphone buttons).
- Real GPU frame pacing on a phone (measured in headless Chromium with software GL).
- Browser speech recognition for the 9 languages that fall back to it.
- Supabase Auth / Google OAuth / RLS against a real project.
- Bundle size: the landing page ships Three.js (about 265 kB first load). A raw WebGL renderer would cut it.

## Part 4. Voice lag, round 2 (live-measured; see the caveat on timing)

**Causes found and fixed in the client (deterministic, no timing needed):**

| Cause | Evidence | Fix |
|---|---|---|
| Sending a partial `turn_detection` block | Any `turn_detection` object raised reply lag from about 1.4 s to about 3.5 s; its `min_silence` values had no effect (`scripts/voice-e2e/turn-tuning.mjs`). | Removed. The provider's defaults are used. |
| 11 s greeting, 9 s replies | Full-app timeline: greeting audio ran 1.8 s to 11 s; replies about 9 s of speech. A short prompt cut replies to about 4 s (`latency-ab.mjs`). | Greeting 8 words or fewer (now about 2.2 s of speech, measured in the app); system prompt under about 250 tokens; replies capped at 15 words by prompt. |
| Several executors for one command | The same spoken command ran on every partial transcript, again on the final transcript, and again via the agent's tool. Typed commands also spoke through the browser voice on top of the live agent. | One executor: the agent's single `app` tool. Locally only pause/resume are instant. Browser speech is blocked while the agent is live (the fixed medication boundary is the one exception). The plan is no longer spoken a second time while the agent is connected. |
| 18 tools | Each tool adds about 0.08 s per reply. | One compact tool with an action list. |
| Slow barge-in | The server notices speech about 1.1 s in. | The mic ducks the agent's volume within about 60 ms of sustained loud input; the server event then stops it. Not tested with a real speaker and microphone. |

**Also added:** 16 named voice personas (one per real provider voice; only 5 are genuine non-English accents and the UI says so), voice switching by name, memory add/forget/show by voice (starts empty, never fabricated), and agent actions to open screens, start timers, change language, colour and orb shape. Destructive actions never run by voice: "delete my data" only opens Settings.

**Timing caveat (important).** After the fixes, the provider's response time was too uneven to quote a number. With one identical session config, time from end of speech to first reply audio measured 1.8 s, 2.5 s, 3.9 s and 9.6 s across consecutive runs, while the same probes measured 1.4 to 1.8 s earlier in the day. The fake-microphone harness also shifts when speech reaches the server. So: no latency figure is claimed here. The measured floor with this provider pipeline is about 1.4 s in its calm periods, against roughly 0.3 to 0.5 s for ChatGPT's native speech model. Matching that would need a different architecture (own STT, a fast LLM and streaming TTS), which has not been built or measured.

**Test harness bug found and fixed:** the 16-command tools probe first synthesized only the first word of each sentence (arguments split by the shell), which looked like "the agent hears one word". With correct audio and lead-in silence the single-tool design scored 10 of 16 on the first try; the misses were speech-recognition errors ("Change your password to noodle") and one wrong tool choice.

## Part 5. Product fit, own keys, all-day mode, and the cascade question

**Shapes.** Removed ice cream, cat, dog paw, butterfly and pizza from the built-in library and from the landing intro; added ADHD-native shapes: tangle (overwhelm, too much, scattered), stairs with one dot on the first step (stuck, first step), target (focus), list (to do), battery with a flat bottom third (no energy, burnout), bowl (meals). Checked in a real browser: "overwhelmed" -> tangle, "first step" -> stairs, "no energy" -> battery, "to do list" -> list, "focus" -> target, "my taxes" -> coin. Generic "putting off" no longer outranks a concrete object ("putting off the landlord email" -> envelope).

**Own keys.** Settings > Your own keys: GPT-OSS on Groq, Mistral, OpenAI, or any OpenAI-compatible https address; plus an AssemblyAI key. Verified live with the shared Groq key used as a user key: key check ok; a wrong key -> invalid_key; a private address (169.254.169.254) -> refused; plan with a user key -> source user; plan with a wrong user key -> falls back to the shared brain and flags the failure in a header the UI shows. Voice token route now answers 429 with code quota when the shared AssemblyAI allowance is gone, and the UI tells the person to add their own. Not tested live: Mistral and OpenAI (no keys here). DNS rebinding is not defended beyond the host-name checks and not following redirects.

**Blocks and all-day mode.** Default 10 minutes; 5, 10, 25, 45, 90 available; "Another 10 min" / "Try just 5 min" after a block. Voice session cap raised from 10 to 30 minutes (3 hours in all-day mode; the provider's cap is 10800 s, probed). All-day mode renews the session after the provider ends it or the socket drops (max 4 tries), with a 4-word "Still here with you." greeting instead of the intro. Not tested: a real 3-hour run, and renewal on a real network drop.

**The cascade question (measured, not guessed).** `scripts/voice-e2e/cascade-bench.mjs`, 6 runs: speech-to-text end-of-turn 0.88 s p50 (0.83 to 0.95); GPT-OSS first token 0.31 s p50 (20b) and 0.29 s (120b); streaming TTS first audio about 0.2 s (protocol found by probing: messages Generate, Flush, Terminate, KeepAlive, Cancel; audio arrives as base64 PCM 24 kHz in Audio messages). Sum is about 1.4 s, equal to the Voice Agent's floor, so a hand-built cascade was not built into the app. Changing min/max turn silence did not move end-of-turn below about 0.87 s in the sweep. ChatGPT voice and Google live voice were NOT measured (no keys), so there is no comparison and no speed claim.

**Parking lot and reply meter.** New `park` / `park_show` actions on the single app tool. Live probe (synthesized speech into a real agent session): "Park it, I need to call the dentist." -> park("call the dentist"); "Show me what I parked." -> park_show. The first attempt failed (the agent parked "the current task" with no text); the tool description was changed to say what value must hold, and it then passed 2/2. The voice sheet shows measured reply time on the user's device (server-heard end of speech -> first reply audio received); it is a readout, not a benchmark.

**Comparison harness.** `scripts/voice-e2e/compare-bench.mjs` streams the same sentence in real time and times true end of speech -> first reply audio. Stay (AssemblyAI Voice Agent), 5 runs: p50 2539 ms, p90 2693 ms, min 2453, max 2693. OpenAI Realtime and Gemini Live: NOT MEASURED (no keys); their legs are written to the vendors' documented events and have not been run. The 1.4 s figure elsewhere in this document is measured from the server's own "speech stopped" event, which is later than true end of speech, so the two numbers are not comparable.

## Gates (after Part 5)

- `tsc --noEmit`: 0 errors
- `vitest run`: 271 tests (15 files)
- `next build`: all routes (adds /api/keys/check)
- `playwright test`: 39 passed (local production build)
