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
