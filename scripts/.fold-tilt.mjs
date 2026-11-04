// throwaway: the device at rest, leaning to the pointer (clamped), 2x
import { chromium } from '@playwright/test';
const OUT = 'C:/Users/lalwa/AppData/Local/Temp/claude/D--/697552a1-f809-44de-a453-57c714bd21a7/scratchpad/fold';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto('http://localhost:3120/', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
const shot = async (name) => {
  await page.waitForTimeout(900);
  const b = await page.locator('.fd').boundingBox();
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: b.x - 50, y: b.y - 40, width: b.width + 100, height: b.height + 100 } });
  console.log(name, await page.evaluate(() => [getComputedStyle(document.querySelector('.fd')).getPropertyValue('--tilt-ry'), getComputedStyle(document.querySelector('.fd')).getPropertyValue('--tilt-rx')].join(' ')));
};
await page.mouse.move(1270, 790);
await shot('tilt-br');
await page.mouse.move(2, 5);
await shot('tilt-tl');
await page.mouse.move(1270, 20);
await shot('tilt-tr');
await browser.close();
