import { chromium } from '@playwright/test';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3120/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log(JSON.stringify(await page.evaluate(() => {
  const fs = [...document.querySelectorAll('.fd-only-wide .fd-facet')];
  const f = fs[0];
  const cs = getComputedStyle(f);
  const r = f.getBoundingClientRect();
  const chain = []; let e = f; while (e && e.classList && !e.classList.contains('fd')) { const c = getComputedStyle(e); chain.push(`${e.className.toString().slice(0,18)}: ts=${c.transformStyle} disp=${c.display} ov=${c.overflow} op=${c.opacity} flt=${c.filter}`); e = e.parentElement; }
  return { n: fs.length, transform: cs.transform, w: cs.width, h: cs.height, rect: [r.x, r.y, r.width, r.height].map(Math.round), bg: cs.backgroundImage.slice(0, 80), chain, depth: getComputedStyle(document.querySelector('.fd')).getPropertyValue('--depth'), x: f.style.cssText };
}), null, 1));
await browser.close();
