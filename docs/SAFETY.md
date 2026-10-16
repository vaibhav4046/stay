# Safety & Clinical Boundaries (`docs/SAFETY.md`)

## 1. Fixed Crisis Protocol (UK Default)

Stay is a task-initiation and self-tracking companion, **not** an emergency or crisis service.

### Trigger Mechanism
- Every spoken user transcript (`transcript.user` / `transcript.user.delta`) and every typed task or check-in note is checked by a deterministic regex/keyword classifier (`detectCrisisSignal` in `src/lib/safety/crisis.ts`) before any LLM planning call.
- Matched signals include expressions of self-harm, suicide, wanting to end one's life, overdose intent, or immediate danger.

### Immediate Deterministic Action
When a crisis signal is detected:
1. Any active voice session is immediately terminated (`session.end`).
2. Any running focus timer is paused.
3. The LLM coach does **not** improvise therapeutic or crisis counselling.
4. The fixed **Crisis Help Panel** opens immediately in the foreground with one-tap links and plain instructions:
   - **Emergency Services (UK):** Call **999** or go to the nearest A&E if you or someone else is in immediate physical danger.
   - **NHS Mental Health Services:** Call **111** (select the mental health option) for urgent mental health support.
   - **Samaritans (24/7, free):** Call **116 123** or email `jo@samaritans.org`.
   - **Crisis Text Line (Shout UK):** Text **SHOUT** to **85258**.
   - **International:** If outside the UK, contact your local emergency number or visit `https://findahelpline.com`.

---

## 2. Medication & Dosing Guardrail

- Stay allows users to record **observational self-logs** (`taken`, `skipped`, `not_applicable`, `prefer_not_to_say`, focus rating, sleep quality, and plain-text notes for their clinician).
- Stay **never**:
  - Recommends starting, stopping, skipping, splitting, or doubling a dose.
  - Suggests specific medications or compares stimulant/non-stimulant regimens.
  - Interprets side effects clinically.
- When `detectMedicationAdviceRequest()` detects a dosing or medication advice question (e.g., *"Should I take an extra 20mg?"*, *"Can I stop taking Elvanse?"*, *"What dose should I take?"*), Stay returns a fixed boundary response:
  > *"Stay cannot advise on medication, doses, or side effects. Please check your prescription label or contact your prescribing clinician, GP, or pharmacist. If you feel unwell and need urgent medical advice, call NHS 111 or 999 in an emergency."*

---

## 3. Non-Diagnostic & Evidence Boundary

- Stay never screens for or diagnoses ADHD.
- The Clinician Summary PDF includes a prominent footer and header disclaimer:
  > *"User-generated self-tracking summary from Stay. Not a clinical assessment, diagnostic instrument, or medical device record."*
