# Stay against ChatGPT voice and Gemini Live, measured (2026-10-19)

Everything here was measured on one Windows laptop, in one signed-in Chromium browser, on the same day. Raw reports are in `docs/bench-results/realproducts/`; the rig is in `scripts/voice-e2e/realmic/`.

## Why it is not a real-microphone test

The laptop's microphone array reads digital silence even with a tone playing next to it (checked with WASAPI and with ffmpeg, after toggling the mute the way the Murmur project does). Browser audio from this browser also never reached the speakers' loopback capture. So there is no acoustic path to test. Instead:

- **Speakers:** neural-voice clips (edge-tts, `en-GB-RyanNeural` for every product, `en-US-JennyNeural` for a second Gemini run), trimmed so the exact end of speech is known, hosted in this repo.
- **Fake microphone:** a script in the page replaces `getUserMedia` with a stream fed by those clips (`inject.js`). The product hears them as a person speaking; the browser's echo cancellation and room acoustics are not involved.
- **Timing:** the product's own reply audio is tapped inside the page (WebRTC tracks, media elements, anything connected to an `AudioContext` destination) with analysers sampled every 20 ms on the same clock as our speech events. Latency is the first reply sound after the true end of our speech. Silences under 240 ms do not split a reply; an "onset" must follow at least 1.0 s of silence so the tail of an earlier reply is not counted as the answer.
- Same script for every product: three ordinary turns, a mid-thought pause (about 3.2 s of silence between "...and, uh," and "and I keep thinking about how to even start it"), a request for a detailed plan, and an interruption ("Wait, stop, just one tiny step please"). A long-request variant was used for the interruption in later runs so the product is still talking when interrupted.

## What was tested

| Product | How it was reached | Runs |
|---|---|---|
| ChatGPT voice | chatgpt.com, Free plan, voice mode | 2 (28 s and 18 s gaps) |
| Gemini 3.8 Live | Google AI Studio Live playground, voice Zephyr (the Gemini web app has no Live button for this account) | 2 speakers (Ryan, Jenny) + 2 interruption runs |
| Stay fast voice | production, 9ffa300, same browser | 1 full run + 1 interruption run |

Not tested: Perplexity voice (not reached in time), Gemini Live in the phone app, ChatGPT paid voice, any real person or room.

## Results

| | Stay fast voice | ChatGPT voice (Free) | Gemini 3.8 Live |
|---|---|---|---|
| Reply after you stop talking, median | **1.95 s** (5 turns: 1.74 to 2.36) | **1.65 s** (8 turns: 0.91 to 4.01) | **1.44 s** (10 turns: 1.31 to 2.11) |
| Mid-thought pause of about 3.2 s | **waited**, answered after the finished thought (1.95 s) | **started talking** after 2.1 s and 1.75 s of silence (2 of 2 runs) | **started talking** after 1.46 s and 1.57 s of silence (2 of 2 runs) |
| Spoke over you mid-sentence ("Okay, maybe. What would the first sentence even be?") | no | **yes, both runs**, 2.1 s and 1.3 s before the sentence ended | no |
| Interrupted while talking: time until it went quiet | 0.38 to 0.45 s | 1.07 s and 1.50 s | 0.43 s (long-request run); 0.27 s and 0.29 s in runs where its reply may have been ending anyway |
| Typical reply length to "I keep putting off replying to my landlord" | 4 to 5 s (10 s on the second turn) | 9 to 16 s, 20 s on the second turn | 8 to 9 s |

What this says, in plain terms:

- **Speed:** Gemini 3.8 Live was the fastest here (about 1.4 s), ChatGPT voice about 1.65 s with a bad tail (4.0 s on the "detailed plan" request), Stay about 1.95 s. Stay is the slowest of the three in this rig. The 1.35 s median in `STAY_VERIFICATION_2026-10-18.md` came from a different path (injected PCM straight into a Playwright browser, 9 turns, quieter machine); the same app measured about 0.6 s slower through this rig and this busier browser. Neither number is a real-microphone number.
- **Patience:** the product's point. Both ChatGPT and Gemini began talking into a 3-second mid-thought pause every time (after 1.5 to 2.1 s), and ChatGPT cut in during the middle of a sentence in both runs. Stay waited every time.
- **Length:** ChatGPT voice talked for 9 to 20 s per turn; for someone who has just said they cannot start, that is a lot to listen to. Stay's replies were 4 to 10 s (its prompt tells it to keep them short).
- **Interrupting:** Stay and Gemini stopped in about 0.4 s; ChatGPT took 1.1 to 1.5 s.

## Limits you should not skip

- Synthesized voices through a fake microphone: no room, no echo, no accent variety beyond two voices, no real person. A different path from a person on a phone.
- Small samples: 5 to 10 turns per product, one machine, one afternoon, a busy browser. Medians move by a few tenths of a second between runs.
- Free tiers and a playground: ChatGPT's Free voice and AI Studio's Live playground are not necessarily what paid users get.
- The Stay interruption numbers are partly ambiguous: Stay's reply to the long request opened its Brain Dump sheet (a tool call) instead of speaking at length, so there was little speech to cut off.
- Measurement points differ slightly per product (a WebRTC remote track vs queued PCM chunks); both are the first audible sound in the page.

## Known Stay weaknesses this exposed

- It is slower than both on plain reply latency in this rig.
- After "Wait, stop, just one tiny step please" Stay stayed silent for 18 s in one run (the long request had just made it open the Brain Dump sheet). Two later clean trials answered the interruption 2.7 s and 1.7 s after it ended; ChatGPT and Gemini answered about 1.2 to 1.4 s after. So: answers, but slower than the other two, and a tool call can swallow the reply.
- Its memory feature wrote facts the speaker never said ("prefers 20-minute focus blocks over shorter sprints", "appreciates warm check-ins") into local memory during these runs, because the model called the save-memory tool on its own. Fixed afterwards: a memory is saved only if the person's last words asked for it (`MEMORY_CUE`, unit-tested).
- The model also called the save-memory tool with a drafted email subject line as a "fact"; the same guard blocks it.

## Not reached

- **Perplexity voice:** perplexity.ai cannot be scripted from this browser (an ExtensionsSettings policy blocks the automation extension there), so the injected-microphone method cannot run. Not measured.
- **Why no latency speed-up was shipped:** speculative generation (start the model before the turn ends) can save at most about 0.15 s here, because AssemblyAI's end-of-turn already arrives about 0.31 s after speech ends, and it would double token use against an 8,000 tokens-per-minute free tier. Not worth it.
