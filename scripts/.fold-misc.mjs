// throwaway: reduced motion, no scripting, odd widths
import { chromium } from '@playwright/test';
const OUT = 'C:/Users/lalwa/AppData/Local/Temp/claude/D--/697552a1-f809-44de-a453-57c714bd21a7/scratchpad/fold';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const shot = async (name, opts, vp, after) => {
  const ctx = await browser.newContext({ viewport: vp, ...opts });
  const page = await ctx.newPage();
  await page.goto('http://localhost:3120/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  if (after) await after(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  const info = await page.evaluate(() => ({ bubbles: document.querySelectorAll('.fd .bubble').length, over: document.documentElement.scrollWidth - document.documentElement.clientWidth, outcome: !!document.querySelector('[data-testid=hero-outcome]') }));
  console.log(name, JSON.stringify(info));
  await ctx.close();
};
await shot('reduced-1280', { reducedMotion: 'reduce' }, { width: 1280, height: 800 });
await shot('reduced-390', { reducedMotion: 'reduce' }, { width: 390, height: 1400 });
await shot('nojs-1280', { javaScriptEnabled: false }, { width: 1280, height: 800 });
await shot('w1100', {}, { width: 1100, height: 800 });
await shot('w1920', {}, { width: 1920, height: 1080 });
await shot('w320', {}, { width: 320, height: 1200 });
await browser.close();
