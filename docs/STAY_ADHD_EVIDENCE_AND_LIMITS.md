# Stay — ADHD Clinical Evidence Base & Ethical Boundaries (`docs/STAY_ADHD_EVIDENCE_AND_LIMITS.md`)

**Date:** 17 October 2026  
**Clinical Focus:** Adult Attention-Deficit/Hyperactivity Disorder (ADHD) & Executive Dysfunction

---

## 1. Clinical Neuropsychology & Evidence Base

Stay is built upon peer-reviewed clinical research in adult executive dysfunction and cognitive neuroscience, specifically addressing the failure of traditional productivity software for neurodivergent minds.

### 1.1 The "Point of Performance" Theory (Barkley, 2012)
Dr. Russell A. Barkley's clinical model of ADHD demonstrates that ADHD is **not a disorder of knowledge, but a disorder of performance at the point of action**:
> *"ADHD is not an impairment in knowing what to do; it is an impairment in doing what you know at the exact time and place where it would be useful."* — Russell Barkley, Ph.D.

Traditional to-do apps, kanban boards, and calendars overload the prefrontal cortex with future decisions, exacerbating working memory deficit. Stay operates exclusively at the **Point of Performance**:
- It asks for only one task.
- It removes all future planning cognitive load.
- It immediately negotiates a physical micro-step that can be initiated in under 120 seconds.

### 1.2 Activation Paralysis & Micro-Commitments (Dawson & Guare, 2016)
Executive functioning research identifies *Task Initiation* as a discrete neurological barrier mediated by dopaminergic pathways. When a task appears large, boring, or ambiguous, the executive brain triggers an avoidance response that mimics physical freezing.

Stay implements **Threshold Lowering**: reducing the initial effort below the amygdala's threat threshold. By agreeing to a sub-two-minute step (e.g. *"Just open the envelope"*, *"Just put your fingers on the keyboard for 60 seconds"*), dopamine fires upon initiation, allowing natural momentum to take over.

### 1.3 Virtual Body Doubling & External Anchors (Tuckman, 2012)
Research confirms that having a supportive, non-judgmental presence nearby dramatically increases task initiation rates for adults with ADHD. The Stay Signal orb acts as a gentle, quiet kinetic anchor—providing visual auditory rhythm without intrusive notifications, gamification shame, or guilt-inducing streaks.

### 1.4 NICE Guideline [NG87] Alignment
NICE (National Institute for Health and Care Excellence) guidelines recommend non-pharmacological executive support:
- Environmental structure and task compartmentalization.
- Consistent habit-tracking tools.
- Regular physician consultations supported by structured symptom and adherence logs.

---

## 2. The 5 Executive Friction Barriers

Stay's deterministic and LLM-assisted coaching engines classify user hesitation into 5 discrete neuropsychological barriers:

| Barrier | Cognitive State | Stay Intervention Strategy |
|---|---|---|
| **Overwhelm** | Prefrontal cognitive collapse from too many variables. | **Radical Isolation:** Shrink scope to a single physical action; defer all subsequent steps. |
| **Under-Arousal** | Insufficient dopamine; task is monotonous or dry. | **Sensory Coupling:** Add a quick timer sprint, background instrumental audio, or kinetic challenge. |
| **Ambiguity** | "Fuzzy task"; user doesn't know what "done" looks like. | **Definition of First Action:** Clarify the physical starting point (e.g., locate login credentials). |
| **Perfectionism** | Anxiety over flawed output; all-or-nothing paralysis. | **Permission for Slop:** Deliberately create an ugly draft or throwaway outline for 3 minutes. |
| **Resistance** | Emotional aversion to administrative paperwork or red tape. | **Tiny Micro-Slice:** Commit to 90 seconds of exposure; option to stop completely afterwards. |

---

## 3. Strict Clinical & Ethical Boundaries

To protect patient safety and comply with MHRA / FDA digital health software guidance, Stay enforces unambiguous ethical guardrails:

### What Stay DOES:
- ✅ Provides voice and text coaching strictly for **task initiation** and breaking down daily work.
- ✅ Employs a focus timer with Screen Wake Lock to maintain presence during working sprints.
- ✅ Records daily treatment check-ins (taken/skipped, sleep, focus rating) purely as observational self-reports.
- ✅ Compiles an objective, 1-page Clinician Summary PDF for patients to bring to their own doctor.
- ✅ Respects user agency: patients decide which data to share and can wipe all data in one click.

### What Stay Explicitly DOES NOT Do:
- ❌ **Never Diagnoses ADHD:** Stay never provides clinical diagnostic screening, ASRS scores, or diagnostic confirmation.
- ❌ **Never Prescribes or Titrates Medications:** Stay never advises on dosages, medication changes, drug holidays, or off-label use. All medication management belongs strictly to the patient's prescribing physician.
- ❌ **Never Replaces a Healthcare Professional:** Stay is an assistive task initiation tool, not medical software or psychotherapy.
- ❌ **No Dopamine Shamming:** No streak breaks, no angry mascots, no shame notifications, no guilt triggers.

---

## 4. Emergency Crisis Guardrail Protocol

Stay incorporates a deterministic, regex-based crisis safety filter that intercepts inputs before any LLM inference occurs (`src/lib/safety/crisis.ts`):

- **Trigger Terms:** Self-harm, suicide, severe depressive hopelessness, wanting to disappear.
- **Immediate Action:** Bypasses coach plan generation entirely.
- **Safety Response:** Mounts the Crisis Modal immediately with localized emergency helplines:
  - **UK:** NHS Mental Health (`111`), Emergency (`999`), Samaritans (`116 123`).
  - **US / Canada:** Suicide & Crisis Lifeline (`988`), Crisis Text Line (`HOME to 741741`).
  - **International:** Befrienders Worldwide & IASP portal (`findahelpline.com`).
