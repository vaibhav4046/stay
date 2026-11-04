// throwaway: which part of the fold costs frames? try CSS variants without rebuilding
import { chromium } from '@playwright/test';

const base = 'http://localhost:3120';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const measure = (page, ms) => page.evaluate((span) => new Promise((resolve) => {
  const d = [];
  let last = performance.now();
  const end = last + span;
  const tick = (n) => { d.push(n - last); last = n; if (n < end) requestAnimationFrame(tick); else { d.shift(); const s = [...d].sort((a, b) => a - b); resolve(`avg ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)} p95 ${s[Math.floor(s.length * 0.95)].toFixed(1)} max ${s[s.length - 1].toFixed(1)} n${d.length}`); } };
  requestAnimationFrame(tick);
}), ms);

const NB = 'body::after { display: none !important; }';
const NOCHILD = '.fd[data-phase] .fd-b .fd-screen, .fd[data-phase] .fd-b .fd-glass { animation: none !important; }';
const NOSH = '.fd-half { box-shadow: none !important; }';
const NOAB = '.fd[data-phase] .fd-a .fd-screen { animation-name: none !important; }';
const NOBBLUR = '@keyframes fd-b-close { from { transform: var(--fd-open); opacity: 1; } to { transform: var(--fd-shut); opacity: .74; } } @keyframes fd-b-open { 0% { transform: var(--fd-shut); opacity: .74; } 80% { transform: var(--fd-over); opacity: 1; } 100% { transform: var(--fd-open); opacity: 1; } }';
const variants = {
  nb: NB,
  nb_noSh: NB + NOSH,
  nb_noAB: NB + NOAB,
  nb_noSh_noAB: NB + NOSH + NOAB,
  nb_noSh_noAB_noBBlur: NB + NOSH + NOAB + NOBBLUR,
  nb_noSh_noAB_noChild: NB + NOSH + NOAB + NOCHILD,
  nb_noBBlur: NB + NOBBLUR,
};
for (const [name, css] of Object.entries(variants)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: css || '/* none */' });
  const out = [];
  for (const id of ['study', 'rent', 'decide']) {
    await page.getByTestId(`hero-scene-${id}`).click();
    out.push(await measure(page, 1500));
    await page.waitForTimeout(300);
  }
  console.log(name.padEnd(22), out.join(' | '));
  await ctx.close();
}
await browser.close();
