# What the market and the docs say, and what it means for Stay

Searched 2 Nov 2026. Everything below is from the linked pages; where a source is secondhand or sources disagree, it says so. Nothing here is a Stay measurement.

## ChatGPT's live voice

- It is a speech-native model: audio in, audio out, with no separate transcription and synthesis steps. The older voice mode chained three models. Press coverage cites about 320 ms average response time for the native model, against one to two seconds for pipelines. That figure is secondhand. Sources: [Engadget](https://engadget.com/openai-rolls-out-advanced-voice-mode-and-no-it-wont-sound-like-scarjo-200426358.html?src=rss), [Forklog](https://forklog.com/en/openai-unveils-alpha-version-of-advanced-voice-assistant/), [MindStudio](https://mindstudio.ai/blog/gpt-live-voice-mode-real-time-translation-explained).
- A July 2026 post describes a newer full-duplex speech-to-speech model, "GPT-Live" ([Vellum](https://www.vellum.ai/blog/vellum-assistant-ai-speech-pipeline-explained)). No architecture details were found.
- **Meaning for Stay:** Stay is a cascade (speech to text, model, text to speech). It cannot match a native model on raw reply time, and it should not try to win there. What a cascade can do is stay in the speech provider's hands: exact words, word timings, custom vocabulary, language detection, and turn rules the product controls.

## NVIDIA Nemotron streaming speech recognition

- Nemotron 3.5 ASR is a 600M-parameter, cache-aware streaming model (FastConformer encoder, RNNT decoder). "Cache-aware" means the encoder keeps its own state between chunks instead of re-reading overlapping windows, which is why it can run at low latency on many streams. Latency is adjustable at run time from about 80 ms to 1.12 s. Open weights. About 40 language-locales in one checkpoint. Sources: [Together AI](https://together.ai/models/nvidia-nemotron-35-asr), [MindStudio](https://www.mindstudio.ai/blog/cache-aware-streaming-asr-nvidia-nemotron), [NVIDIA catalogue](https://catalog.ngc.nvidia.com/orgs/nvidia/collections/nemotron-asr-streaming).
- Sources disagree on the concurrency gain (3x versus 17x on an H100) and on the licence. Not relied on here.
- **Meaning for Stay:** the hackathon asks for AssemblyAI speech, so Stay uses AssemblyAI streaming. The useful idea from Nemotron is that the *endpointing latency is a dial*, not a constant. Stay already sets AssemblyAI's `min_turn_silence` and `max_turn_silence`; the ADHD-specific lever is a longer wait when the person sounds mid-thought.

## AssemblyAI's own guidance (the engine Stay is built on)

From [best practices](https://assemblyai.com/docs/voice-agents/best-practices), [turn detection](https://assemblyai.com/docs/streaming/universal-3-pro/turn-detection-and-partials) and [optimising accuracy and latency](https://www.assemblyai.com/docs/streaming/getting-started/optimizing-accuracy-and-latency):

- A turn ends at terminal punctuation, or at `max_turn_silence` if no punctuation arrives. Partials mainly appear during pauses.
- Recommended pattern: use `end_of_turn` for finality; start speculative model work and warm the voice on non-final partials; commit only on the final turn. (Stay does speculate; see `src/lib/voice/fastSocket.ts`.)
- Custom vocabulary should be names and domain terms, not common words. (Stay's "My words" does this.)
- Reported time after silence is about 121 ms median and 212 ms at the 90th percentile for the 3 Pro model, per the docs. Not measured by Stay.
- The docs now also describe a newer "Universal-3.5 Pro" streaming model that ends turns on punctuation plus silence and has a `mode` setting. Stay uses `universal-3-6-pro`; check the model string before the final build.

## Dessa

Searches for "Dessa" with AssemblyAI, voice agents and the hackathon returned nothing about a product by that name. It is listed in the master prompt as "waitlist only"; nothing is claimed about it here. If you have a link to it, send it and I will read it.

## What this says about the differentiator

The market's strongest voice products (native speech-to-speech) win on how natural a *conversation* feels. A cascade built on AssemblyAI cannot copy that architecture, so the honest differentiator is not "talks better". It is what the product does *around* the voice, for one kind of moment:

1. **It does the starting with you.** One tiny first step, then a clock that runs while it is there, then a check-in when the time is up. A clock app only counts. A general assistant answers and the conversation ends.
2. **It does not talk over a pause.** Measured on a simulated speaker; a real-microphone run is the next evidence ([`docs/evidence/loop/T2-bench-2026-11-02-series1.json`](../evidence/loop/T2-bench-2026-11-02-series1.json)).
3. **It is straight about its limits** ("I can't open or close other apps. I can start a timer.").
4. **It remembers on your device, and looks only when you ask.**

Whether that is enough is for people to decide, with a real microphone. The listening test (`/lab/voices`) and the recorder (`/lab/latency`) exist for that.
