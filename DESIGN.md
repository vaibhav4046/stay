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
| Muted Ink | `--text-muted` | `#747A75` | Captions, sample denominators, timestamps |
| Subtle Hairline | `--border-subtle` | `#E9E6DF` | Card borders and row dividers |
| Strong Hairline | `--border-strong` | `#D5D1C8` | Active input borders and emphasized dividers |
| Primary Accent | `--accent-primary` | `#006A67` | Deep mineral teal — primary CTA & active state |
| Accent Hover | `--accent-hover` | `#005653` | Hover state for primary CTA |
| Accent Soft | `--accent-soft` | `#E4F0EF` | Subtle active pill background |
| Focus Ring | `--focus-ring` | `#006A67` | `2px solid` accessible keyboard focus outline |
| Success | `--state-success` | `#236B48` | Completed / started session indicator |
| Caution | `--state-caution` | `#9A6318` | Listening / paused / preliminary sample notice |
| Danger | `--state-danger` | `#B23A2E` | Crisis support trigger & destructive actions |

---

## 2. Typography

- **Primary Font Family:** `DM Sans` (loaded via `next/font/google` with system human-sans fallback).
- **Display / Instrument Accent:** `Instrument Sans` for crisp structural headers and numerals.
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
2. **The Stay Signal (`SignalScene.tsx`):**
   - Lazy-loaded Three.js WebGL sculptural audio instrument: a Matte Mineral Torus-Knot / Harmonic Ring assembly with warm studio key lighting on `#FAF8F5`.
   - Driven by 9 explicit semantic states (`idle`, `connecting`, `listening`, `thinking`, `speaking`, `interrupted`, `saving`, `complete`, `error`) and smoothed local RMS microphone energy (`0.0–1.0`).
   - Respects `prefers-reduced-motion: reduce` (renders a calm, still sculptural frame) and provides a crisp non-WebGL SVG harmonic fallback (`SignalFallbackSvg`) when WebGL is unavailable.

---

## 4. Anti-Bloat & ADHD Ergonomics Rules

- **One primary action per screen state.** While the focus timer is running, secondary chrome recedes.
- **Zero visual noise:** No neon gradients, no glassmorphism, no floating chat widgets, no fake social proof, no unrequested popups, and no gamified streak shame.
- **Always-available Quiet Mode:** Users can switch between Voice + Text and Quiet Text-Only in one click from the workspace header.
