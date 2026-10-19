# Architecture

Stay is a Next.js 15 (App Router, React 19, TypeScript, Tailwind v4) web app. Almost everything runs in the browser; the server is a thin layer that holds keys, applies the safety gates and relays to a language model.

```
 microphone ──► AudioWorklet (24 kHz, 16-bit, 50 ms chunks)
                      │
                      ▼
              FastSocket (src/lib/voice/fastSocket.ts)       emits the Voice Agent's own events,
              ┌───────────────┬──────────────────┐            so the voice hook, tools, memory,
              │ speech-to-text │  chat model      │  speech    safety and orb are shared by both engines
              │ AssemblyAI v3  │  /api/voice/chat │  AssemblyAI
              │ wss, browser-  │  (SSE, one `app` │  streaming TTS
              │ direct, short- │  tool) -> Groq   │  wss, browser-direct
              │ lived token    │  or your own key │  Generate / Flush / Cancel
              └───────┬────────┴────────┬─────────┘
                      │ turn events     │ reply text, tool calls
                      ▼                 ▼
              useVoiceAgent (hook) ── runAppAction ──► screens, timer, routines, today list,
                      │                                  parking lot, check-ins, memory, orb
                      ▼
              playback queue ──► speakers          fallback: AssemblyAI Voice Agent (managed)
```

## Voice

* **Fast voice (default)** for English, Spanish, French, German, Italian and Portuguese. Speech-to-text is Universal-3.6 Pro streaming over a WebSocket opened by the browser with a token minted by `/api/voice/fast-token`. Turn handling is in `FastSocket`: partials drive the orb and captions, `end_of_turn` starts the reply, a turn that ends on "um", a connector or a comma is held for 2.2 s and merged with what follows (patience for ADHD pauses), two words over Stay's own speech cancel it, a single stray word does not.
* **The brain** is `/api/voice/chat`: safety gates first (crisis, medication), then a streamed chat completion. Default model is `openai/gpt-oss-120b` on Groq; a person's own key (Groq, Mistral, OpenAI, any public https OpenAI-compatible address) is used first when present. One compact tool, `app`, carries every action so each extra capability does not add reply latency.
* **Speech** is AssemblyAI streaming text-to-speech (protocol found by probing: `Generate`, `Flush`, `Cancel`, `Terminate`; audio is base64 PCM 24 kHz; voice and language are query parameters). The first clause of a reply is spoken as soon as it exists; simple actions are confirmed at once with a canned line instead of a second model call.
* **Standard voice** is AssemblyAI's managed Voice Agent API. It is the automatic fallback when fast voice cannot start, and the engine for every other language.

## Safety layer

`src/lib/safety/crisis.ts` is deterministic and multilingual. It runs in the browser on every transcript and typed message, and again on the server in `/api/coach/plan`, `/api/coach/triage`, `/api/voice/chat` and `/api/orb/shape` before any model sees the text. Crisis wording stops coaching and opens help; dose and medication questions get a fixed reply that points to a prescriber. Voice can never delete data: "delete my data" only opens Settings.

## Data

Everything a person creates is in `localStorage` under `stay_*` keys (profile, sessions, memory, calibration, voice preferences, today list, parked thoughts, routines, reminders, their own API keys) and is wiped by "Delete all my data". Optional Supabase sync is row-level-security protected and off by default. The server stores nothing about conversations.

## Server routes

| Route | Job |
|---|---|
| `/api/voice/fast-token` | Two short-lived AssemblyAI tokens (speech-to-text, text-to-speech); 30 min sessions on the shared key, 3 h on a person's own key |
| `/api/voice/chat` | Streaming reply and tool calls; warm-up `GET` |
| `/api/voice/token` | Voice Agent token (fallback engine) |
| `/api/coach/plan` | First step, strategy and block length (no shared cache) |
| `/api/coach/triage` | Brain dump into one thing now, a few for today, the rest later; deterministic fallback |
| `/api/orb/shape` | Names the best emoji for a word the library does not have; only keywords, never sentences |
| `/api/keys/check` | Tests a person's own key with one tiny call |
| `/api/account/delete` | Deletes cloud rows when signed in |

Own-key requests: https only, no URL credentials, redirects never followed, the host is resolved and refused if any answer is private (`src/lib/llm/provider.ts`), 120 requests a minute per address. Shared-key requests are limited per address. These limits are in-memory per server instance; a production deployment needs a shared store (stated here so nobody assumes otherwise).

## The orb

One field of 3,200 to 5,200 dots drawn with Three.js points. A shape is a different target for the same dots. Sources, fastest first: 38 hand-built shapes from a small signed-distance drawing language (tangle, stairs, battery, target, list, coin, envelope and others), an offline word table, the shape service, a deterministic rosette. Only dots are drawn.

## Front end

Mobile-first shell (bottom tab bar on phones, header on desktop, Urgent help always in the header). A service worker keeps the shell available offline. Content-Security-Policy restricts scripts, styles, fonts and connections to what the app uses.

## Tests and evidence

378 unit tests (vitest), 50 browser tests (Playwright) and the voice harnesses in `scripts/voice-e2e/` (`sim-human.mjs`, `cascade-bench.mjs`, `compare-bench.mjs`, `force-endpoint-probe.mjs`, `fast-app-bench.mjs`). Raw outputs of the simulated-speaker runs are in `docs/bench-results/`. Method, sources and corrections are in `RESEARCH_VOICE_LATENCY.md` and `STAY_VERIFICATION_2026-10-18.md`.
