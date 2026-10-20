# Design System Contract (`DESIGN.md`)

**Aesthetic Direction:** Quiet kinetic instrument  
**Core Principle:** Calm surface, honest typography, one live object (the **Stay Signal**), one primary action per screen. Built for adults with ADHD experiencing task avoidance or executive overload.

---

## 1. Colour Tokens

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Canvas | `--bg-canvas` | `#FAF8F5` | Warm stone primary page background |
| Elevated Surface | `--bg-surface` | `#FFFFFF` | Primary workspace card surface |
| Recessed Surface | `--bg-recessed` | `#F1EFE9` | Secondary panels, tabs, code/metric chips |
| Primary Ink | `--text-primary` | `#212422` | Deep warm charcoal body & headings |
| Secondary Ink | `--text-secondary` | `#626B66` | Supporting labels & descriptions |
| Muted Ink | `--color-muted` | `#5C625E` | Captions, sample denominators, timestamps (5.9:1 on canvas; the old `#747A75` was 4.1:1 and failed AA for small text) |
| Subtle Hairline | `--border-subtle` | `#E9E6DF` | Card borders and row dividers |
| Strong Hairline | `--border-strong` | `#D5D1C8` | Active input borders and emphasized dividers |
| Primary Accent | `--accent-primary` | `#006A67` | Deep mineral teal — primary CTA & active state |
| Accent Hover | `--accent-hover` | `#005653` | Hover state for primary CTA |
| Accent Soft | `--accent-soft` | `#E4F0EF` | Subtle active pill background |
| Focus Ring | `--focus-ring` | `#006A67` | `2px solid` accessible keyboard focus outline |
| Success | `--state-success` | `#236B48` | Completed / started session indicator |
| Caution | `--state-caution` | `#9A6318` | Listening / paused / preliminary sample notice |
| Danger | `--state-danger` | `#B23A2E` | Crisis support trigger & destructive actions |
| Night / Night 2 | `--color-night`, `--color-night-2` | `#15201E` / `#1E2D2A` | The dark stage: demo frame, measured results, closing call to action |
| Night ink / ink-2 / accent | `--color-night-ink`, `-ink-2`, `-accent` | `#F3F1EC` / `#B3BDB8` / `#6FD0C8` | Text and highlight on the dark stage (all above 7:1 on Night) |

### Radius and shadow scale (one for every page)

| Token | Value | Used for |
|---|---|---|
| `--radius-control` | `10px` | Buttons, fields, notices, segmented controls |
| `--radius-card` | `14px` | Cards, panels, artifact cards |
| `--radius-stage` | `28px` | The demo frame, the dark stage, the closing call to action. On a phone the demo frame is edge to edge (0) |
| `--shadow-lift` | soft 2-layer | Cards that can be touched (hover lift, artifacts) |
| `--shadow-stage` | deep 2-layer | The demo frame, the story stage, the call to action |
| `--ease-calm` | `cubic-bezier(.22,.61,.36,1)` | Every transition longer than 150 ms |

Pages must use these tokens (`rounded-[…]`, ad-hoc `box-shadow` and literal hex in components are the known drift; see `docs/landing/THEME_AUDIT.md`).

---

## 2. Typography

- **Primary Font Family:** `DM Sans`, self-hosted at build time by `next/font/google` (no request to Google at runtime, size-adjusted fallback so nothing shifts). The same face on every device: the system face is only the fallback.
- **Display / Instrument Accent:** `Instrument Sans` for headings (`.hero-title`, `.section-title`, `.sub-title`, `.card-title`) and numerals. Headings never skip a level: h1, section h2, then h3 (`.sub-title` or `.card-title`).
- **Numeric Discipline:** `font-variant-numeric: tabular-nums` on all timers, durations, denominators, and strategy percentages.
- **Scale:**
  - Hero Headline: `clamp(2rem, 3.6vw, 3.25rem)`, line-height `1.08`, letter-spacing `-0.025em`, weight `600`.
  - Section Title: `clamp(1.35rem, 2.2vw, 1.85rem)`, line-height `1.18`, weight `600`.
  - Workspace Card Title: `1.125rem` (`18px`), line-height `1.35`, weight `600`.
  - Body Copy: `1rem` (`16px`), line-height `1.6`, weight `400`, max measure `65ch`.
  - Metadata / Denominator Label: `0.8125rem` (`13px`), line-height `1.4`, weight `500`.

---

## 3. Custom Visual Signatures

1. **The Stay Mark (`StayMark.tsx`):**
   - Original SVG mark depicting two nested offset harmonic rings with a precision horizon bar — representing a steadying external anchor.
2. **The Stay Signal (the dot-field orb, `Signal.tsx` + `src/lib/orb`):**
   - One field of 3,200 to 5,200 dots. A shape is a different place for the same dots to gather (jelly morphs). Nothing but dots is drawn. When Stay speaks the dots can gather into a calm dot-drawn person (`docs/THERAPIST_ORB.md`).
   - The signature extends to static form: icons on the landing page are the same shapes sampled into SVG dots (`landing/personaDots.ts`), never stock icons.
   - Respects `prefers-reduced-motion` and falls back to a still gradient disc without WebGL.

---

## 4. Anti-Bloat & ADHD Ergonomics Rules

- **One primary action per screen state.** While the focus timer is running, secondary chrome recedes.
- **Zero visual noise:** No neon gradients, no glassmorphism, no floating chat widgets, no fake social proof, no unrequested popups, and no gamified streak shame.
- **Always-available Quiet Mode:** Users can switch between Voice + Text and Quiet Text-Only in one click from the workspace header.

---

## 5. Landing page composition

- Light sections on `--color-canvas`, alternating with a tinted band (`.lp-tint`) and two dark stages (`.lp-night`): the demo and the measured results. Dark means "evidence you can scrub or measure"; everything else is light.
- Every interactive block has a real, labelled data source: sample data is badged **Sample** and built from the same functions as the real screens; measured numbers are copied from `docs/` with their limits beside them.
- Motion only explains: bars grow once when scrolled to, the story stage follows the scroll, chips reshape the orb. Scroll reveals are armed only after hydration and never when reduced motion is requested, so content can never be hidden by a failed script.
- Below-the-fold sections hold no canvas. The only WebGL surface is the hero orb.
