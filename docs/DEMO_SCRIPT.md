# Hackathon Demo Script (`docs/DEMO_SCRIPT.md`)

**Total Target Duration:** 2 minutes 45 seconds  
**Objective:** Demonstrate Stay's closed-loop task initiation, live AssemblyAI Voice Agent integration, ADHD-friendly body doubling, and clinician summary export.

---

## Act 1 — The Problem & Proposition (0:00 – 0:30)

- **Visual:** Landing page (`/`). Slow pan over the headline *"Make starting easier."* and the live **Stay Signal** instrument gently breathing in idle state.
- **Narrative:**
  > *"Adults with ADHD don't avoid tasks because they are lazy—they get stuck at the initiation threshold. When working memory is overloaded, the brain can't find a small enough first move. Stay is a voice-first ADHD support companion built with AssemblyAI's Voice Agent API. It turns avoidance into a concrete 2-minute entry step, stays with you while you do it, learns what actually helps you start, and prepares a one-page summary for your clinician."*

---

## Act 2 — The Live Voice Coaching Loop (0:30 – 1:30)

- **Visual:** Switch to `/demo`. Click **Talk to Stay**.
- **Action:**
  - The **Stay Signal** transitions to `connecting` then to `listening` (teal harmonic ring expands with microphone audio).
  - Voice agent speaks warmly in British voice Anna:
    > *"Hi, I'm Stay. Tell me one thing you're avoiding right now, and we'll make the first step smaller."*
  - User speaks:
    > *"I've been dreading replying to my landlord about the lease renewal email."*
  - Captions appear instantly under the instrument.
  - Signal shifts to `thinking`, then `speaking`. The agent calls `propose_coaching_plan`:
    - Screen displays the shrunk first step: *"Open the message thread and type one rough sentence in the draft box without sending it."*
    - Barrier identified: *Worry about getting it wrong (Perfectionism / fear)*
    - Strategy selected: *Task shrinking (<2 min entry)*
  - User starts the 5-minute timer. Secondary chrome fades back.
  - Fast-forward to timer end: chime rings. Voice agent speaks first with a gentle, proactive check-in:
    > *"Your focus block is complete. Did you get started on that rough sentence?"*
  - User selects *"I started"*. Panel transitions to *"Nice. You got moving."*

---

## Act 3 — Transparent Pattern Learning (1:30 – 2:00)

- **Visual:** Scroll to **What helps you start**.
- **Narrative:**
  > *"Unlike generic gamified productivity apps that guilt you with broken streaks, Stay treats every session as observational data. Here, the user can see their exact start rate across four evidence-informed strategies—with real counts and sample denominators, like '3 of 3 started'. Notice that preliminary samples with fewer than three tries are explicitly marked."*

---

## Act 4 — Treatment Check-In & Clinician One-Page PDF (2:00 – 2:35)

- **Visual:** Click **Check-in** tab, then **Clinician report** tab.
- **Action:**
  - Show the 30-second treatment log: medication taken status, focus rating, sleep quality, and user note. Highlight the clear boundary notice: Stay never advises on dosing.
  - Switch to Report Preview: show the 14-day appointment summary.
  - Demonstrate section toggles (care context, strategy table, barriers, side-effect notes, patient questions).
  - Click **Download one-page PDF**. Open the crisp PDF generated locally with `jsPDF`.

---

## Act 5 — Safety, Privacy & Close (2:35 – 2:45)

- **Visual:** Tap **Urgent help** in the bottom corner to show the fixed UK crisis panel (`999`, `NHS 111`, `Samaritans 116 123`).
- **Narrative:**
  > *"Safety is built into the foundation: deterministic pre-LLM crisis interception, strict medication boundaries, no saved audio, and one-click data deletion. That's Stay: making starting easier for adults with ADHD."*
