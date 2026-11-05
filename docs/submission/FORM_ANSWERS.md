# Hackathon form: ready-to-paste answers

The form (https://forms.gle/XCW2RdZGbarVLnKEA) needs a Google sign-in, so it is filled in by hand. Everything below is true of the live build today.

**Project name:** Stay

**One line:** A voice companion that helps adults with ADHD start the thing they keep avoiding: it gives one small step, starts the clock when asked, waits through pauses, and speaks first when the time is up.

**Live app:** https://stay-two-swart.vercel.app/app/today  (landing page: https://stay-two-swart.vercel.app)

**Code:** https://github.com/vaibhav4046/stay

**Demo film (2:49):** https://stay-two-swart.vercel.app/demo/stay-story-film.mp4  (also saved at docs/submission/stay-story-film.mp4, 61 MB full quality, not in git)

**How AssemblyAI is used:** live speech-to-text in the browser (Universal-3.6 Pro streaming, language detection, "My words" key terms, SpeechStarted barge-in), and AssemblyAI text-to-speech for every reply, with the voice following the language the person speaks. Full table with code and evidence: HACKATHON_SUBMISSION.md section 2.

**What is real and what is not (say this in the form):**
- Stay's replies and voice in the film are real, recorded once in the live app. Pix's voice, the effects and the music are synthetic (ElevenLabs), and the film says so.
- All speech tests used synthetic speakers. Nobody has tested a human voice in a real room yet.
- Stay is proactive while the page is open (timer check-ins, reminders as notifications, a welcome back after hours away, an all-day companion mode). It cannot wake itself when the browser is closed.
- Not a crisis service, no medication advice, history stays on the device.

**Evidence to point judges at:** docs/evidence/ (real-provider speech measurements, real-e2e call, 70-minute soak, 227-test browser suite), REVIEWERS.md for a five-minute path.
