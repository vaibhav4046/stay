# Pix tests Stay (film)

`public/demo/stay-pix-film.mp4` (3 min 38 s) and `docs/submission/stay-pix-film-captioned.mp4` (captions burned in; the same words are in `public/demo/stay-pix-film.vtt`).

What it is: one real call in the real app, on the real model, from `node scripts/demo-video/film.mjs`. Pix, an impatient user, is an ElevenLabs voice spoken into the microphone; Stay answers with its own AssemblyAI voice, recorded from the page. Every Stay line in the captions is the app's real reply from that call. It shows: a first test, the answer to "why not just ask the big AI app", doom-scrolling and a no-lecture answer, talking over Stay while it speaks, memory, the report and settings opening inside the call, a timer, and a parked thought.

What is synthetic or added: Pix's voice and voice-over, the two sound effects and the music bed (ElevenLabs); Pix himself is original pixel art (not anime style); the film is one take with Pix's voice-over placed between the exchanges. The bottom bar says so on screen. No other product is named.

Build notes, so nothing is hidden: the script builds the film only if every beat gets a clean reply and the interruption lands while Stay is speaking. Take 1 passed and is the film. A later retake was refused by that check when Groq's free daily token cap answered "too many requests" (`film-run-retake-refused.json`); the take-1 file was then repaired without re-recording (bottom note, loudness, caption size via `film.ass`).

Known weak spots: three replies are just "Done." (report, settings, timer); the reply after the interruption is longer than "the first block"; the voice-over line "it stopped the second I talked over it" rests on the app's measured pause on barge-in (40 to 70 ms in earlier runs), not on this take alone.
