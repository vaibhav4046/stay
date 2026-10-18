# Stay

Start the thing you've been avoiding. Stay is a voice companion for adults with ADHD: tell it the task you can't begin, get one small first step, a short block to do it in, and a note of what helped.

Built on the **AssemblyAI Voice Agent API** for the AssemblyAI Online Hackathon #2.

Live: https://stay-two-swart.vercel.app

## What it does

1. **Say it.** Talk or type. One task, said however it comes out.
2. **Shrink it.** Stay names what makes it hard and turns it into a step you can start in two minutes.
3. **Start it.** A short timer, a spoken check-in when it ends, and a record of what helped. Your own start rate per strategy, with the real counts.

The orb is the interface. It is a field of dots that gathers into whatever you are talking about: say "ice cream" and the dots pour into a cone, say "dragon" and they form a dragon in its own colours. Common words morph instantly from a hand-built library. Any other word is resolved by a small shape service (an LLM that only names the best emoji, a few tokens per call) and the glyph is sampled into coloured dots. Only dots are drawn.

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

## Not done

- A real-microphone and speaker test (echo, earphone buttons) and a phone GPU frame-rate check.
- Supabase Auth, Google sign-in and row-level security against a real project.
- The Voice Agent API documents six languages; others work in practice (see the verification doc) but are not promised by the provider.

## License

MIT
