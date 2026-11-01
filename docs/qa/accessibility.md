# Accessibility & Screen Reader Audit (WCAG 2.1 AA / AAA)

**Evaluator:** Accessibility Specialist  
**Standard:** WCAG 2.1 Level AA & selected AAA (Contrast, Reduced Motion)  
**Tools:** Keyboard Tab Traversal, Chrome DevTools A11y Tree, Emulated Screen Reader  

---

### Audit Findings

#### 1. Keyboard Navigation & Focus Order
- **Focus Rings:** Distinct `:focus-visible` styles with `#006A67` 2 px outline on all interactive buttons, inputs, tabs, and chips.
- **Logical Flow:** Tab moves sequentially: Top Wordmark -> Navigation Links -> Urgent Help -> Mode Tabs (`role="tablist"`) -> Language Chips -> Transport Badge -> Chat Clear & Expand -> Live Message List -> Dock Input -> Send / Stop -> More.
- **Spacebar Shortcut:** Holding `Space` anywhere outside an active text input starts live voice streaming; releasing commits speech.
- **Verdict:** **PASS.**

#### 2. Screen Reader Semantics (`aria-live` & Roles)
- **Live Stream Chatter Prevention:** Word-by-word streaming partials use `aria-live="off"` inside `chat-message-list` (`role="log"`) to avoid deafening continuous chatter for screen reader users.
- **Polite Turn Announcements:** Only completed turns and major state transitions (`Speaking`, `Listening`, `Interrupted`) are announced via a dedicated `aria-live="polite"` element.
- **Labels:** All icon-only buttons (`chat-toggle-btn`, `chat-clear-btn`, `SubtleOrb`, `TransportBadge`) have explicit `aria-label` attributes.
- **Verdict:** **PASS.**

#### 3. Color Contrast Compliance
- Forced light mode palette ensures deterministic contrast regardless of host OS theme:
  - Text on Background: `#212422` on `#FBF9F4` $\approx 14.8:1$ (exceeds AAA requirement of 7:1).
  - Secondary Text: `#4A4F4B` on `#FBF9F4` $\approx 7.2:1$ (exceeds AA requirement of 4.5:1).
  - Primary Accent: `#006A67` on `#FBF9F4` $\approx 5.8:1$ (exceeds AA requirement of 4.5:1).
- **Verdict:** **PASS.**

#### 4. Reduced Motion (`prefers-reduced-motion`)
- When user enables reduced motion, all CSS transitions and animations in `globals.css` are overridden to `transition: none !important; animation: none !important`.
- Orb particle physics and spring animations collapse to static states.
- **Verdict:** **PASS.**
