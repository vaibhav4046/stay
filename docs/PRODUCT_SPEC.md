# Product Specification (`docs/PRODUCT_SPEC.md`)

## 1. Product Identity & Proposition

- **Name:** Stay
- **Category:** Voice-first task-initiation and treatment-adherence companion for adults with ADHD
- **Core Promise:** Make starting easier.
- **Positioning Sentence:** Stay is a voice-first support companion that helps adults with ADHD turn difficult tasks into manageable first steps, practise practical strategies, track their own progress, and prepare clear summaries for their clinician.

---

## 2. Non-Negotiable Clinical & Honesty Boundaries

1. **Not a medical device:** Stay does not diagnose ADHD or any other condition, and does not provide medical, psychiatric, or pharmacological advice.
2. **Medication safety:** Stay never recommends, adjusts, starts, stops, or compares medications or doses. Any medication or dosing question is redirected to the user's prescribing clinician or pharmacist.
3. **Crisis routing:** Any self-harm, suicide, or immediate danger signal immediately halts coaching and displays fixed UK emergency and crisis resources (`999`, `NHS 111`, `Samaritans 116 123`) without improvised crisis counselling.
4. **Honest evidence framing:** Stay's strategy library (`task_shrinking`, `implementation_intention`, `reframing`, `timeboxing`) is informed by CBT-style executive-functioning practices (including those studied in the 2026 *attexis* digital intervention trial and iCBT programmes), but Stay itself has not been evaluated in a clinical trial. Personal strategy statistics are presented as observational self-tracking with explicit denominators (`started / attempts`).

---

## 3. Core Closed-Loop User Flows

### Flow A — Onboarding & Context Selection (Voice or Text)
- User selects their current care context:
  - `waitlisted` (Waiting for assessment or care)
  - `medicated` (Taking prescribed ADHD medication)
  - `in_therapy` (In CBT or coaching)
  - `self_managing` (Self-managing without formal care)
  - `prefer_not_to_say`
- User selects interaction preference:
  - Voice + text (`voice_and_text`) or Quiet text-only (`quiet_text_only`)
  - Proactive timer-end check-in toggle (`proactiveCheckins`: on/off)

### Flow B — Stuck-to-Start Coaching Loop
1. **Task Capture:** User speaks or types the task they are avoiding (e.g., *"Reply to my landlord about the lease renewal"*).
2. **Barrier Identification:** User or voice agent identifies the primary friction point:
   - `overwhelm` ("Too big or too many pieces")
   - `unclear_next_step` ("Don't know the first concrete action")
   - `perfectionism_or_fear` ("Worried about getting it wrong or being judged")
   - `boredom_or_distraction` ("Under-stimulated or pulled away")
   - `low_energy` ("Mentally or physically depleted")
   - `other`
3. **Strategy Proposal:** Stay selects one strategy from the 4-strategy library (biased toward strategies that have worked for this user once `attempts >= 3`, while keeping full user override):
   - `task_shrinking`: Shrink the action until the first step takes under 2 minutes.
   - `implementation_intention`: Anchor the action with a concrete *"If / When [cue], I will [first step]"* statement.
   - `reframing`: Replace an all-or-nothing standard with a rough, low-stakes draft standard.
   - `timeboxing`: Commit only to a bounded 5, 10, or 15-minute window with permission to stop at the bell.
4. **Application-Owned Focus Timer:** User starts a 5, 10, or 15-minute timer. The browser owns the countdown deterministically.
5. **Timer-End Check-in & Outcome Capture:** When the timer finishes (or the user ends early), Stay checks in (by voice if opted-in, plus on-screen dialog) and records:
   - Outcome: `started`, `partly_started`, `not_started`, or `paused_or_stopped`
   - Helpful rating (`1–5`)
   - Actual duration

### Flow C — Personal Strategy Pattern Learning
- Computes transparent per-strategy start rates:
  - `attempts`, `startedCount`, `partlyStartedCount`, `startRate`
- Always displays the sample size (`e.g., 4 of 5 sessions started`) and marks insights as preliminary until at least 5 sessions are logged.

### Flow D — Treatment Check-In
- Quick 30-second log for users tracking adherence:
  - Taken status (`taken`, `skipped`, `not_applicable`, `prefer_not_to_say`)
  - Focus rating (`1–5`)
  - Sleep quality (`1–5`)
  - Side effects noted (boolean + optional plain-text note for clinician review)
- Strictly displays a medical boundary reminder and never comments on dosing.

### Flow E — Clinician One-Page Summary & PDF Export
- User chooses date window (`7`, `14`, or `30` days) and toggles which sections to include:
  - Care context & period overview
  - Task-initiation summary (sessions, start rate, total focus minutes)
  - Strategy effectiveness breakdown (with exact counts)
  - Common barriers observed
  - Treatment adherence & user-reported side-effect notes
  - Optional user questions for the appointment
- Renders a clean on-screen preview and exports a formatted one-page PDF via `jsPDF`.
