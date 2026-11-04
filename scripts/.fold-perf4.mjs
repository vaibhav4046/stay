// throwaway: where in the fold are the slow frames?
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3120/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
for (const id of ['study', 'rent']) {
  const res = await page.evaluate((sid) => new Promise((resolve) => {
    const fd = document.querySelector('.fd');
    const rows = [];
    const t0 = performance.now();
    let last = t0;
    document.querySelector(`[data-testid=hero-scene-${sid}]`).click();
    const tick = (n) => {
      rows.push([Math.round(n - t0), Math.round(n - last), fd.dataset.phase]);
      last = n;
      if (n - t0 < 1800) requestAnimationFrame(tick); else resolve(rows);
    };
    requestAnimationFrame(tick);
  }), id);
  console.log(id, res.filter((r) => r[1] > 20).map((r) => r.join(':')).join('  '), ' | frames', res.length);
  await page.waitForTimeout(2500);
}
await browser.close();
