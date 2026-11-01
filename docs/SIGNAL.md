# STAY Signal: orb, wave and voice state as one system

One visual language for what the voice session is really doing. The wave is driven by two real sources and the
state the app already tracks; it never runs on a timer that could disagree with the audio.

## Architecture

```
 microphone ──► capture worklet (public/pcm-processor.js) ── posts { type:'energy', rms }
                                                     │
                                                     ▼
                                  useVoiceAgent.ts ── signalBus.setInput(rms)     (module state, no React render)
                                                     │                             reset() when capture stops
 AssemblyAI TTS ─► ContinuousPcmPlayer ─► onAudioRendered ─► lipSyncBus.pushChunk  (envelope of audio being PLAYED)
        barge-in / cancel ─────────────────────────────────► lipSyncBus.reset()   (envelope cleared at once)

 VoiceVisualState (existing) ─────────────┐
 signalBus.input()  (0 when stale) ───────┼──► signalModel.ts   lookFor(state) · targetDrive() · smoothDrive()
 lipSyncBus.now()   (0 after a cancel) ───┘          │  pure, unit-tested
                                                     ▼
                                   SignalWave.tsx (canvas, one rAF loop per instance)
                                   · tapered 3-strand ribbon · pauses when hidden or offscreen · DPR cap 2
                                   · 30 fps on small devices · static under prefers-reduced-motion
```

Rules enforced in `src/lib/signal/signalModel.ts` and covered by `tests/unit/signalModel.test.ts`:

| State | Wave source | Motion |
|---|---|---|
| listening, transcribing | microphone level only | follows the level; flat below the noise floor (0.02) |
| speaking, backchannel | audible assistant audio only (never the microphone) | follows the level that is actually being played |
| thinking | none | slow travelling highlight, warm tint, no amplitude |
| connecting, reconnecting | none | slow travelling highlight |
| interrupted, paused, text_only_fallback | none | flat at once, no release tail |
| error | none | flat, danger tint |
| idle, complete | none | only a slow breath (3.6 s), not audio |

Smoothing: attack 60 ms; release 220 ms for the microphone and 110 ms for assistant output (assistant audio stops being
audible the instant playback stops). Nothing is routed to the speakers for visualisation, and no extra FFT or
resampling is added: the two sources already existed for lip-sync and the capture path.

## Where it appears

| Place | Component | State source |
|---|---|---|
| Call Stay (ringing, connected, muted) | `CallStayOverlay` | `connecting` while ringing, `paused` when muted, otherwise the voice state |
| Voice dock on /app/today | `SignalWave` (28 px) | `visual` state |
| Landing hero (decorative) | `SignalWave` under the orb | `idle` or `thinking`; fed zero levels, so it never shows live audio |
| Focus timer | `WaveProgress` | the real timer progress (not audio) |
| Landing demo video seek bar | CSS | real video; glowing handle, blue progress, neutral track |

The call screen also has: a captions toggle (user partial or last user line; assistant words as they are rendered, from
`liveSpokenText`), the transport badge with diagnostics, safe-area padding, the real 10-minute cap and silence
check-ins, and a ringback tone that stops when the session connects.

## Tokens (Stay Tide)

Base `#08090B`, Charcoal `#222326` (cards), Surface `#353537`, Buttons `#5A5B5C`, Blue light `#85B6FF`, Blue core
`#397CE8`, Glow ring `#D9EEFF`, Track `#C9C9C9`. Contrast (computed, WCAG) on cards: ink 14.4:1, ink-2 9.5:1,
muted 7.3:1, accent 7.6:1, danger 6.9:1. Motion: press 120 ms at scale 0.97, small transitions 140 ms, idle breath
3.6 s, ease `cubic-bezier(0.23, 1, 0.32, 1)`, transform and opacity only, reduced motion stops the drift and the wave.

## Changelog (this work)

- Added `src/lib/signal/signalBus.ts`, `src/lib/signal/signalModel.ts`, `src/components/signal/SignalWave.tsx`.
- `useVoiceAgent.ts`: writes the real microphone level to `signalBus`; resets it when capture stops.
- `CallStayOverlay.tsx`: rebuilt on `SignalWave`; captions toggle; transport diagnostics; safe-area insets.
- `StayHome.tsx`: compact wave in the voice dock. `Hero.tsx`: decorative wave under the orb.
- `landing.css`: demo seek handle restyled. Theme tokens remapped to the supplied palette.
- Tests: `tests/unit/signalModel.test.ts` (14), `tests/e2e/signal.spec.ts` (5).

## Evidence (real)

- Unit and browser results: see the final report; run the commands below to reproduce.
- Screenshots: `docs/evidence/signal/*.png` (landing desktop and mobile, voice idle, call ringing, connected, muted,
  mobile call, reduced-motion hero). Captured by `tests/e2e/signal.spec.ts`, not edited.
- Frame rate: `docs/evidence/signal/perf-<sha>.json`. Headless Chromium on the development machine, 3 s of
  `requestAnimationFrame` with the wave running: 60.3 fps average, 16.8 ms worst frame. This is not a phone benchmark.
- Audio linkage: the E2E test drives the fake provider, waits for the `speaking` state, and asserts the wave's
  measured drive is above 0.05, then interrupts and asserts the wave leaves `speaking` after the real TTS `Cancel`.

## Known limitations and things not done

- **Real microphone and real ears:** nothing here was tested with a human voice or a real speaker. The browser tests use
  a fake provider and Chromium's fake microphone. Please test a real call.
- **Browsers:** Chromium only (the Playwright config has one project). WebKit and Firefox were not run.
  Low-power, no-WebGL and no-AudioWorklet paths are covered by existing fallbacks and tests, not by new Signal tests.
- **Not built:** separate `SignalOrb`, `SignalGlow`, `SignalStage` and `useSignalMotion` modules; an immersive full-screen
  voice mode; onboarding and voice-preview signals; scroll choreography; audio output-device selection (not offered,
  because it is not wired); a recorded-media control for voice history (there are no recordings, and none were faked).
- **Orb coupling:** the existing particle orb still follows `audioEnergy` (shared level), not the separate
  input/output sources. The wave is the part that distinguishes them.
- **Palette:** the supplied graphite-and-blue palette replaced the earlier warm stone and teal theme app-wide at the
  owner's request. The brief suggested keeping teal; restoring it is one revert of the theme commit.
- Existing demo video was recorded before the theme change and still shows the old look.

## Run and verify locally

```bash
npm ci
npx tsc --noEmit
npx vitest run
npm run build
npx playwright test --reporter=line          # includes tests/e2e/signal.spec.ts and regenerates docs/evidence/signal
npm start                                    # then open /app/today and press Call Stay (needs a real microphone and key)
```

## Deployment readiness and rollback

Pushing `master` deploys to Vercel production automatically (about 1 to 3 minutes). To roll back: `git revert <commit>`
and push, or promote the previous deployment in the Vercel dashboard. The theme and Signal work are separate commits
(`0e615a0` theme; the Signal commit after it), so either can be reverted alone. Env needed: `ASSEMBLYAI_API_KEY`
(server only); no new variables were added.
