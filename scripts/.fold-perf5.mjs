// throwaway: slow frames per fold under CSS variants (no rebuild)
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const NOCHILD = '.fd[data-phase] .fd-b .fd-screen, .fd[data-phase] .fd-b .fd-glass { animation: none !important; }';
const NOSH = '.fd-half { box-shadow: none !important; }';
const NOA = '.fd[data-phase] .fd-a .fd-screen { animation: none !important; }';
const NOGLOW = '.fd[data-phase] .fd-hinge-glow { animation: none !important; }';
const NOWILL = '.fd-b { will-change: auto !important; }';
const NOBBLUR = '@keyframes fd-b-close { from { transform: var(--fd-open); opacity: 1; } to { transform: var(--fd-shut); opacity: .74; } } @keyframes fd-b-open { 0% { transform: var(--fd-shut); opacity: .74; } 80% { transform: var(--fd-over); opacity: 1; } 100% { transform: var(--fd-open); opacity: 1; } }';
const SM = '.fd { --fd-blur: calc(var(--u) * 2); }';
const variants = { base: '', noBBlur: NOBBLUR, noA: NOA };
for (const [name, css] of Object.entries(variants)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3120/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: css || '/* none */' });
  const counts = [];
  for (const id of ['study', 'rent', 'decide', 'study', 'rent', 'decide', 'study', 'rent']) {
    const r = await page.evaluate((sid) => new Promise((resolve) => {
      const fd = document.querySelector('.fd');
      let last = performance.now(); const t0 = last; let c = 0, o = 0, n = 0;
      document.querySelector(`[data-testid=hero-scene-${sid}]`).click();
      const tick = (t) => { const d = t - last; last = t; n++; if (d > 22) { if (fd.dataset.phase === 'closing') c++; else o++; } if (t - t0 < 1500) requestAnimationFrame(tick); else resolve([c, o, n]); };
      requestAnimationFrame(tick);
    }), id);
    counts.push(`${r[0]}c/${r[1]}o of ${r[2]}`);
    await page.waitForTimeout(400);
  }
  console.log(name.padEnd(16), counts.join(' | '));
  await ctx.close();
}
await browser.close();
