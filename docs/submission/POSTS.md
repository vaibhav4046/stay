# Posts (drafts for you to paste; nothing has been posted)

Free X accounts allow **280 characters**, and X counts every link as **23** characters whatever its length. The counts below use that rule. Add the host's handle where marked; I do not know it.

All numbers here come from files in the repo and carry their label. Nothing was measured with a human microphone, so the posts say "simulated speaker". No post says it won, or that it beats or replaces anything.

---

## X, version A (no numbers) — 275 characters

```
I built Stay for @AssemblyAI's voice hackathon.

It's a voice helper for people with ADHD who keep putting things off. Say what you're avoiding and it gives you one tiny first step. It waits while you think. It only looks at your screen when you ask.

https://stay-two-swart.vercel.app
```

## X, version B (one measured number) — {{XB_COUNT}} characters

```
{{XB}}
```

Source for the number: `docs/evidence/loop/T2-bench-2026-11-02.json` (simulated speaker, live model, one laptop).

## X, reply with the video (optional)

```
The demo, with sound. The speaker is a simulated voice (labelled in the video); Stay's replies are real. Every number on the site links to a file.
```

---

## LinkedIn

```
I built a voice app for people who keep putting things off. It's called Stay.

I made it for AssemblyAI's voice hackathon.

The idea is simple. You say what you're avoiding, like "I can't start the email to my landlord." Stay doesn't lecture. It gives you one tiny first step, then waits.

What I tried to get right:
- If you ask a question, it answers the question first.
- It waits while you think, then replies.
- It only looks at your screen or a photo when you ask, and it doesn't keep it.
- It asks before it uses your microphone.
- It tells you it's an AI. It's not a doctor or a therapist, and it gives no medication advice.

What I checked, and what I didn't:
{{LI_NUMBERS}}
I haven't tested it with a person speaking into a microphone yet, so please read the timings as a simulated-speaker test on one laptop. Every number on the site links to the file it came from, including the ones where Stay was slower than other voice apps in my October test.

It's built on AssemblyAI Universal-3.6 Pro for listening and AssemblyAI TTS-1 for its voice.

Try it: https://stay-two-swart.vercel.app
I'd like to hear where it breaks.

#ADHD #VoiceAI #AssemblyAI
```

---

## Before you post

- Open the live site once from a phone and say yes to the microphone, so you know the first thing a visitor sees.
- Attach `docs/submission/stay-submission.mp4` only if you are happy that it says "simulated speaker" (it does, at the bottom). The composed video is from an earlier build; regenerate it with the three commands in `docs/DEMO_SCRIPT.md` option B if you want it to match this build, or record your own with option A.
- Do not add "AGI", "best", "beats", "winner" or "replaces". `node scripts/claims-lint.mjs` checks the repo, not your post.
