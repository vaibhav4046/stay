# Stay 3-Minute Hackathon Demo Script (`docs/STAY_DEMO_SCRIPT.md`)

**Target Audience:** AssemblyAI Online Hackathon #2 Judges & Clinician Reviewers  
**Duration:** Exactly 3 minutes (180 seconds)  
**Live URL:** `https://stay-two-swart.vercel.app/demo` (or `/app/today`)  
**Diagnostic URL:** `https://stay-two-swart.vercel.app/demo/orb-diagnostic`

---

## Preparation Checklist
- [ ] Open `https://stay-two-swart.vercel.app/demo` in Chrome.
- [ ] Ensure microphone permissions are allowed.
- [ ] Have headphones connected (or laptop speakers at moderate volume).
- [ ] If presenting on projector or unstable Wi-Fi: keep Quiet Mode toggle and `/demo/orb-diagnostic` ready in adjacent tabs.

---

## Script Breakdown

### Act 1: The Hook — Why To-Do Lists Fail ADHD (0:00 – 0:45)

**Visual:** Navigate to `https://stay-two-swart.vercel.app/demo`. Show the warm stone `#FAF8F5` canvas and the quiet, breathing Stay Signal Orb.

**Speaker (Say):**
> "Adults with ADHD don't struggle because they lack to-do apps. They struggle at the exact moment of **task initiation**—what clinical neuropsychologists call *activation paralysis*. 
>
> When executive overload hits, opening a complex project board causes panic. You need one calm, voice-first companion that does only one thing: help you get moving on the very first sub-two-minute step without shame, judgment, or visual noise. This is **Stay**."

---

### Act 2: Live Voice Coaching & The Stay Signal Orb (0:45 – 1:30)

**Visual:** Click the Stay Signal Orb. The orb transitions to `connecting` (silver aura), then to `listening` (cyan fluid wave horizon).

**Speaker (Say into Microphone):**
> "I have to do my quarterly expenses, but my inbox has 200 unread receipts and I just feel completely stuck."

**Orb & System Behavior:**
- The user speaks. Voice energy dynamically ripples across the WebGL fluid wave horizon.
- Low vowels swell the inner cosmic core; consonants trigger vertical mouth contours.
- The orb transitions to `thinking` (violet pulsar), then `speaking` (living aurora emerald).
- Assistant replies via AssemblyAI Voice Agent (or localized fallback):
  > *"That's classic task overwhelm. You don't need to do 200 receipts right now. Let's make an agreement: just open your bank tab and download a single PDF statement. That takes under 90 seconds. Can we do just that?"*

**Interruption (Barge-in Demonstration):**
**Speaker (Interrupt mid-sentence):**
> "Actually, wait, can we start with logging into my accountant's portal instead?"

**Orb & System Behavior:**
- The assistant cuts off playback instantly (zero audio overlap).
- Orb flashes `interrupted` (amber ember), captures the new instruction, and adjusts the micro-step in real time.

---

### Act 3: Quiet Focus Block & Screen Wake Lock (1:30 – 2:15)

**Visual:** Click "Agree & Start 5-Min Timer".

**Speaker (Say):**
> "Notice what happens to the screen. All secondary UI recedes. We don't overwhelm dopamine with confetti or gamified streaks. 
> 
> The timer runs in high-contrast tabular typography, and the Screen Wake Lock keeps your phone or desktop awake so you aren't fighting screen timeouts while your hands are on the task.
> 
> When the timer finishes, Stay asks one simple question: did you start? It logs the outcome to local storage without shame."

---

### Act 4: Daily Adherence Check-in & Clinician PDF Export (2:15 – 3:00)

**Visual:** Click the "Daily Treatment Check-in" tab, then switch to "Clinician Appointment Report".

**Speaker (Say):**
> "ADHD care isn't just tasks; it's a closed therapeutic loop. 
> 
> Every day, users take 30 seconds to log whether they took their prescribed treatment, their focus rating, and sleep quality. Stay strictly avoids medical advice—it never titrates or diagnoses.
> 
> Instead, before your psychiatric appointment, click **Export Clinician Summary**. The patient selects which sections to include. In one click, jsPDF compiles a 1-page clinical brief showing task completion patterns and treatment adherence trends. 
> 
> Your doctor gets objective longitudinal data instead of 15 minutes of fuzzy memory.
> 
> That is Stay: voice-first initiation, zero audio echo, respectful design, and a complete ADHD companion built with AssemblyAI."

---

## Judge FAQ & Technical Talking Points

| Judge Question | Verified Engineering Answer |
|---|---|
| *"How did you prevent microphone loopback?"* | "We completely decoupled the microphone source from the AudioContext destination. Mic stream feeds solely the input AnalyserNode and AudioWorklet. Assistant PCM output plays to speakers and taps a separate output analyser. Hardware AEC/AGC is mandated on `getUserMedia`." |
| *"How does the orb animate without square box clipping?"* | "The Three.js WebGL canvas and outer button are strictly bounded to `50%` border-radius with overflow hidden. Shaders utilize a Dave Hoskins non-trigonometric 3D noise hash for procedural celestial nebulae and 3-band FFT visemes." |
| *"What happens if the internet cuts out or AssemblyAI drops?"* | "Stay features 100% guest-mode resilience. An offline deterministic fallback classifies the friction barrier and outputs a sub-2-minute step in 8 languages directly in the browser." |
| *"Can we inspect the orb without talking?"* | "Yes! Visit `/demo/orb-diagnostic` to inspect all 10 states, drag the energy slider, and test vowel/consonant viseme presets." |
