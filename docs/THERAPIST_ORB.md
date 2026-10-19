# The therapist orb

While Stay speaks, the orb's dots pour into a calm, warm, gender-neutral person (hair, head, neck, shoulders) whose mouth follows the agent's real audio, then pour back into the topical shape. Everything is dots: no image, no SVG, no video, no external asset, no new network call.

Screenshots are in [`docs/therapist-orb/`](therapist-orb/): [`morph-sheet.png`](therapist-orb/morph-sheet.png) (sphere to person and back, one frame every 150 ms), `*-0-sphere`, `*-1-mid-morph-a`, `*-2-idle`, `*-3-speaking-open-*` for desktop (5,200 dots) and phone (3,200 dots).

## When she appears

Rules live in `src/lib/orb/presence.ts` (pure, unit-tested); `useOrbPresence.ts` feeds them the live voice state.

| Event | Orb |
|---|---|
| Stay starts speaking | becomes the person, stays while audio is audible, lingers 2.6 s, then returns to the topical shape |
| Face button tapped (`data-testid="face-toggle"`, `aria-pressed`) | becomes the person and stays until tapped again |
| You start talking (partial transcript, or barge-in) | back to the topical shape; a pin is released |
| A keyword shape fires (typed, spoken, or the agent's `show_shape`) | that shape wins, even mid-reply; she returns on the next reply |

"Audible" is the playback clock, not the protocol: the agent's `reply.done` can arrive seconds before its queued audio finishes, so the figure follows `lipSyncBus.active`.

## Lip sync (`lipSync.ts`, `faceAnimator.ts`)

Inputs, all local:

1. **The real output audio.** Each PCM chunk that `scheduleAgentPcmChunk` already decodes is also reduced to a 50 Hz envelope: loudness (RMS) and brightness (share of high-frequency energy in the first difference). Frames are stored against their scheduled `AudioContext` time and read at `currentTime - outputLatency`, so the mouth follows what is being heard now, not what has merely arrived. The push happens after `source.start()`, so it cannot delay playback.
2. **The text being spoken, where we have it.** Fast voice emits `reply.text` for each sentence before its audio. Vowel groups become mouth shapes (AA, EH, IH, EE, OH, UH, OO); each detected syllable onset advances to the next one; an m, b or p after the vowel closes the lips in the gap that follows. The managed agent only sends text at the end of a reply, so it runs audio-only: dark sound opens the mouth, bright sound (s, f, ee) narrows and spreads it.
3. **Fallback.** With no audio timeline (the browser speech-synthesis path), the existing energy level drives the mouth.

Silence returns the mouth to rest. Blinks (every 2.4 to 5.8 s), breathing, head tilt/nod/sway, brow lift on emphasis and slow glances are ambient and run in the same animator. A barge-in or disconnect calls `lipSyncBus.reset()`.

This is a heuristic, not phoneme alignment: it knows English-like spelling only, and another script falls back to the audio-only mapping.

## The figure (`human.ts`)

Built once per dot count (105 ms for 5,200 dots and 67 ms for 3,200 on this machine, 337 ms on a 4x-throttled phone profile; scheduled in `requestIdleCallback`) from the same signed-distance parts as every other shape, plus a best-candidate sampler (even stipple instead of random clumps), per-dot lighting from the upper left, and a per-dot **rig**: `(role + 0.01 + headWeight * 0.98, a, b, c)`.

| Role | Dots | What the vertex shader does |
|---|---|---|
| 1 upper lip | lips, philtrum | lifts with mouth open; widens with `wide` |
| 2 lower lip / jaw | lips, chin, lower cheeks | drops with mouth open |
| 3 mouth inside | dark dots on the lip line | spread open and shown only when the mouth is open |
| 4 eye | outline, lid, iris | blink collapses them onto the eye line; glances shift them |
| 5 brow | brows | lift |
| 6 torso | shoulders, collar | breathe |
| 7 detail / 8 hair | nose; hair | rigid (smaller / bolder dots) |

Head motion is a tilt about the base of the neck weighted by `headWeight` (1 on the head, ramping to 0 at the shoulders). Voice-driven radial wobble is switched off on figure dots so speech cannot scramble the face.

## Jelly transitions (`morph.ts`, `OrbParticles.tsx`)

- Each dot follows an under-damped spring (zeta 0.58, about 10% overshoot, exactly 1 at the end) from its own start time. Start time is 60% distance from the centre of the destination (so the face forms first and the shoulders follow) and 40% random.
- A body-wide squash/stretch spring (`JellySpring`) is kicked when a morph starts and again when most dots have landed, so the whole figure wobbles and settles.
- During flight dots ride a coherent current (neighbours move together) plus small per-dot scatter.
- Retargeting mid-flight continues from where each dot is; a departing figure keeps animating (a closing mouth, a breath) while it leaves, so nothing snaps.
- The shader's easing is generated from the same constants as the TypeScript (`MORPH_GLSL`), and a unit test pins that.

## Reduced motion

`prefers-reduced-motion: reduce` turns travel, spring, wobble, breathing, blink, head motion, brow and glances off. A new shape cross-fades (the old dots fade out in 160 ms, the new ones fade in over 240 ms). The mouth still moves with speech because it is the speech cue, at 60% amplitude and a slower response. Tested in `tests/e2e/therapistOrb.spec.ts`.

## Adding a shape

1. **A drawn shape** (most cases): add an entry to `LIBRARY` in `src/lib/orb/library.ts`: an `id`, the `words` that summon it (English words match on word boundaries, other scripts on substrings), a `palette` and `parts` from the drawing language in `sdf.ts` (`circle`, `ellipse`, `rect`, `poly`, `line`, `ring`, `blob`; `sub: true` cuts a hole). `tests/unit/orbShapes.test.ts` runs every library entry through the sampler automatically. Jelly transitions, keyword matching and the orb tests apply with no further work.
2. **A word with no drawing**: add it to `EMOJI_WORDS` in `emojiWords.ts` (the emoji's own colours become the dots), or do nothing: the shape service and the procedural fallback already make something for any word.
3. **A shape with its own animation** (like the person): build an `OrbTarget` with `points`, `cols` and a `rig` (4 floats per dot), as `getFigureTarget()` does, add a role to `rigOffset` in the vertex shader in `OrbParticles.tsx`, and drive its uniforms from a small animator like `FaceAnimator`. `OrbTarget.waveCenter` sets where the pour starts.

## Measured (headless Chromium, production build, `tests/e2e/therapistOrb.spec.ts` with `ORB_PERF=1`)

Frame intervals sampled for 3 to 4 s in each phase: sphere at rest, morphing into the person, the person idle, the person speaking. Raw JSON is in `docs/therapist-orb/frame-times-*.json`.

| Profile | Dots | Rendering | Result in all four phases |
|---|---|---|---|
| Desktop viewport, DPR 1 | 5,200 | SwiftShader (software GL) | 60 fps, p99 under 25 ms; one 36 ms frame in 168 while morphing |
| Phone viewport 390 px, DPR 2 | 3,200 | SwiftShader | 60 fps, p99 under 19 ms, 0 frames over 33 ms |
| Same, CPU throttled 4x | 3,200 | SwiftShader | 60 fps, p99 under 25 ms, 0 frames over 33 ms |
| Same, CPU throttled 6x | 3,200 | SwiftShader | 60 fps, p99 under 25 ms, 0 frames over 33 ms |
| Desktop, headed, real GPU | 5,200 | Intel UHD (D3D11), 144 Hz display | about 144 fps, 1 frame over 33 ms (39.7 ms, during a morph) |

`render()` costs 0.1 to 0.2 ms of main-thread time per frame at 1x and about 1 ms at 6x throttle.

During a live voice session, a generic requestAnimationFrame meter on the same 390 px, DPR 2 profile (development server, so slower than production) held 60 fps with zero dropped frames at 1x and 4x CPU throttle on both the old orb and the new one. At 6x both dropped frames (old: 6 to 12 of about 240 in 4 s, new: 3 to 18); the two ranges overlap, so no regression is claimed or ruled out at that setting. The development server is not the product build; on the production build the figure phases above showed no drops at 6x.

### What these numbers are not

They are not a physical phone. CPU throttling slows the page's JavaScript, not the GPU; SwiftShader is a CPU renderer, so the GPU cost on a real mid-range phone GPU is unmeasured here. The only real-GPU reading is the one headed run on a laptop iGPU.
