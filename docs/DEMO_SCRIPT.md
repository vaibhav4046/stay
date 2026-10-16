# Hackathon Demo Script (`docs/DEMO_SCRIPT.md`)

**Total Target Duration:** 2 minutes 45 seconds  
**Objective:** Demonstrate Stay's closed-loop task initiation, live AssemblyAI Voice Agent integration, ADHD-friendly body doubling, and clinician summary export.

---

## Act 1 — The Problem & Proposition (0:00 – 0:35)

- **Visual:** Landing page (`/`). Headline *"One small first step. Then stay with it."*
- **Action:**
  - Click through the **Interactive 45-second product walkthrough** directly in the hero.
  - Advance through the 5 steps: avoidance description -> barrier diagnosis -> shrunk <2min move -> focus block -> outcome logging.
  - Point to the clear label: *"Guided preview · example data · No mic required"*.
- **Narrative:**
  > *"Adults with ADHD don't avoid tasks because they are lazy—they get stuck at the initiation threshold. When working memory is overloaded, the brain can't find a small enough first move. Stay is a voice-first ADHD support companion built with AssemblyAI's Voice Agent API. It turns avoidance into a concrete 2-minute entry step, stays with you while you do it, learns what actually helps you start, and prepares a one-page summary for your clinician."*

---

## Act 2 — The Live Voice & Text Coaching Loop (0:35 – 1:35)

- **Visual:** Switch to `/demo`. Highlight the **45-second judge tour** bar and click **Talk to Stay**.
- **Action:**
  - The **Stay Signal** transitions to `connecting` then to `listening` (teal harmonic ring expands with audio energy).
  - Voice agent speaks warmly in British voice Anna:
    > *"Hi, I'm Stay. Tell me one thing you're avoiding right now, and we'll make the first step smaller."*
  - Demonstrate multimodal entry: click one of the quick starter task pills (e.g., *"Reply to landlord"* or press `/` to type).
  - Point out the ChatGPT/Perplexity-style unified workspace: speech captions appear alongside a persistent text composer.
  - The agent calls `propose_coaching_plan`:
    - Screen displays the shrunk first step card: *"Open the message thread and type one rough sentence in the draft box without sending it."*
    - Barrier identified: *Worry about getting it wrong (Perfectionism / fear)*
    - Strategy selected: *Task shrinking (<2 min entry)*
  - User starts the focus timer.
  - Point to the **Action Receipt** bubble in the chat: *"Timer started · 5 min focus block"*.
  - Show the ADHD rescue feature: tap **"I'm stuck"** to trigger a 60-second de-escalation breath without resetting progress.
  - Tap **⚡ Fast-forward timer (Demo)** to demonstrate the timer-end event.
  - AssemblyAI agent speaks first with a gentle, proactive check-in (`reply.create`):
    > *"Your focus block is complete. Did you get started on that rough sentence?"*
  - User selects *"I started"*. Panel transitions to *"Nice. You got moving."*

---

## Act 3 — Transparent Pattern Learning (1:35 – 2:00)

- **Visual:** Scroll to **What helps you start**.
- **Narrative:**
  > *"Unlike generic gamified productivity apps that guilt you with broken streaks, Stay treats every session as observational data. Here, the user can see their exact start rate across four evidence-informed strategies—with real counts and sample denominators, like '3 of 3 started'. Notice that preliminary samples with fewer than three tries are explicitly marked."*

---

## Act 4 — Treatment Check-In & Clinician One-Page PDF (2:00 – 2:30)

- **Visual:** Click **Check-in** tab, then **Clinician report** tab.
- **Action:**
  - Show the 30-second treatment log: medication taken status, focus rating, sleep quality, and user note. Highlight the clear boundary notice: Stay never advises on dosing.
  - Switch to Report Preview: show the 14-day appointment summary.
  - Demonstrate section toggles (care context, strategy table, barriers, side-effect notes, patient questions).
  - Click **Download one-page PDF**. Open the crisp PDF generated locally with `jsPDF`.

---

## Act 5 — Safety, Privacy & Close (2:30 – 2:45)

- **Visual:** Tap **Urgent help** in the bottom corner to show the fixed UK crisis panel (`999`, `NHS 111`, `Samaritans 116 123`, `Shout 85258`).
- **Narrative:**
  > *"Safety is built into the foundation: deterministic pre-LLM crisis interception, strict clinical medication boundaries, no saved audio, and one-click data deletion. That's Stay: making starting easier for adults with ADHD."*

