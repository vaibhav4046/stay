# Stay — Browser QA & Responsive Verification (`BROWSER_QA.md`)

**Date:** 2026-10-31  
**Evidence Classification:** `E2E TEST` (Playwright Chromium across `tests/e2e/stay.spec.ts`, `tests/e2e/visualVerification.spec.ts`, `tests/e2e/liveVoiceSync.spec.ts`, `tests/e2e/visual-qa.spec.ts`).

---

## 1. Route-by-Route Verification Matrix

| Route | Core Elements & Interactions Verified | Console / Page Errors | Status |
| :--- | :--- | :--- | :--- |
| **`/` (Landing Page)** | Hero orb, live interactive demo, voice persona gallery with 24 cards & 3D hover transforms, mathematical 5,200-dot procedural therapist inspector (`Inspect All 5,200 Dots` = `5200 / 5200`), UK crisis footer | `0` | **PASS** (`E2E TEST`) |
| **`/app/today` (Main Coach)** | Calm onboarding, 3D Signal Orb (`data-testid="orb-button"`), `StayLogo` inside `Talk to Stay` capsule (`data-testid="mic-button"`), multi-ribbon Gemini-Live wave (`data-testid="voice-wave-svg"`), progressive live captions (`data-testid="caption"`), AGI proactive action chips, plan card, monotonic focus timer, non-judgmental outcome card, Today list, Brain Dump sheet, Voice Picker sheet, Memory sheet | `0` | **PASS** (`E2E TEST`) |
| **`/app/history` (History & Patterns)** | Session timeline, strategy start-rate insights, barrier frequency breakdown, empty-state handling | `0` | **PASS** (`E2E TEST`) |
| **`/app/treatment` (Daily Check-In)** | Non-clinical sleep/mood/focus/context check-in sliders, medication boundary notice | `0` | **PASS** (`E2E TEST`) |
| **`/app/reports` (Clinician Summary)** | Printable/copyable clinician & self-review summary, JSON/Markdown export | `0` | **PASS** (`E2E TEST`) |
| **`/app/settings` (Settings & Privacy)** | Care context selector, Quiet Mode toggle, BYOK LLM/AssemblyAI/Azure configuration, full JSON data export, 2-step destructive data wipe | `0` | **PASS** (`E2E TEST`) |
| **`/privacy` (Privacy & Safety)** | Plain-English data storage notice, UK crisis resources (`999`, `NHS 111`, `Samaritans 116 123`, `Shout 85258`) | `0` | **PASS** (`E2E TEST`) |

---

## 2. Viewport & Responsive Layout Matrix

Verified with zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`):

| Viewport Width | Device Class | Layout Verification | Status |
| :--- | :--- | :--- | :--- |
| **320 px** (`320x568`) | Small Mobile (iPhone SE) | Single-column stack, orb scales via `min(74vw,36dvh,420px)`, bottom nav accessible | **PASS** (`E2E TEST`) |
| **390 px** (`390x844`) | Standard Mobile (iPhone 14) | Touch targets >= 40px, input + `Talk to Stay` capsule fit without clipping | **PASS** (`E2E TEST`) |
| **768 px** (`768x1024`) | Tablet (iPad Mini) | 2-column voice picker grid, centered `max-w-xl` focus workspace | **PASS** (`E2E TEST`) |
| **1280 px** (`1280x960`) | Desktop Laptop | Full visual verification suite captured (`docs/verification-screenshots/01..10`) | **PASS** (`E2E TEST`) |
| **1920 px** (`1920x1080`) | Widescreen Desktop | Balanced typography, zero layout drift, crisp WebGL/Canvas rendering | **PASS** (`E2E TEST`) |

---

## 3. Portable Visual Proof Inventory (`docs/verification-screenshots/` & `test-results/`)

1. `01-today-idle-with-logo-no-face.png` — `/app/today` idle state with `StayLogo` in voice capsule, hidden `sr-only` face toggle, and proactive voice chips.
2. `02-talk-to-stay-capsule-closeup.png` — Closeup of `Talk to Stay` capsule with `StayLogo` and multi-ribbon wave support.
3. `03-voice-picker-recommended-cards.png` — ElevenLabs-style voice persona cards with 3D dot glyphs.
4. `04-card-22-mariachi-metronome-hover.png` — Card 22 (`Mariachi Metronome`) with 3D hover transform and 20s preview button.
5. `05-voice-card-direct-click-selected.png` — Direct card click immediately arming `Countdown Cookie` (`!border-primary`).
6. `06-voice-armed-today-receipt.png` — Armed voice confirmation receipt on `/app/today`.
7. `07-landing-5200-dot-count-verifier.png` — Landing page mathematical dot verifier (`5,200 / 5,200 dots`).
8. `08-live-voice-idle-with-logo.png` — Live voice sync idle state verification.
9. `09-hi-hello-responsive-input.png` — Conversational greeting input (`"Hi hello"`) before progressive reveal.
10. `10-responsive-plan-card.png` — Task decomposition plan card (`"Do my taxes"` -> micro-step + timer blocks).
