# Submission pack: Stay (AssemblyAI Online Hackathon #2)

Everything here is checkable in the repo. Numbers come from `docs/STAY_VERIFICATION_2026-10-18.md`, `tests/`, and `README.md`; limits are stated where the evidence stops.

## Links

- Live app: https://stay-two-swart.vercel.app
- Repo: https://github.com/vaibhav4046/stay
- Demo video: https://stay-two-swart.vercel.app/demo/stay-demo.mp4 (also embedded on the landing page, with captions and chapter seeking)
- Submission form: https://forms.gle/NtYDsi3bgqMDK29j9

## One line

A voice companion for adults with ADHD that gets you from "I can't start" to a two-minute first step, with turn-taking patience, an expressive dot-drawn therapist orb, and zero guilt.

## Description (paste into the form)

Adults with ADHD rarely lack the wish to start. They get stuck at the threshold: too many steps, no clear first one, a wall of guilt. Stay is a voice-first companion built specifically for that moment. You say the thing you are avoiding, in whatever mess it comes out; Stay names what makes it hard and gives you one concrete step you can start in two minutes, then runs a short block with you and checks in when it ends.

It is built around how neurodivergent adults actually talk:
1. **Turn-taking patience:** Stay waits through a 2.5–3.0 second mid-thought pause instead of talking over it (where ChatGPT Voice and Gemini Live interrupt prematurely).
2. **Instant barge-in:** If you interrupt, Stay cuts playback and flushes its pipeline in under 0.45 seconds.
3. **Therapist Orb:** A 5,200-dot procedural WebGL/SDF bust that morphs between fluid shapes and a calm human figure with real-audio lip syncing, eye glints, and breathing cues.
4. **Agentic Voice Brain Dump:** Dump a scattered pile of worries by voice; Stay parses them live into Today, Later, and Parked, and speaks back exactly ONE 2-minute step to start right now.
5. **Self-Improving Memory with Consent:** Tracks what strategies and times work best for you, attaches clear derivation evidence ("Learned from session on Oct 19"), and lets you pin, edit, delete, or turn learning off anytime.
6. **22 Honest Voices:** Culturally accurate Indian English (Cardamom, Chaiwala) and Mexican Spanish (Taco, Mariachi) with multi-engine adapters (AssemblyAI + Web Speech API + Azure Neural BYOK), replacing mismatched personas.
7. **Complete Ecosystem:** Available on Web, Desktop (Electron app with global shortcut `Ctrl+Shift+Space`), Mobile (Capacitor Android with native haptics), and Browser Extension (Manifest V3 quick thought-parking).

The voice is AssemblyAI end to end. The default "fast voice" engine uses AssemblyAI streaming speech-to-text (`universal-3-6-pro`) straight from the browser, a gated speculative execution pipeline for low reply latency, and AssemblyAI streaming text-to-speech, emitting the same events as the Voice Agent API so one hook drives both. The managed Voice Agent API is preserved as the automatic fallback.

Safety is deterministic and runs before any model: crisis wording (30+ languages) stops coaching and shows emergency numbers and a findahelpline fallback; medication and dose questions get a fixed reply that points to a prescriber. Data stays in the browser by default, with one-click export and delete. You can bring your own keys (Groq GPT-OSS, Mistral, OpenAI or any OpenAI-compatible address, Azure Speech, and AssemblyAI).

## Where the AssemblyAI platform is used

| Piece | Use |
|---|---|
| Streaming STT v3, `universal-3-6-pro` | Browser-direct, ephemeral token minted by `/api/voice/fast-token`. End-of-turn about 0.31 s measured. `keyterms_prompt` biases ADHD task and strategy vocabulary. |
| Streaming TTS | Browser-direct chunked audio. Protocol probed and wrapped with volume/brightness envelope extraction driving the real-time lip-sync rig. |
| Voice Agent API | Managed engine and automatic fallback; also the baseline in every comparison. |
| Tokens | Ephemeral short-lived credentials minted by server routes; secrets never exposed to clients. |

## What is verified (and how)

- **Unit tests:** 625 passing tests across 36 test files (`npm test`). Typecheck clean.
- **Browser tests:** Playwright against production build (`tests/e2e/`), covering Core loop, Landing page, Responsive layout (320px–1920px), Safety & CSP, Therapist Orb, Voices, and Multi-platform Ecosystem.
- **ADHD Clinical / Agentic Evaluation:** 29 scripted scenarios in `scripts/voice-e2e/agentic-eval.mjs` (137 of 137 checks passing, 100% pass rate) verifying safety gates, 2-minute task shrinking, brain dump controls, and tone hygiene.
- **Voice Benchmarks (Simulated Human Speaker Rig):**
  - Fast voice reply latency: ~1.25s - 1.45s median.
  - Mid-thought pause patience: 100% waited through 2.3s - 3.0s trailing pauses.
  - Interruption latency: 0.42s - 0.54s.
  - Response length: 4 to 8 seconds maximum (concise, actionable).
- **Security:** Strict CSP on every route, SSRF guard with DNS pinning on custom provider URLs, no shared data cache.

## Ecosystem Artifacts

- **Desktop App:** `apps/desktop/` (Electron, packaged executable at `apps/desktop/dist/Stay-1.0.0-win-x64.exe`).
- **Mobile App:** `apps/mobile/` (Capacitor Android & iOS wrappers with native haptics).
- **Chrome Extension:** `apps/extension/` (Manifest V3 quick thought capture popup).
- **PWA:** Installable web app with service worker offline cache and Web Share Target.
