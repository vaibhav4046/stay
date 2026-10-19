# Voice latency: what the published record says, and where Stay stands

Written 2026-10-19. Everything marked **published** comes from a source linked here and was **not** reproduced by us. Everything marked **measured** was measured in this repository with the scripts named. The two are never mixed in one claim.

## 1. What is published about the products Stay is compared with

| Claim | Number | Source | Status |
|---|---|---|---|
| GPT-4o (ChatGPT voice) responds to audio | 232 ms best, 320 ms average | OpenAI's May 2024 GPT-4o announcement, repeated by [DTNext](https://www.dtnext.in/lifestyle/technology/openai-launches-new-gpt-4o-ai-model-for-all-chatgpt-users-784722) and [IndiaAI](https://indiaai.gov.in/article/openai-s-new-gpt-4o-is-faster-and-free-for-all-users) | Vendor claim, secondary reports, ChatGPT app not measurable by us |
| Realtime API time to first token | 300 to 500 ms | [Netguru](https://www.netguru.com/blog/voice-ai-low-latency-techniques), which also warns it holds on clean wired lab connections | Unverified |
| GPT-Realtime time to first audio | 1.12 s | [SoftwareSeni vendor-neutral guide](https://www.softwareseni.com/voice-agent-latency-solved-enough-for-production-benchmarks-and-architecture-tradeoffs) | Third-party, definition unclear |
| Gemini Live first audio | 320 to 800 ms in one informal test; 5 to 6 s in a telephony setup; 6 to 12 s on a first turn | [lablab.ai tutorial](https://lablab.ai/ai-tutorials/building-voice-agents-gemini-live-fastapi), [Google AI forum](https://discuss.ai.google.dev/t/live-api-5-6-second-response-latency/123254), [LiveKit forum](https://community.livekit.io/t/title-6-12s-latency-on-the-first-model-response-after-a-pre-recorded-greeting-even-with-early-session-initialization-gemini-3-1-flash-live/1431) | Developer reports, very wide spread |
| Moshi (open full-duplex speech model) | 160 ms theoretical, about 200 ms in practice; natural human gap 230 ms | [arXiv 2410.00037](https://arxiv.org/html/2410.00037v1) | Peer-reviewed-style paper, own hardware |
| AssemblyAI Universal-3 Pro streaming, final transcript after the speaker stops | median 307 ms | [AssemblyAI benchmark post](https://www.assemblyai.com/blog/real-time-stt-latency-benchmarks-voice-agents) (Pipecat open STT benchmark) | Vendor, reproduced below |
| Cascade component budget | speech-to-text 350 ms, first model token 375 ms, text-to-speech first byte 100 ms (upper limits 500, 750, 250) | [Twilio guide](https://www.twilio.com/en-us/blog/developers/best-practices/guide-core-latency-ai-voice-agents) | Industry targets |
| Model first-token times through one provider | 202 to 691 ms p50 across Gemma 4, Gemini 2.5/3.6 Flash, GPT-4.1, GPT-5.6 | [LiveKit benchmarks](https://livekit.com/benchmarks/latency) | Published, same-request replay |

Reading the record honestly: native speech-to-speech models (GPT-4o app voice, Moshi) have the lowest published best-case latency, roughly 0.2 to 0.3 s. Independent API measurements land around 1 s, and Gemini Live reports range from sub-second to several seconds. No source gives a controlled, same-audio comparison of ChatGPT voice, Gemini Live and a cascade.

## 2. What the research says about things other than raw speed

* **Reliability under noise.** Sierra's τ-voice benchmark (278 customer-service tasks with noise, compression and accents) reports that end-to-end speech models complete far fewer tasks than a text agent given the same tasks: [Sierra](https://sierra.ai/blog/tau-voice-benchmarking-real-time-voice-agents-on-real-world-tasks) quotes 30% in August 2025 rising to 67% in April 2026; secondary leaderboard posts show 67.3% / 43.8% / 35.3% for Grok Voice, a Gemini Live variant and GPT Realtime 1.5, and one summary claims 26 to 38% with noise added and 85% for text. Those figures conflict with each other, so we quote none of them as fact; the direction (noise and accents hurt speech-to-speech agents) is consistent across sources. A cascade keeps a transcript and a text model, which is where Stay's design choice comes from.
* **Talking over people.** [Full-Duplex-Bench](https://arxiv.org/html/2503.04721v3) (pause handling, backchanneling, turn-taking, interruption) and its [v3 follow-up](https://arxiv.org/pdf/2604.04847) measure this directly; v3 reports GPT-Realtime interrupting users 13.5% of the time and another model 47.9%. People with ADHD pause mid-thought, so interruption rate matters more than the last 100 ms of speed. Stay holds a turn that trails off ("um", "and", a comma) for 2.2 s.
* **Where time goes in a cascade.** Twilio and AssemblyAI both put the budget in three stages; Deepgram's "eager end-of-turn" and AssemblyAI's partials-based speculative inference are the documented ways to overlap them.

## 3. What we measured (scripts in `scripts/voice-e2e/`)

All timing is from the true end of the speaker's speech to the first reply audio.

| Stage or system | Measured here | Script |
|---|---|---|
| AssemblyAI end of turn (after the speaker stops) | **0.31 s p50** (0.30 to 0.41, 7 runs), reproducing the vendor's 307 ms | `cascade-bench.mjs`, `force-endpoint-probe.mjs` |
| `ForceEndpoint` instead of waiting for the detector | no gain (0.36 s either way) | `force-endpoint-probe.mjs` |
| `mode=min_latency`, lower `min_turn_silence` | no gain in our runs | `cascade-bench.mjs` (`STT_EXTRA`) |
| First model token (Groq, gpt-oss-20b / 120b) | 0.27 s / 0.33 s p50 | `cascade-bench.mjs` |
| Chat route on production, browser to first content | 0.36 s p50 (first call cold: 1.0 s) | scratch script, 8 runs |
| Text-to-speech first audio after Generate+Flush | about 0.2 s | `cascade-bench.mjs` |
| **Stay fast voice, whole loop (simulated speaker)** | **1.16 to 1.24 s median** (0.79 to 1.41) | `sim-human.mjs` |
| **Stay standard (managed) voice, same script** | **2.49 s median** (2.33 to 2.97) | `sim-human.mjs` |

**Correction to earlier notes.** Earlier versions of this repository quoted 0.88 s for speech-to-text and 1.4 s as a cascade total. Those came from benchmark scripts that paced audio with a fixed `sleep`, which drifts and made every figure look about half a second slower. The scripts now pace against the clock. Tables elsewhere that still say 0.88 s are superseded by this page.

**Where Stay stands.** At about 1.2 s the fast voice is in the same range as the independent 1.12 s API measurement above and well inside the spread of Gemini Live developer reports, and clearly faster than the managed voice it replaced. It is slower than the best published speech-to-speech figures (0.2 to 0.3 s). We make no claim against ChatGPT voice or Gemini Live, because neither was measured here. Where Stay is measurably better than what we replaced: reply speed, patience with pauses, interruption handling, confirming commands, and never mistaking its own voice for the user.

## 4. What the research changed in the product

1. Fast voice (own speech-to-text, chat model, text-to-speech) is the default, with the managed voice as automatic fallback.
2. Turns that trail off are held and merged instead of answered.
3. The first clause of a reply is spoken as soon as it exists; later sentences follow.
4. Simple commands are confirmed straight away, without a second model call.
5. The benchmark scripts were corrected, and their results are published with their limits on the landing page.
