// throwaway: does every scene fit its screens (reduced motion = everything drawn) at each width?
import { chromium } from '@playwright/test';

const base = 'http://localhost:3120';
const browser = await chromium.launch({ args: ['--mute-audio'] });
for (const [w, h] of [[1280, 800], [700, 900], [640, 900], [390, 844], [360, 740], [320, 640]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const out = [];
  for (const id of ['doomscroll', 'decide', 'rent', 'study']) {
    await page.getByTestId(`hero-scene-${id}`).click();
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const fs = parseFloat(getComputedStyle(document.querySelector('.fd-bubble')).fontSize);
      return {
        fs: Math.round(fs * 10) / 10,
        screens: [...document.querySelectorAll('.fd-screen')].map((s) => {
          const t = s.querySelector('.fd-thread');
          const kids = [...t.children];
          const used = kids.reduce((a, k) => a + k.getBoundingClientRect().height, 0) + Math.max(0, kids.length - 1) * parseFloat(getComputedStyle(t).rowGap);
          return { over: t.scrollHeight - t.clientHeight, free: Math.round(t.clientHeight - used), n: kids.length };
        }),
      };
    });
    out.push(`${id}: fs ${r.fs} A(over ${r.screens[0].over}, free ${r.screens[0].free}, n${r.screens[0].n}) B(over ${r.screens[1].over}, free ${r.screens[1].free}, n${r.screens[1].n})`);
  }
  console.log(`--- ${w}\n` + out.join('\n'));
  await ctx.close();
}
await browser.close();
