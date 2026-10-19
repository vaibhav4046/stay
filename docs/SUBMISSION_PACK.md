# Submission pack: Stay (AssemblyAI Online Hackathon #2)

Everything here is checkable in the repo. Numbers come from `docs/STAY_VERIFICATION_2026-10-18.md` and `README.md`; limits are stated where the evidence stops.

## Links

- Live app: https://stay-two-swart.vercel.app
- Repo: https://github.com/vaibhav4046/stay
- Demo video: https://stay-two-swart.vercel.app/demo/stay-demo.mp4 (also embedded on the landing page, with captions)
- Submission form: https://forms.gle/NtYDsi3bgqMDK29j9

## One line

A voice companion for adults with ADHD that gets you from "I can't start" to a two-minute first step, then keeps you company through a short block.

## Description (paste into the form)

Adults with ADHD rarely lack the wish to start. They get stuck at the threshold: too many steps, no clear first one, a wall of guilt. Stay is a voice-first companion built for that moment. You say the thing you are avoiding, in whatever mess it comes out; Stay names what makes it hard and gives you one step you can start in two minutes, then runs a short block with you and checks in when it ends.

It is built around how people with ADHD actually talk. Stay waits through a 2.3 second mid-thought pause instead of talking over it. If you interrupt, it notices within about 0.5 to 0.8 seconds. You can say "park it: call the dentist" and the thought is set aside so it stops competing with the one thing you are starting. A brain dump turns a pile of worries into one thing to start, a few for today, and the rest for later. Routines, reminders, a Today list and a pause button are all voice-controllable.

The voice is AssemblyAI end to end. The default "fast voice" engine uses AssemblyAI streaming speech-to-text (`universal-3-6-pro`) straight from the browser, a chat model for the reply, and AssemblyAI streaming text-to-speech, and emits the same events as the Voice Agent API so one hook drives both. The managed Voice Agent API is kept as the automatic fallback. Both are measured with the same simulated speaker: fast voice replies in about 1.3 s, the managed agent in about 2.8 s.

Safety is deterministic and runs before any model: crisis wording (30+ languages) stops coaching and shows emergency numbers and a findahelpline fallback; medication and dose questions get a fixed reply that points to a prescriber. Data stays in the browser by default, with one-click export and delete. You can bring your own keys (Groq GPT-OSS, Mistral, OpenAI or any OpenAI-compatible address, and AssemblyAI) so the shared allowance is never a limit.

## Where the AssemblyAI platform is used

| Piece | Use |
|---|---|
| Streaming STT v3, `universal-3-6-pro` | Browser-direct, ephemeral token minted by `/api/voice/fast-token`. End-of-turn about 0.31 s measured (vendor claim 307 ms reproduced). `keyterms_prompt` biases the app's own words. |
| Streaming TTS | Browser-direct. Protocol was undocumented and found by probing; one voice per language (a wrong-voice bug for es/fr/de was found and fixed on 2026-10-19). |
| Voice Agent API | Managed engine and automatic fallback; also the baseline in every comparison. |
| Tokens | Server routes mint short-lived tokens; the account key never reaches the browser. Long sessions only on a user's own key. |

## What is verified (and how)

- Unit tests: 387 passing (`npm test`). Typecheck clean.
- Browser tests: Playwright against the production build (`npm run test:e2e`); see the verification doc for the latest counts and the CSP, brain dump, routines and double-plan regression tests.
- Voice, with a simulated speaker (`scripts/voice-e2e/sim-human.mjs`, synthesized voices plus room noise injected as the microphone):

| | Fast voice | Managed agent |
|---|---|---|
| Reply after you stop talking | median 1.35 s (n=9, 3 runs) | median 2.84 s (n=9, 3 runs) |
| 2.3 s pause mid-thought | waited 3 of 3, answered in 1.3 to 1.5 s | talked into the pause 3 of 3 |
| Interruption noticed | 0.54 to 0.82 s | 1.01 to 1.09 s |
| "Park it: call the dentist" confirmed | 1.3 to 3.3 s | 2.9 s (earlier run) |
| Stray transcripts from its own voice | 0 in 26 | 0 in 27 (1 in 10 earlier) |

- Security: CSP on every route, SSRF guard with DNS resolution on custom provider addresses, rate limits, no shared cache of personal text.

## What is not claimed

- Against ChatGPT voice (Free) and Gemini 3.8 Live (AI Studio), measured on 2026-10-19 with the same simulated speaker through the same fake-microphone path: Stay is slower on plain reply time (about 1.95 s vs 1.65 s and 1.4 s) but waited through mid-thought pauses where both of the others started talking, and talks for 4 to 10 s instead of 9 to 20 s (ChatGPT). Not a real-microphone test, small samples, free tiers; see `docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md`. Published vendor figures are in `docs/RESEARCH_VOICE_LATENCY.md` and are not Stay measurements.
- The speakers are synthesized voices injected into a browser on one machine, a handful of runs per setting. No real-microphone, earphone or phone test yet.
- Non-English fast voice (Spanish, French, German, Italian, Portuguese) works after the 2026-10-19 fix; each was measured on only 3 turns, replies 1.3 to 4.3 s, so it is less proven than English.
- Mistral and OpenAI keys were not tested live. The shared Groq free tier allows 8,000 tokens a minute on the main model; the server falls back to a smaller model, and a user's own key removes the limit.
- Stay is not a medical device and says so. No clinical outcome is claimed.

## Try it in three minutes

1. Open the live app, tap the orb, allow the microphone, say: "Um, I keep putting off replying to my landlord."
2. Pause mid-sentence for two seconds; Stay should wait. Then interrupt it while it speaks.
3. Say "park it: call the dentist", then open More and look at Parked thoughts. Try the brain dump from the Today card.
4. Open the reply-speed readout in the voice sheet: it shows your own measured time, not a claim.

## Rubric mapping (my own reading, not the organisers' wording)

- Use of AssemblyAI: streaming STT, streaming TTS and the Voice Agent API in one product, with measured differences.
- Innovation: turn-taking tuned for ADHD speech (patience for pauses, whole-sentence barge-in), a dot-field interface that reshapes with what you say.
- Real-world impact: a concrete moment (starting) and a short loop, with safety limits and no streaks or guilt mechanics.
- Execution: shipped and live, tested, with the benchmark harness and its honest limits in the repo.
