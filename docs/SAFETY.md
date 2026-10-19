# Safety and boundaries

Stay is a self-help and self-tracking companion. It is not a medical device, does not diagnose ADHD or any condition, and does not replace a clinician.

## What it will not do

* **No medication advice.** Dose, mixing, "is it safe" and "should I stop" questions get a fixed reply that points to a prescriber or pharmacist. The reply is fixed text, not model output, and the question never reaches a language model (`detectMedicationAdviceRequest`, checked in the browser and again in `/api/coach/plan`, `/api/coach/triage`, `/api/voice/chat`, `/api/orb/shape`).
* **No diagnosis, no clinical claims.** Strategy statistics are the person's own counts, shown with the exact numbers and a warning when there are fewer than five sessions.
* **No coaching in a crisis.** `detectCrisisSignal` is deterministic and multilingual (more than 30 languages, spaced-out and squashed spellings). When it fires, coaching stops, timers do not start, and help is shown: 999, NHS 111 and Samaritans 116 123, and findahelpline.com for anywhere outside the UK. The text is never sent to a language model, a shape service or into a list.
* **Voice cannot delete data.** "Delete my data" by voice only opens Settings; the person presses the button.
* **Shame-free language.** Unfinished items quietly move to "later". There is no overdue, no streak to lose.

## What is tested

The crisis and medication detectors have unit tests with genuine phrasings in many languages and ordinary sentences that must not trigger; the HTTP routes are tested end to end (`tests/e2e/safetyAndPrivacy.spec.ts`); a crisis in a brain dump and in the orb shape service goes to help and never into a list or a picture.

## Known limits

* The detectors are word-based. They will miss some phrasings and will occasionally fire on innocent ones; they are a floor, not a clinical instrument.
* Crisis resources are UK-first. Elsewhere the person is pointed to their local emergency number and findahelpline.com.
* Stay has not been clinically trialled (see `STAY_ADHD_EVIDENCE_AND_LIMITS.md`).
* Speech recognition and a language model can both be wrong; Stay says so rather than guessing, and never acts on a destructive voice command.
