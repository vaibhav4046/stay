# Theme audit: landing, app, privacy and terms (2026-10-19)

Method: grep over `src/` for radii, shadows, literal colours, font declarations, heading classes and button overrides, then a visual pass at 390 and 1440 px (screenshots in this folder).

## Found, and what was done

| Drift | Evidence | Fix |
|---|---|---|
| Two font systems. `layout.tsx` loaded DM Sans and Instrument Sans from Google, but `--font-sans` put `-apple-system` first, so Apple devices got SF and everything else got DM Sans. The stylesheet was render-blocking. DESIGN.md already said "next/font". | `globals.css` L18-19 (old), `layout.tsx` `<link rel=stylesheet>` | `next/font/google` (self-hosted at build, size-adjusted fallback, no request to Google at runtime). DM Sans for text, Instrument Sans for headings, on every device. |
| No radius scale. Landing used 14 px cards, a 28 px call to action, and `rounded-2xl` on the video. | `rounded-[28px]` in `page.tsx`, `.card` 14 px, `.btn`/`.field`/`.notice` 10 px as literals | `--radius-control` 10, `--radius-card` 14, `--radius-stage` 28 as `@theme` tokens; `.card`, `.btn`, `.field`, `.notice` read them. The demo frame and the call to action both use `--radius-stage`. |
| No shadow scale. Landing had none, one app panel had `shadow-[0_20px_60px_...]`. | grep `shadow` | `--shadow-lift` and `--shadow-stage`, used by every raised landing surface. |
| Muted ink failed contrast in the design doc (`#747A75` is 4.14:1 on canvas); the code already used `#5C625E` (5.89:1). | computed | DESIGN.md corrected to the code. |
| Three heading styles for the third level (`font-display text-xl font-semibold`, `card-title`, ad-hoc `text-lg`). | grep of heading classes | `.sub-title` added; landing uses `.section-title` (h2), `.sub-title` or `.card-title` (h3). |
| `hidden sm:inline-flex` on a `.btn` never hid anything: `.btn` is unlayered CSS and beats Tailwind's layered utilities. This is why the header could not carry extra links. | header at 390 px overflowed to 688 px when anchors were added | `.btn.nav-sm` / `.btn.nav-lg` in `globals.css`. (Privacy now hides on phones, as the original markup intended.) |
| Stale DESIGN.md: Three.js torus knot, `SignalScene.tsx`. | file read | Rewritten for the dot-field orb. Tokens, scale and landing composition added. |

## Left alone (outside this session's files), for the app owner

- ~25 literal `#006A67` and several `#626B66`, `#212422`, `#F1EFE9`, `#747A75` in `src/app/app/**` and components (e.g. `layout.tsx` nav `style={{ color: active ? '#212422' : '#626B66' }}`, History `OUTCOME_LABEL`). Replace with `var(--color-*)`. `#747A75` in History is the contrast-failing value.
- Radius drift in the app: `rounded-lg` (11), `rounded-2xl` (5), `rounded-xl` (3), `rounded-3xl`/`rounded-t-3xl`, `rounded-[26px]` in `OrbCognitiveGames.tsx`. Map to control, card, stage.
- `OrbCognitiveGames.tsx` uses `backdrop-blur-2xl`, `bg-white/95` and a bespoke shadow, which DESIGN.md rules out ("no glassmorphism").
- Ad-hoc button sizing (`btn ... text-xs py-1.5 px-3`) is ignored today because `.btn` wins over utilities; moving `.btn` into `@layer components` would make those apply and change the app's look, so it was not done here.
- `rounded-[28px]` and old hero classes are gone from the landing page; privacy, terms and 404 already use the shared `.section-title`, `.btn` and `SiteHeader`/`SiteFooter` and now inherit the tokens.
