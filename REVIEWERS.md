# Stay: guide for reviewers and AI coding agents

Stay is a voice companion for adults with ADHD: it helps them start the thing they are avoiding, answers what they ask, waits through
thinking pauses, and learns from their own logged blocks what gets them started. Built for AssemblyAI's TTS-1 hackathon week on
**AssemblyAI Universal-3.6 Pro** (streaming speech to text) and **AssemblyAI TTS-1** (streaming voice). Live: https://stay-two-swart.vercel.app

Stay is not a doctor or therapist: it never diagnoses and never advises on medication.

## Verify it yourself (no API keys needed for these)

```bash
npm ci
npx tsc --noEmit                 # types
npx vitest run                   # 1,613 passed, 1 skipped on 4 Nov 2026 (the count grows); the model and AssemblyAI are mocked
node scripts/claims-lint.mjs     # no banned claim, and every number on the site points at an evidence file
npm run build && npx next start -p 3120 &
PLAYWRIGHT_BASE_URL=http://localhost:3120 npx playwright test   # 218 browser tests listed on 4 Nov 2026 (`--list`), with a faked voice service
```

With keys in `.env.local` (`ASSEMBLYAI_API_KEY`, `GROQ_API_KEY`; see `.env.example`), the live checks run against real services:

- `node scripts/voice-e2e/sim-human.mjs fast http://localhost:3120 --turns 3 --no-llm` : a synthetic speaker as the microphone, real STT, model and TTS; prints reply timing per stage, a thinking-pause test and an interruption test
- `node scripts/voice-e2e/file-mic.mjs http://localhost:3120` : Chromium reads a WAV as its microphone (its real capture pipeline); nothing plays aloud
- `node scripts/eval/judge-panel.mjs http://localhost:3120` : blind A/B against a plain voice assistant on the same model, plus four rubric judges (model-as-judge)
- `node scripts/measure-voice.mjs` : AssemblyAI STT and TTS timing and word error rate, without the app

Browsers launched by these scripts are muted. Every number in the README, the landing page and `HACKATHON_SUBMISSION.md` links to a file
under `docs/evidence/`; `docs/loop/LEDGER.md` lists each check, its label (synthetic-mic, file-mic, live-model, mocked-model) and what is not done.

## Testing it with your own microphone

Use headphones (otherwise the microphone hears Stay's voice; Stay ignores its own words, but headphones are cleaner). Open
`/app/today`, press **Talk**, accept the microphone sheet. Try: a factual question; "I need to... um... (pause) ...send that email"; talking
over a long answer; "I can't start the email to my landlord"; share your screen and ask "what do I click?". `/lab/latency` explains an
in-app recorder for timing a real-microphone call.

## Where things are

| Area | Files |
|---|---|
| Fast voice path (STT -> model -> TTS, turn taking, interruptions, captions) | `src/lib/voice/fastSocket.ts`, `src/lib/voice/useVoiceAgent.ts` |
| Playback (AudioWorklet, pause-in-place on interruption) | `public/worklets/stay-pcm-playback-processor.js`, `src/lib/voice/playback/continuousPlayback.ts` |
| Chat route (safety gates first, intent, prompt, tools) | `src/app/api/voice/chat/route.ts`, `src/lib/conversation/*`, `src/lib/voice/agentTool.ts` |
| Safety (crisis, medication) shared with the phone agent | `src/lib/safety/crisis.ts`, `src/app/api/safety/check/route.ts` |
| What Stay learns about you (evidence-based, editable) | `src/lib/coach/learnings.ts` |
| Model fallback across rate-limit buckets | `src/lib/llm/stream.ts` |
| Phone agent (LiveKit Agents 1.8; built, not deployed) | `agent/agent.py`, `agent/test_agent.py` |
| Landing page | `src/components/landing/*` |

## Honest limits

- Timings are from a synthetic speaker (and a WAV-as-microphone run), not a human in a room. Median first sound after speech is about
  1.0 to 1.3 s; the project's own 900 ms target is not met.
- No measured comparison with other voice products; the comparisons in `docs/evidence/loop/` are blind, model-judged, text-only A/B runs.
- AssemblyAI allows 5 new voice sessions a minute per account and Groq's free tier about 8,000 tokens a minute per model, shared by
  everyone using the live site. Groq's free tier also caps each model at 200,000 tokens a day (about 100 to 180 spoken turns), so heavy
  testing can use the day's room up and the site then says "I am getting too many requests right now". Setting `GROQ_API_KEYS=key1,key2`
  shares the load across keys (`src/lib/voice/tokenOptimizer.ts`, `tests/unit/keyPool.test.ts`).
- The phone agent is not deployed and has no number; calls work in the browser (Call Stay).
