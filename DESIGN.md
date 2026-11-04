# Design System Contract (`DESIGN.md`)

**Aesthetic Direction:** Quiet kinetic instrument  
**Core Principle:** Calm surface, honest typography, one live object (the **Stay Signal**), one primary action per screen. Built for adults with ADHD experiencing task avoidance or executive overload.

---

## 1. Colour Tokens

Stay is dark only. There is no light theme and no theme switch: `color-scheme: dark` is set on `html`, the app and the landing page read the same tokens, and `tests/e2e/darkOnly.spec.ts` guards it. The palette is "Stay Tide": near-black canvas, one cold blue accent, a wave as the motif. Source of truth: `@theme` in `src/app/globals.css`.

| Token | CSS Variable | Value | Usage |
|---|---|---|---|
| Canvas | `--color-canvas` | `#05080C` | Page background (with a faint blue light from above) |
| Surface | `--color-surface` | `#0F1620` | Cards and panels |
| Raised surface | `--color-surface-2` | `#1A2433` | Secondary buttons, raised controls |
| Recessed | `--color-recessed` | `#0B1119` | Wells, tinted bands, metric chips |
| Primary ink | `--color-ink` | `#EEF6FF` | Body text and headings |
| Secondary ink | `--color-ink-2` | `#C5D6E6` | Supporting text |
| Muted ink | `--color-muted` | `#A9BBCF` | Captions, denominators, timestamps |
| Hairline | `--color-line` | `#1E2B3D` | Card borders, row dividers |
| Strong hairline | `--color-line-strong` | `#2D3E55` | Emphasised dividers |
| Field edge | `--color-field-edge` | `#5E7391` | The border of a text field (3:1 against the canvas; hairlines only divide) |
| Accent | `--color-accent` | `#8FD3FF` | Primary button fill, links, focus ring, active state |
| Accent hover | `--color-accent-hover` | `#B8E4FF` | Hover on the primary button and active chips |
| Accent soft | `--color-accent-soft` | `#12304A` | Pressed chip and selected row background |
| Success | `--color-success` | `#5BD6A0` | Works today, completed, started |
| Caution | `--color-caution` | `#F0B35A` | Listening, paused, sample badges |
| Danger | `--color-danger` | `#FF8A80` | Crisis support and destructive actions |
| Night / Night 2 | `--color-night`, `--color-night-2` | `#0A0E15` / `#101722` | The deepest stage: the film, measured results, the closing call to action |
| Night line | `--color-night-line` | `#223045` | Borders on the night stage |
| Night ink / ink-2 / accent | `--color-night-ink`, `-ink-2`, `-accent` | `#EEF6FF` / `#C5D6E6` / `#B8E4FF` | Text and highlight on the night stage |

Contrast (WCAG, computed): on a card (`#0F1620`) ink is 14.4:1, secondary ink 9.5:1, muted 7.3:1, accent 7.6:1, danger 6.9:1; on a raised surface (`#1A2433`) secondary ink is 7.4:1 and muted 5.7:1; dark text on the accent fill is 9.6:1. Text never drops below 4.5:1.

### Radius and shadow scale (one for every page)

| Token | Value | Used for |
|---|---|---|
| `--radius-control` | `8px` | Buttons, fields, notices |
| `--radius-card` | `10px` | Every card and panel, the closing call to action included |
| `--radius-stage` | `16px` | The film frame on wide screens. On a phone the film is edge to edge (0) |
| `--shadow-lift` | soft 2-layer | Cards that can be touched (hover lift) |
| `--shadow-stage` | deep 2-layer | The film frame, the call to action |
| `--ease-calm` | `cubic-bezier(.23,1,.32,1)` | Every transition longer than 150 ms |

Pages use these tokens. A literal `border-radius` on a card, an ad-hoc `box-shadow` or a literal hex in a component is drift.

### Surfaces and buttons

- One card family: `.card` and `.facet` share face, border, radius and hover. Cards, chips, secondary buttons and notices are translucent, never blurred.
- The sticky header (landing and app) is the only frosted surface, plus the sheets and the call that sit over live content, and, for the 1.2 s of its fold, the second screen of the hero device (see 3).
- One primary button: a flat accent fill with dark text (`.btn-primary`). No gradient, no glow.
- No eyebrow labels and no uppercase tracked labels. A heading introduces its own section; footer column labels are plain medium-weight text.

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
3. **The Fold (the landing hero: `HeroExample.tsx`, `FoldFrame.tsx`, `fold.css`):**
   - A generic dual-screen foldable (original art, no real product's lines or marks) plays the recorded test call. Screen A (left) takes the first half of the call, the call continues on screen B (right), and the solved step lands last on B. At the end of the scene B swings shut over A about the hinge (perspective, `rotateY(-165deg)`, ease in and out), going translucent and blurred like frosted glass, the next scene is swapped in while it is shut, and it unfolds and the new call begins. About 1.2 s. Only `transform`, `opacity` and `filter` move.
   - Colour is the one place the page goes beyond the single cold blue, and it is all tokens: a rim from `--color-accent` through `--color-accent-deep` to `--color-success`, an amber hinge (`--color-caution`), dark screens, the person's bubbles a blue-to-teal gradient, Stay's bubbles a surface tone with a teal edge, the solved step a green-tinted card, and a soft blue, green and amber light behind. The derived tokens (`--fd-*`) are defined once at `:root` in `fold.css`.
   - Under 640px the device is stacked (hinge horizontal, A on top, B below, the fold turns about the horizontal hinge). Everything on it is sized in one design pixel (`--u`), so the device, its text and its art scale together and never overflow.
   - The art is `aria-hidden`; the words are real text, and the same exchange is in a list for screen readers (first screen, then second). Reduced motion: no fold and no word-by-word, both screens drawn full. The full-screen grain is switched off while a fold runs (it forces a re-blend of the whole page on every frame).

---

## 4. Anti-Bloat & ADHD Ergonomics Rules

- **One primary action per screen state.** While the focus timer is running, secondary chrome recedes.
- **Zero visual noise:** No neon gradients, no glassmorphism, no floating chat widgets, no fake social proof, no unrequested popups, and no gamified streak shame. The hero device (3) is the one sanctioned exception, and it is restrained: tokens only, and the glass appears only during its fold.
- **Always-available Quiet Mode:** Users can switch between Voice + Text and Quiet Text-Only in one click from the workspace header.

---

## 5. Landing page composition

- Dark only, in two depths: sections on `--color-canvas`, and the night stages (`.lp-night`) for the film and the measured results. Night means "evidence you can watch or measure"; the sections between them carry the explanation.
- Every interactive block has a real, labelled data source: sample data is badged **Sample** and built from the same functions as the real screens; measured numbers are copied from `docs/` with their limits beside them.
- Motion only explains: bars grow once when scrolled to, chips reshape the orb. Scroll reveals are armed only after hydration and never when reduced motion is requested, so content can never be hidden by a failed script.
- Below-the-fold sections hold no canvas. The only WebGL surface lives in the app.
- The film plays as a stage: 16:9, muted and looping while on screen. On a phone its Sound and Captions buttons sit in a row under the picture; from 768px they overlay the top right corner.
