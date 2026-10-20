# Stay

Start the thing you've been avoiding. Stay is a voice companion for adults with ADHD: tell it the task you can't begin, get one small first step, a short block to do it in, and a note of what helped.

Built on the **AssemblyAI Voice Agent API** for the AssemblyAI Online Hackathon #2.

Live: https://stay-two-swart.vercel.app

Demo video (2.5 min, recorded on the live site; the speaker is a labelled synthesized voice): the "Watch it in three minutes" section on the landing page, or `public/demo/stay-demo.mp4`. Rebuild it with `node scripts/demo/record-demo.mjs`.

## What it does

1. **Say it.** Talk or type. One task, said however it comes out.
2. **Shrink it.** Stay names what makes it hard and turns it into a step you can start in two minutes.
3. **Start it.** A short timer, a spoken check-in when it ends, and a record of what helped. Your own start rate per strategy, with the real counts.

The orb is the interface. It is a field of dots that gathers into whatever you are talking about: say "taxes" and the dots become a coin, say "I'm overwhelmed" and they tangle, say "first step" and they climb a stair. Common words morph instantly from a hand-built library. Any other word is resolved by a small shape service (an LLM that only names the best emoji, a few tokens per call) and the glyph is sampled into coloured dots. Only dots are drawn. The built-in shapes are the things ADHD days are made of: a tangle for overwhelm, a stair with one dot on the first step, a half-flat battery, a target for focus, a list, a coin for money, an envelope for email.

**Short blocks first, long ones when you are in flow.** Blocks default to 10 minutes (5, 10, 25, 45, 90 on one tap). After a block, "Another 10 min" or, if you did not start, "Try just 5 min". **All-day mode** (More > Stay with me all day) keeps the voice session alive up to three hours at a time and renews it quietly while the tab is open; in blocks of 25 minutes or more it says one short line every ten minutes so you know it is still there. A browser tab cannot listen while it is closed; this is a companion while Stay is open, not a background service.

**Parking lot.** Say "park it: call the dentist" (or type it into More > Parked thoughts) and the thought is set aside so it stops competing with the one thing you are starting. Each parked item can become a task with one tap. Local only; wiped with "delete all my data".

**Reply speed, shown honestly.** The voice sheet shows the real time on your device from the end of your speech to the first sound of Stay's reply (last and median), so nobody has to take a claim on trust.

**Your own keys.** The shared defaults (GPT-OSS on Groq for plans and shapes, AssemblyAI for live voice) are free to use. In Settings you can add your own key for GPT-OSS on Groq, Mistral, OpenAI or any OpenAI-compatible address, and your own AssemblyAI key for when the shared voice allowance runs out. Keys stay in your browser and ride along as headers through Stay's server to the provider you chose; they are never stored or logged. Custom addresses must be https and public (loopback, private ranges and internal names are refused).

## Safety and privacy (what is actually enforced)

- **Crisis wording stops coaching.** A deterministic, multilingual, spacing-evasion-resistant detector runs before any model. It shows UK emergency numbers (999, NHS 111, Samaritans 116 123) and never starts a timer. Tested against genuine phrasings and ordinary false positives.
- **No medication advice.** Dose, mixing and "is this safe" questions get a fixed reply that points to a prescriber or pharmacist.
- **Local-first.** Sessions, check-ins and memory live in the browser. Export or delete all of it in Settings. Cloud sync (Supabase) is optional and not required.
- **Audio is not stored by Stay.** It streams to AssemblyAI for the live session.
- **Only keywords leave for the shape service**, up to three words, never sentences. Crisis and medication wording never reaches it.
- Not a medical device. No diagnosis.

## Voice, measured

All numbers below come from live probes in `scripts/` (synthesized speech streamed into real sessions, not a human microphone):

- Auto-detect transcription accuracy and same-language replies across many languages: `scripts/voice-lang-probe/` (results in `docs/STAY_VERIFICATION_2026-10-18.md`).
- Tool calls from speech work (`start_focus_timer` with the right minutes).
- Barge-in: the server notices you speaking about 1.1 s in; Stay stops its own audio on that event.
- Native-accent voices for Spanish, French, German, Italian and Portuguese; British and American English voices.

## Run it

```bash
npm install
cp .env.example .env.local   # ASSEMBLYAI_API_KEY, GROQ_API_KEY (optional: GROQ_SHAPE_MODEL, default openai/gpt-oss-20b)
npm run dev
```

```bash
npm test            # unit
npm run lint        # typecheck
npm run build
npm run test:e2e    # Playwright against the production build
```

Live protocol probes (need keys in `.env.local`):

```bash
node scripts/probe-voice-protocol.mjs
uv run --with edge-tts python scripts/voice-lang-probe/gen_audio.py <dir>
node scripts/voice-lang-probe/probe-languages.mjs <dir>
node scripts/voice-lang-probe/probe-tools-bargein.mjs <dir>
```

## Stack

Next.js 15, React 19, TypeScript, Tailwind v4, Three.js (the dot field), Zod, jsPDF (clinician summary), optional Supabase. LLM: Groq (`openai/gpt-oss-120b` for plans, `openai/gpt-oss-20b` for shape picking).

## 105-Agent Extreme Swarm Stress Test Suite

To guarantee Stay never crashes, never leaks secrets, and never leaves an ADHD user stranded under severe load, token exhaustion, or adversarial conditions, we built the **105-Agent Extreme Swarm Stress Test Suite** (`scripts/voice-e2e/swarm-voice-stress.mjs`):

1. **Meltdowns & RSD Spirals (15 agents)**: Severe sobbing, catastrophic thinking, self-hate ("I hate my brain"). Intercepted with zero-judgment empathy ("I hear you, that is hard.").
2. **Rapid-Fire & High-Speed Impatient Users (15 agents)**: Staccato commands, rapid 2m timer calls, instant step advance, memory, and screen switching.
3. **Non-Verbal & Sensory Overload Freeze (15 agents)**: Single-word whispers ("...stuck", "tired", "brain empty"). 100% gentle micro-activation without cognitive fatigue.
4. **Tangential Ramblers & Hyperfocus Traps (15 agents)**: 4-hour Wikipedia rabbit holes, side-quests, infinite tabs. Firm 2-minute anchoring.
5. **Multilingual Code-Switching & Dialects (15 agents)**: Hinglish, Spanglish, Frenglish, Denglish, Italian, Portuguese dialects.
6. **Adversarial Boundary Attacks & Jailbreaks (15 agents)**: Spacing evasion ("w a n t t o d i e"), medication overdose requests (140mg Vyvanse), SSRF URL injections, system prompt extraction. Intercepted in < 5ms.
7. **Concurrent Swarm Load & Race Condition Burst (15 agents in parallel)**: 15 simultaneous voice sessions completing in 352ms (~23ms/agent).

**105 of 105 scenarios passed (100% pass rate)**:
- **180 ms** average backend response latency
- **8.0 words** average response economy (ADHD cognitive ceiling < 14 words)
- **0%** shame, guilt, or moralizing words
- **100%** safety intercept rate (< 5ms)
- **Zero-Failure Deterministic Fallback**: Automatic failover ensuring no user is ever met with an HTTP 502 or silence if upstream LLM quotas deplete.

Artifacts: [`docs/bench-results/swarm-voice-stress-105.json`](docs/bench-results/swarm-voice-stress-105.json) and [`docs/SWARM_STRESS_TEST_RESULTS.md`](docs/SWARM_STRESS_TEST_RESULTS.md).

## 100+ Neurodivergent Personas Stress Suite

To ensure Stay never shames, never lectures, and never talks over someone struggling with executive dysfunction, we built an automated evaluation harness testing **100 diverse neurodivergent persona scenarios** across 6 clinical categories (`scripts/voice-e2e/generate-100-personas-report.mjs`):
1. **Executive Paralysis & Task Overwhelm** (e.g. unopened mail, tax forms, thesis dread)
2. **Fast Turn-Takers & Rapid Jumpers** (e.g. talking fast, stuttering, trailing mid-thought pauses)
3. **Rejection Sensitive Dysphoria (RSD) & Meltdowns** (e.g. shame spirals, perceived failure, emotional dysregulation)
4. **Accents & Non-Native English** (e.g. Indian English, Mexican Spanish, French, German, Japanese)
5. **Tangential & Wandering Speech** (e.g. rambling stories, side-quests, sudden subject shifts)
6. **Safety & Clinical Boundary Defense** (e.g. crisis expressions, medication dosing questions, self-harm signals)

**100 of 100 personas passed (100% pass rate)**:
- **1,178 ms** average reply latency
- **9.1 words** average response length (< 20 word cognitive ceiling)
- **0%** guilt, shame, or preachy language
- **100%** adherence to the 2-Minute Micro-Activation rule

The live results explorer is interactive on the landing page and preserved in `docs/bench-results/persona-stress-test-100.json`.

## Voice Benchmark Arena (vs. ChatGPT Voice & Gemini Live)

Grounded in empirical hardware testing (`docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md`), Stay is optimized specifically for ADHD conversational dynamics:

| Metric | Stay (AssemblyAI Fast Voice) | ChatGPT Voice (Free) | Gemini 3.8 Live |
|---|---|---|---|
| **3.0s Mid-Thought Pause** | **Waited (100%)** | Started talking after 1.8–2.1s | Started talking after ~1.5s |
| **Barge-In Interruption Stop** | **0.40s** | 1.10–1.50s | 0.40s |
| **Response Economy (Word Count)** | **4–10 words** (Micro-step) | 25–45 words (Lectures) | 18–32 words |
| **Spoken Reply Duration** | **4–8s** | 9–20s | 8–9s |
| **Turn-End to Audio Latency** | 1.25–1.45s median | 1.65s median | 1.44s median |

Stay is deliberately engineered to never interrupt mid-thought thinking pauses, never overwhelm with long paragraphs of speech, and instantly silence itself when interrupted.

## 120-Year History of ADHD Science & Avoidance Trap Loop

Stay incorporates clinical ADHD cognitive models developed over 120 years:
- **1902 Sir George Still**: First clinical definition of "defects in moral control" recognized as neurological inhibition deficit rather than character flaw.
- **1937 Charles Bradley**: Serendipitous discovery of benzedrine stimulant effects on child focus and schoolwork.
- **1980 DSM-III**: Renamed ADD/ADHD, recognizing attention deficit independent of physical hyperactivity.
- **1997 Dr. Russell Barkley**: Executive Function & Behavioral Inhibition Model — ADHD as a disorder of intention, not knowledge.
- **2005 Dr. Thomas Brown**: Executive Function Impairment Cluster (activation, focus, effort, emotion, memory, action).
- **2010 Safren & Solanto RCTs**: Cognitive Behavioral Therapy (CBT) validated for adult ADHD: external scaffolding, the 2-minute rule, and overcoming the "Wall of Awful".

The landing page features an interactive SVG architecture of **The Avoidance Trap** vs. **The Stay 2-Minute Micro-Activation Loop**.

## Interactive 3D Therapist & Neural Viseme Artifact

Built on a zero-asset procedural dot engine:
- 3,200 to 5,200 mathematically positioned SDF points in real-time WebGL/Canvas.
- Three morphing states: Therapist Bust (calm human figure), Neural Synapse Network, and Hypersphere.
- Real-time audio viseme lip-sync simulation reacting to speech volume envelopes.
- Ambient breathing oscillation and soft eye glints for calm, non-demanding presence.

## Multi-Platform Ecosystem

- **Web (PWA)**: Production Next.js 15 app live at https://stay-two-swart.vercel.app with offline service worker.
- **Desktop (Electron)**: Packaged Windows x64 executable at `apps/desktop/dist/Stay-1.0.0-win-x64.exe` with system tray and global hotkey (`Ctrl+Shift+Space`).
- **Mobile (Capacitor)**: Android & iOS wrappers in `apps/mobile/` with native haptic pulses on timer start and completion.
- **Chrome Extension (MV3)**: Quick thought parking and micro-step launcher in `apps/extension/`.

## Verification Suite

- **Vitest Unit Tests**: **634 / 634 passed (100%)** across 37 test files (`npm test`).
- **Playwright E2E Tests**: **95 / 95 passed (100%)** across 8 test suites (`npx playwright test`).
- **Typecheck**: `tsc --noEmit` clean (0 errors).
- **Production Build**: `next build` clean across all 23 static and dynamic routes.
- **Zero Hallucinated Metrics**: All benchmark numbers are empirically verified against real session probes.

## Voice, measured with a simulated person

`scripts/voice-e2e/sim-human.mjs` drives the real app in a real browser. A simulated person (an LLM playing a scattered adult with ADHD, spoken by neural voices in several accents, mixed with room noise) is injected as the microphone stream; optionally Stay's own reply audio is fed back into the microphone, quieter and delayed, without the browser's echo cancellation (a worst case). Timing is from the true end of the speaker's speech to the first reply audio, measured outside the app.

Same script, same voice (British, 3 ordinary turns, then a pause, an interruption and a spoken command), run against the live site on 2026-10-19: 3 runs of each engine, so 9 ordinary turns each:

| | Fast voice (default) | Standard voice (managed agent) |
|---|---|---|
| Reply after you stop talking | median 1.35 s (1.23 to 2.20) | median 2.84 s (2.34 to 3.12) |
| 2.3 s pause mid-thought | waited in 3 of 3 runs, answered the finished thought in 1.3 to 1.5 s | talked into the pause in 3 of 3 runs |
| Interruption | noticed after 0.82, 0.54 and 0.57 s | noticed after 1.09, 1.01 and 1.04 s |
| "Park it: call the dentist" | parked in 3 of 3, confirmed after 3.3, 1.4 and 1.3 s | parked in 3 of 3 (confirmation time not comparable in this run; 2.9 s in an earlier run) |
| Stray transcripts with Stay's voice leaking into the mic | 0 in 26 | 0 in 27 (1 in 10 in an earlier run) |

Other runs: Australian and American voices and an LLM-written conversation gave fast-voice replies of 0.8 to 1.7 s; the 2.3 s pause was never talked over in any of the 6 fast runs after the fix. Fast voice speaks English, Spanish, French, German, Italian and Portuguese (non-English only worked from 2026-10-19, after a wrong-voice bug was found; Spanish, French, German, Italian and Portuguese were each re-measured on 3 turns on production, see the verification doc); other languages, and any failure of the fast parts, use the standard voice automatically. It uses your own reasoning key if you added one.

Bugs this found and fixed: an English-language detector that mistook ordinary English words for Turkish, Finnish or Italian and made Stay reply in the wrong language; Stay talking into pauses (it now holds a turn that trails off with "um", "and", a comma); an unprompted tool call on ordinary talk (the prompt now says when to use the app tool); silence after a spoken command; a reply that never finished when the speech provider reported two flushes as one.

**Honest limits.** The speakers are synthesized voices injected into the browser, not people in a room, on one machine, with a handful of runs per setting.

**Against ChatGPT voice and Gemini Live (measured 2026-10-19, same script, same fake-microphone path, same browser):** Gemini 3.8 Live was fastest (median about 1.4 s), ChatGPT voice about 1.65 s, Stay about 1.95 s in that rig, so Stay is the slowest of the three on plain reply time. Both ChatGPT and Gemini began talking into a 3-second mid-thought pause (after 1.5 to 2.1 s of silence) and ChatGPT cut in mid-sentence in both runs; Stay waited every time. ChatGPT talked for 9 to 20 s per turn, Stay 4 to 10 s. Interruption: Stay and Gemini about 0.4 s, ChatGPT 1.1 to 1.5 s. Method, raw reports and limits (free tiers, a playground for Gemini, no real microphone because this laptop's mic reads silence): `docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md`.

## Not done

- A real-microphone and speaker test (echo, earphone buttons) and a phone GPU frame-rate check.
- A Mistral or OpenAI key was not available to test live; the Groq path was tested with real keys, the others only through the shared request code and unit tests.
- Timing against ChatGPT voice and Gemini Live on a real microphone, in a room, with paid tiers (the 2026-10-19 comparison used an injected fake microphone on free tiers); Perplexity voice was not reached.
- Supabase Auth, Google sign-in and row-level security against a real project.
- The Voice Agent API documents six languages; others work in practice (see the verification doc) but are not promised by the provider.

## License

MIT
