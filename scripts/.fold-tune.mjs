// throwaway: try tall (stacked) screen heights and font sizes without rebuilding
import { chromium } from '@playwright/test';

const base = 'http://localhost:3120';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'networkidle' });
for (const [fs, od, sh, pad, gap] of [[14.5, 14, 376, 8, 8], [14, 13, 360, 8, 8], [14, 13, 350, 7, 6], [13.5, 13, 340, 7, 6], [14, 13, 330, 6, 6]]) {
  await page.addStyleTag({ content: `@media (max-width: 639.98px) { .fd .fd-bubble { font-size: calc(var(--u) * ${fs}) !important; padding-block: calc(var(--u) * ${pad}) !important; } .fd-outcome-detail { font-size: calc(var(--u) * ${od}) !important; } .fd-thread { gap: calc(var(--u) * ${gap}) !important; } }` });
  await page.evaluate((v) => { document.querySelector('.fd').style.setProperty('--tall-sh', String(v)); }, sh);
  const rows = [];
  for (const id of ['doomscroll', 'decide', 'rent', 'study']) {
    await page.getByTestId(`hero-scene-${id}`).click();
    await page.waitForTimeout(120);
    rows.push(await page.evaluate(() => [...document.querySelectorAll('.fd-screen')].map((s) => { const t = s.querySelector('.fd-thread'); const kids=[...t.children]; const used=kids.reduce((a,k)=>a+k.getBoundingClientRect().height,0)+Math.max(0,kids.length-1)*parseFloat(getComputedStyle(t).rowGap); return Math.round(t.clientHeight-used); }).join('/')));
  }
  console.log(`fs ${fs} od ${od} sh ${sh} pad ${pad} gap ${gap} -> overflow A/B per scene:`, rows.join('  '));
}
await browser.close();
