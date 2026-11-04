// throwaway: device close-ups (reduced motion = everything drawn) at 2x
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = 'C:/Users/lalwa/AppData/Local/Temp/claude/D--/697552a1-f809-44de-a453-57c714bd21a7/scratchpad/fold';
const base = 'http://localhost:3120';
const browser = await chromium.launch({ args: ['--mute-audio'] });
for (const [w, h, tag] of [[1280, 800, 'wide'], [390, 844, 'tall']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  for (const id of ['doomscroll', 'rent']) {
    await page.getByTestId(`hero-scene-${id}`).click();
    await page.waitForTimeout(250);
    const b = await page.locator('.fd').boundingBox();
    const pad = 40;
    await page.screenshot({ path: `${OUT}/zoom-${tag}-${id}.png`, clip: { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(w - Math.max(0, b.x - pad), b.width + pad * 2), height: b.height + pad * 2 }, fullPage: true });
  }
  await ctx.close();
}
await browser.close();
