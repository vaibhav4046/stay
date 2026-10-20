/* Real screenshots of the running app for the manifest (public/screenshots). Needs a running Stay:
 *   STAY_URL=http://127.0.0.1:3100 node apps/shared/pwa-shots.mjs
 * 780x1688 narrow (phone) and 1280x800 wide (desktop), as the install UI requires. */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = process.env.STAY_URL || 'http://127.0.0.1:3100';
const out = join(root, 'public', 'screenshots');
mkdirSync(out, { recursive: true });

const profile = JSON.stringify({ userId: 'local-user', careContext: 'waitlisted', interactionMode: 'voice_and_text', proactiveCheckins: true, onboardingCompleted: true, updatedAt: new Date().toISOString() });
const browser = await chromium.launch();
for (const [name, viewport, scale] of [
  ['today-narrow', { width: 390, height: 844 }, 2],
  ['today-wide', { width: 1280, height: 800 }, 1],
]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: 'light', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript((p) => localStorage.setItem('stay_v1_profile', p), profile);
  await page.goto(base + '/app/today');
  await page.waitForSelector('[aria-label="Talk to Stay"]');
  await page.waitForTimeout(3000); // the orb settles
  await page.screenshot({ path: join(out, name + '.png') });
  await ctx.close();
  console.log('wrote', name);
}
await browser.close();
