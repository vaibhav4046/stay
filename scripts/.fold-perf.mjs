// throwaway: requestAnimationFrame frame times while the hero animates (steady call, and a window that contains a fold)
import { chromium } from '@playwright/test';

const base = 'http://localhost:3120';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const measure = (page, ms) => page.evaluate((span) => new Promise((resolve) => {
  const d = [];
  let last = performance.now();
  const end = last + span;
  const tick = (n) => {
    d.push(n - last);
    last = n;
    if (n < end) requestAnimationFrame(tick);
    else {
      d.shift();
      const s = [...d].sort((a, b) => a - b);
      resolve({ frames: d.length, avg: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1), p50: +s[Math.floor(s.length * 0.5)].toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), p99: +s[Math.floor(s.length * 0.99)].toFixed(1), max: +s[s.length - 1].toFixed(1) });
    }
  };
  requestAnimationFrame(tick);
}), ms);

for (const [w, h] of [[1280, 800], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log(w, 'steady call (5 s)      ', JSON.stringify(await measure(page, 5000)));
  // a window that contains a full fold: choose another scene, then measure 5 s (closing 0.54 s, shut, opening 0.6 s, then the new call starts)
  await page.getByTestId('hero-scene-study').click();
  const during = await measure(page, 5000);
  console.log(w, 'across a fold (5 s)    ', JSON.stringify(during));
  // the fold alone: a tight 1.4 s window right after the click
  await page.getByTestId('hero-scene-rent').click();
  console.log(w, 'the fold itself (1.4 s)', JSON.stringify(await measure(page, 1400)));
  await ctx.close();
}
await browser.close();
