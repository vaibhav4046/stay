// Screenshots of every main screen, mobile and desktop, in the states a person actually sees. Used for design review.
// Usage: node scripts/ux-shots.mjs <baseURL> <outDir>
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base = process.argv[2] || 'http://localhost:3300';
const out = process.argv[3] || path.join(process.cwd(), 'ux-shots');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ timeout: 60000 });

for (const [name, vp] of [['m', { width: 390, height: 844 }], ['d', { width: 1280, height: 800 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  const shot = (n) => p.screenshot({ path: path.join(out, `${name}-${n}.png`), fullPage: n === 'landing' });
  await p.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.waitForTimeout(2500);
  await shot('landing');
  await p.goto(base + '/app/today', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(800);
  await shot('onboarding');
  await p.getByTestId('care-self_managing').click();
  await p.getByTestId('onboarding-ack').click();
  await p.getByTestId('onboarding-done').click();
  await p.getByTestId('task-input').waitFor();
  await p.waitForTimeout(1500);
  await shot('today');
  await p.getByTestId('task-input').fill('Reply to my landlord about the renewal');
  await p.getByTestId('send').click();
  await p.getByTestId('plan-card').waitFor({ timeout: 20000 });
  await p.waitForTimeout(1500);
  await shot('plan');
  await p.getByTestId('start-timer').click();
  await p.waitForTimeout(1500);
  await shot('timer');
  await p.getByTestId('stop-timer').click();
  await p.waitForTimeout(500);
  await shot('outcome');
  await p.getByTestId('outcome-started').click();
  await p.waitForTimeout(800);
  await shot('done');
  for (const route of ['history', 'reports', 'treatment', 'settings']) {
    await p.goto(`${base}/app/${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await p.waitForTimeout(1200);
    await shot(route);
  }
  await ctx.close();
}
await browser.close();
console.log('shots in', out);
