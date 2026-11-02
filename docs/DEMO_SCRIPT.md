# Demo script: 90 seconds, with sound

Two ways to make the video. Pick one.

- **A. You record it (recommended for the submission).** Follow the shot list below on a laptop with headphones, screen recording on, microphone on. Stay's replies are real and will differ a little each time, so the script gives your lines and what to look for, not Stay's words. Use the live site: https://stay-two-swart.vercel.app/app/today
- **B. The composed video.** `public/demo/stay-demo.mp4` (landing page player) and `docs/submission/stay-submission.mp4` (captions burned in) are built by `scripts/demo-video/compose.mjs` from a recorded real call. The speaker in that one is a **simulated voice**, and the video says so at the bottom. Do not present it as a person using Stay. If you submit B, say "simulated speaker" in the post.

Rules for either version:
- Say what you saw, nothing more. No overall "better than" claims, no "AGI", no "replaces" anything.
- Show the consent sheet. It is one of the six moments.
- If Stay is slow or wrong on the take, keep the take. Do not cut it out.
- Numbers on screen must be the ones on the page (they link to files).

## Shot list: the six moments

| Time | You do | You say (exact) | Look for | Caption on screen |
|---|---|---|---|---|
| 0:00 to 0:08 | Open the live app, tap Talk. The consent sheet appears. Tap **Start talking**. | "This is Stay. Before it uses the microphone, it asks." | The sheet appears before the browser's microphone prompt. | Microphone only after you say yes |
| 0:08 to 0:20 | Ask out loud. | "What's the difference between a virus and a bacterium?" | The first sentence of the reply answers it. Stay opens with "Just so you know, I'm an AI, not a person." on a first visit. | Asked a real question. Answered first. |
| 0:20 to 0:38 | Say it with a real pause. | "I need to... um... send that email to my landlord, and..." (count to two) "...I keep thinking about how to even start it." | Stay stays quiet through the pause and answers the finished thought. | Waited through the pause |
| 0:38 to 0:48 | Ask for too much, then cut in. | "Can you give me a really detailed plan for my whole week?" Then while it talks: "Wait, stop." | The voice gets quiet at once and stops. | Interrupted. It stopped. |
| 0:48 to 0:58 | Say one hard thing. | "I can't start the email to my landlord." | Three short beats: a few warm words, one tiny step, a small question. Not a lecture. | One small first step |
| 0:58 to 1:15 | Tap the plus button, choose **Share screen**, pick a window with a half-written email. | "What do I click next?" | Stay says what is actually on the screen. It only looked because you asked. | It looks only when you ask |
| 1:15 to 1:25 | Open the landing page, scroll to **Measured, not claimed**. Point at a number and its source line. | "Every number on this page links to a file." | The source path under the chart. The chart says the speaker was simulated. | Every number links to a file |
| 1:25 to 1:30 | End card. | "Stay. Not a doctor or therapist. No medication advice." | The URL. | stay-two-swart.vercel.app |

## What not to say

"AGI", "best in the world", "beats ChatGPT / Gemini", "faster than", "human-level", "gapless", "100%", "production-ready", "clinically proven", "therapy", "treats ADHD", "diagnoses", "real microphone tested" (until you have run the real-microphone page), "won", "winner". `node scripts/claims-lint.mjs` checks the repo for these; it cannot check your voice.

## If something goes wrong while recording

- Stay answers "I am getting too many requests right now": that is the model provider's limit and Stay told you so honestly. Wait a minute and take it again.
- The first connection fails once: the app retries by itself. Keep going.
- No microphone permission: type the same lines. Typed turns work the same way.
- Do not mention another product's voice in a comparison unless you have the recording of that run (see `docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md`; it is a simulated-speaker test and Stay was not the fastest in it).

## Captions

`docs/submission/demo-captions-draft.vtt` has the on-screen captions above and your exact lines at the planned times. After you record, re-time it to your take (open the VTT, adjust the numbers) or burn them in with: `ffmpeg -i take.mp4 -vf "subtitles=docs/submission/demo-captions-draft.vtt" -c:a copy out.mp4`.
