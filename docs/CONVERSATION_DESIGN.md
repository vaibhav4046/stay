# How a good voice conversation works, and what Stay does about it

Written 4 Nov 2026 from a short web search, so treat the sources as press coverage and a few papers, not as OpenAI's own documentation (the search found none). No product is claimed to be better or worse than another here.

## What the sources say
- **Speech in, speech out, with fewer steps.** Coverage of ChatGPT's voice mode says its model works on audio directly instead of converting speech to text and back, which lowers delay, and that you can interrupt it ([MacRumors, 2024](https://www.macrumors.com/2024/07/30/openai-advanced-voice-mode-chatgpt/)).
- **It was tuned to interrupt less.** Later coverage describes a model that waits longer, treats a short pause as not yet a turn, and cuts in less often ([itdaily](https://itdaily.com/news/software/chatgpts-advanced-voice-mode), [ainauten](https://news.ainauten.com/en/story/chatgpt-voice-soll-besser-zuhoeren-und-weniger-dazwischenreden)). A 2024 review found the opposite problem, a very low interruption threshold ([nerdschalk](https://nerdschalk.com/?p=428080)). One site reports a newer full-duplex model; that is unconfirmed.
- **Small listening sounds can lengthen a session.** A Penn State study of a smart speaker found that adding short continuers such as "hm" and "yeah" led to longer, more sustained interactions ([Penn State](https://pure.psu.edu/en/publications/can-alexa-be-your-therapist-how-back-channeling-transforms-smart-/)). Timing matters: too rare, too frequent or late reduced how natural it felt.
- **Pause-and-respond feels stiff.** A 2026 Microsoft paper says most voice agents still wait for a pause and then answer, which sounds robotic, and that they handle interruption and overlap poorly ([arXiv 2603.21682](https://arxiv.org/html/2603.21682v2)). Usability work frames the goal as answering swiftly without talking over the person or denying them time to think ([UTEP overview](https://www.cs.utep.edu/nigel/dsu.html)).
- **People adapt to predictable timing** ([2026 thesis, via search](https://web3.arxiv.org/pdf/2506.17890)). The snippets did not give sample sizes, so these are leads, not proof.

## What Stay already does
- Waits about a second after you stop, and longer when the sentence trails off ("and…", "um"), because people with ADHD stop to think.
- Starts speaking the first sentence while the rest is still being written; talk over it and it stops and listens.
- Short turns, one small step, one question at a time; picks the next step instead of listing options.
- Remembers only what you ask it to, and brings back your own words when they match what you said.

## What the soaks showed that still falls short
- **Staccato speech.** In the 47-minute reactive run (`docs/evidence/loop/soak-run8`) the speech model ended a turn mid-sentence several times ("Uh, fine. I'm", "Cool. Show me"), and Stay answered the fragment. Waiting longer on endings like "I'm", "show me" and "that's a" is the fix the sources point to; it needs a test with human speech before the timing is changed, because the current values were tuned on measurements.
- **"Hold on" pauses Stay.** By design, but it says nothing when it does, so the call can look dead. A spoken "Paused, say I'm back when you are" would be kinder. Not built yet.

## What is deliberately not done
Features whose job is to keep a person on the screen longer: streaks, variable rewards, cliffhangers, guilt when you leave, fear of missing out. Stay's job is to help someone start something and then put the phone down. Listening sounds would be added only if a test shows they help people start tasks, not to lengthen sessions.

## On the landing page
The example card pays attention to the same thing: words arrive a little slower than speech tends to run, with a short pause at each comma and full stop, and each word fades in, so the eye can follow them. The face appears large once, then settles into the header.
