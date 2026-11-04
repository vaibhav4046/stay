// throwaway: scrub the fold frame by frame (animations are paused and set to an exact time) and build contact sheets
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const OUT = 'C:/Users/lalwa/AppData/Local/Temp/claude/D--/697552a1-f809-44de-a453-57c714bd21a7/scratchpad/fold';
fs.mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:3120';
const [w, h, tag, scale] = process.argv[2] ? process.argv[2].split('x').concat(process.argv[3] || 'wide', process.argv[4] || '1') : [1280, 800, 'wide', '1'];
const browser = await chromium.launch({ args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale });
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'networkidle' });
await page.getByTestId('hero-example').scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
// let scene 0 reach the end of its call so the second screen is full: jump by choosing the last-but-one scene and waiting is slow, so just let it play a while
await page.waitForTimeout(Number(process.env.WAIT || 14000));

const box = async () => {
  const b = await page.locator('.fd').boundingBox(); const sy = await page.evaluate(() => window.scrollY); b.y += sy;
  const pad = 60;
  return { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(+w - Math.max(0, b.x - pad), b.width + pad * 2), height: b.height + pad * 2 };
};
const scrub = (t) => page.evaluate((time) => {
  document.getAnimations().filter((a) => /^fd-(b-|a-|front|back|glow|shadow-)/.test(a.animationName || '')).forEach((a) => { a.pause(); a.currentTime = time; });
}, t);
const phase = () => page.locator('.fd').getAttribute('data-phase');

// closing: choose another scene (starts the fold at once), pause, scrub
await page.getByTestId('hero-scene-study').click();
await page.getByTestId('hero-pause').click();
const closing = [];
for (const t of [0, 110, 220, 330, 440, 540]) {
  await scrub(t);
  await page.waitForTimeout(80);
  const file = path.join(OUT, `_c-${tag}-${t}.png`);
  await page.screenshot({ path: file, clip: await box(), fullPage: true });
  closing.push(file);
}
// opening: resume, wait for the opening phase, pause, scrub
await page.getByTestId('hero-pause').click();
for (let i = 0; i < 100 && (await phase()) !== 'opening'; i++) await page.waitForTimeout(15);
await page.getByTestId('hero-pause').click();
const opening = [];
for (const t of [0, 150, 300, 440, 500, 600]) {
  await scrub(t);
  await page.waitForTimeout(80);
  const file = path.join(OUT, `_o-${tag}-${t}.png`);
  await page.screenshot({ path: file, clip: await box(), fullPage: true });
  opening.push(file);
}
await browser.close();

async function sheet(files, name, cols) {
  const metas = await Promise.all(files.map((f) => sharp(f).metadata()));
  const tw = Math.round(metas[0].width * 0.5), th = Math.round(metas[0].height * 0.5);
  const rows = Math.ceil(files.length / cols);
  const tiles = await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(tw, th).toBuffer(), left: (i % cols) * tw, top: Math.floor(i / cols) * th })));
  await sharp({ create: { width: tw * cols, height: th * rows, channels: 3, background: '#000' } }).composite(tiles).png().toFile(path.join(OUT, name));
}
await sheet(closing, `fold-closing-${tag}.png`, 3);
await sheet(opening, `fold-opening-${tag}.png`, 3);
console.log('done');
