# Stay — Hackathon Demo Script (2:00 Judge-Proof Rehearsal)

**Target Video Duration:** 2 minutes (120 seconds)  
**Resolution:** 1080p (1920 × 1080) or 1440 × 900  
**Audio Setup:** Clean USB condenser microphone, headphones (to prevent loopback acoustic echo)  
**Theme:** Light Mode (forced standard palette)  

---

## Script & Timeline

### 0:00 – 0:12 | The Real Problem in Real Words
- **Visual:** Browser opens to `https://stay-two-swart.vercel.app/app/today`.
- **Spoken:**
  > "For someone with ADHD, the hardest part of the day isn't doing the work — it's the executive paralysis before starting, or blanking out when walking into a clinician appointment. Stay is a calm, voice-first companion built with AssemblyAI Universal-3.6 Pro and AssemblyAI-TTS-1."

### 0:12 – 0:40 | Talk: Fluid Stream, Corrections, and Barge-In
- **Action:** Click "Talk" or hold `Space` to start voice.
- **Spoken:**
  > "I have to file my quarterly self-assessment taxes by Friday, scratch that, I just need to open the receipt folder."
- **Visual Callout:**
  - Watch live words stream word-by-word into `LiveChatBox`.
  - Notice "scratch that" dynamically rewrites the preceding clause.
  - Stay begins speaking: *"Let us open the folder right now..."*
- **Action (Barge-In):** Interrupt Stay mid-sentence:
  > "Wait, stop — actually, let me get a glass of water first."
- **Visual Callout:**
  - Stay stops talking when you speak over it (stop time is measured in the test lab, not claimed here).
  - Status transitions to `Interrupted`.
  - Stay acknowledges: *"Water first. Grab the glass."*
  - Open **More, Voice and language**, scroll to **Voice connection** and click the badge to reveal the diagnostics sheet: `streaming.assemblyai.com`, `universal-3-6-pro`, `tts.us.assemblyai.com`, `assemblyai-tts-1`.

### 0:40 – 1:00 | Multilingual Code-Switching & Accent Switching
- **Action:** Open Voice and language and pick another voice (Adrienne, British; Andrew, Indian English; and Constanza, Mexican Spanish, are all AssemblyAI voices; Kavya, female Indian English, uses Azure or the device and is labelled that way), or speak Hinglish:
  > "Mujhe taxes file karna hai lekin shuruat kahan se karun?"
- **Visual Callout:**
  - Universal-3.6 Pro detects Hindi/Hinglish.
  - Stay answers in Roman-letter Hinglish, and the badge says which voice is speaking.

### 1:00 – 1:35 | Prepare for a Visit (Clinician Report PDF)
- **Action:** Navigate to **Report** (`/app/reports`).
- **Spoken:**
  > "When preparing for an ADHD review, people forget what happened over the last two weeks. Stay takes self-tracked initiation sessions, strategies, and daily check-ins to build a one-page clinician handout."
- **Action:** Click "Download one-page PDF".
- **Visual Callout:**
  - Green confirmation banner: `Downloaded stay-summary-YYYY-MM-DD.pdf successfully.`
  - Open PDF showing structured initiation rate, behavioral strategies with sample denominators, and appointment questions on page 1.

### 1:35 – 1:50 | Call Stay, then a focus block
- **Action:** Back on `/app/today`, press Call Stay: it rings, Stay answers, then end the call and start a 2-minute focus block.
- **Visual Callout:**
  - The call screen shows a ringing state, then a running clock, Mute and End.
  - Start a 2-minute focus block: clean timer line with zero guilt.

### 1:50 – 2:00 | Honest Wrap-Up
- **Spoken:**
  > "Stay is not therapy, not a diagnosis, and never provides medical or medication advice. It's real-time AssemblyAI streaming audio engineering built for genuine executive function support. All test results and benchmarks are open in docs/evidence."
