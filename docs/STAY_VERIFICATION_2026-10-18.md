# Stay verification, 2026-10-18

Everything below was measured on this machine in this session. Nothing here is carried over from earlier reports.

## What was wrong (found, then fixed)

| # | Defect | Evidence | Fix |
|---|--------|----------|-----|
| 1 | **Live voice session config was rejected by the server.** Wrapped tool shape, invented session fields, invented voice ids. | Live probe (`scripts/probe-voice-protocol.mjs`): voice `oliver` -> `invalid_value`, socket closed 1008; wrapped tools -> `invalid_value`, closed 1008; invented fields -> `invalid_format`. | Documented schema: flat tools, `input.keyterms`, `input.voice_focus`, `input.language_codes`, `output.voice`. New schema: `session.updated` -> `session.ready` -> greeting. |
| 2 | Every `session.error` (and a bogus `UpdateConfiguration` frame) started the browser speech engine **on top of** the live agent: two engines listening and speaking. | Code read against the events reference. | Only fatal codes fall back; the bogus frame is gone. |
| 3 | 6 of 8 offered voice ids did not exist. | Voices doc + live `invalid_value`. | Real ids: anna, vera, charles, paul, eve, alba, george, michael. Old names ("Oliver") still resolve by voice command. |
| 4 | Silence "saver" dropped audio frames, starving server turn detection (and billing is per session-hour, so it saved nothing). | Code read. | Removed. |
| 5 | Crisis detector missed 25 of 27 genuine phrasings and every non-English phrase. Medication gate missed 12 of 15. | Adversarial probe. | Rewritten: English, 30+ languages, spacing-evasion; 55 positive/negative unit cases plus HTTP-level tests. |
| 6 | "Delete all my data" left memory, calibration and voice prefs; cloud delete reported success without checking errors and used the anon key as a service key. | Code read. | Wipes every `stay_*` key (except user-entered Supabase config), acts as the user under RLS, reports failure. |
| 7 | Orb smoothing used per-frame constants (speed varied with refresh rate); audio meter caused hundreds of React renders per second. | Code read; measured after fix: p95 frame 16.7 ms, 0 long tasks. | dt-based easing, asymmetric attack/release, critically damped shape spring, 20 Hz state throttle, pause offscreen, adaptive DPR. |
| 8 | Landing hero orb rendered over the card text; orb popped in blank. | Screenshot. | Sized and contained; placeholder crossfade. |
| 9 | Dead `HeroSignal` component faked "Listening" with random energy. | Code read. | Deleted. |

## Live voice measurements (AssemblyAI Voice Agent, synthesized speech, no microphone)

Speech was synthesized with neural TTS and streamed in real time into live sessions. **This is not a human microphone test.**

- Transcribe + reply, auto-detect, no `language_codes`: **en, es, fr, de, it, hi, ko, ja all transcribed correctly and replied in kind.** pt transcribed with errors ("às semanas", "pronto como estar").
- Time to first reply audio after end of speech: about 1.0 to 2.6 s (hi 1.0 s, ja 0.1 s, it 2.6 s).
- Client tool from speech: `start_focus_timer {minutes: 15, firstStep: "open the tax folder"}` received.
- Barge-in: `input.speech.started` fired about 1.1 s after the user began speaking and `reply.done interrupted` about 2.7 s. Changing `vad_threshold` / `interruption_delay` did not improve this. The client stops local playback on `input.speech.started`, so audible overlap is about 1.1 s plus network.

Docs list only en/es/fr/de/it/pt for the Voice Agent API; the probe shows more work in practice. UI copy now says "9 languages verified live" and is not a "32 languages" claim. The 32-language browser/text paths (language detect, localized plans) are unchanged and are separate from live voice.

## Gates

- `tsc --noEmit`: 0 errors
- `vitest run`: 167 passed
- `next build`: 19/19 routes
- `playwright test`: 24 passed, plus 11 layout/fluidity tests (9 widths 320 to 1920, hero overlap, square canvas, 60 fps-class pacing)

## Not verified

- A real human microphone and speakers (echo, AEC leakage, earphone buttons).
- Real GPU frame pacing on a phone (measured in headless Chromium with software GL).
- Supabase Auth / Google OAuth / RLS against a real project (no credentials exercised).
- Keys used for probes came from `.env.local`; rotate any key that has been pasted into chat.
