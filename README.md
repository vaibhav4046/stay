# Stay

Start the thing you've been avoiding. Stay is a voice companion for adults with ADHD: tell it the task you can't begin, get one small first step, a short block to do it in, and a note of what helped.

Built on the **AssemblyAI Voice Agent API** for the AssemblyAI Online Hackathon #2.

Live: https://stay-two-swart.vercel.app

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

## Latency: what is and is not true

Measured here (`scripts/voice-e2e/cascade-bench.mjs`, 6 runs, one machine, synthesized speech): AssemblyAI streaming speech-to-text takes about 0.88 s from the end of speech to its end-of-turn event (p50, range 0.83 to 0.95 s); the shared GPT-OSS key returns its first token in about 0.3 s (p50); the streaming TTS endpoint produces first audio about 0.2 s after a Generate and Flush. Added up, a hand-built cascade is about 1.4 s, the same as the Voice Agent's measured floor of about 1.4 s. So Stay does **not** beat ChatGPT's voice mode or Google's live voice on speed, and no page here claims it does. Those two were not measured at all (no keys). Measured from the true end of the sentence (not the server's own "speech stopped" event), the Voice Agent took 2.5 s p50 (2.45 to 2.69 s, 5 runs) in `scripts/voice-e2e/compare-bench.mjs`; that stricter definition is the honest comparison basis. The same script times OpenAI Realtime and Gemini Live when `OPENAI_API_KEY` / `GEMINI_API_KEY` are in `.env.local`; without them they print NOT MEASURED. Those two legs follow the vendors' documented events but have never been run. Run the benches to see your own numbers.

## Not done

- A real-microphone and speaker test (echo, earphone buttons) and a phone GPU frame-rate check.
- A Mistral or OpenAI key was not available to test live; the Groq path was tested with real keys, the others only through the shared request code and unit tests.
- Side-by-side timing against ChatGPT voice and Google live voice (needs their API keys).
- Supabase Auth, Google sign-in and row-level security against a real project.
- The Voice Agent API documents six languages; others work in practice (see the verification doc) but are not promised by the provider.

## License

MIT
