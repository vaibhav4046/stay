#!/usr/bin/env node
/**
 * Real check of "Show Stay": the app on localhost, the real chat route and the real vision model (no mocks).
 *   1. a picture of an unfinished email is attached and a question is typed
 *   2. a screen is "shared" (the browser's picker cannot be driven, so a canvas drawing of the same email stands in as the
 *      shared window) and a question is typed that points at it
 * Records what Stay answered and how long it took, to docs/evidence/vision/run-<sha>.json.
 *   node scripts/vision-real.mjs http://localhost:3120
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const BASE = process.argv[2] || 'http://localhost:3120';
const sha = execSync('git rev-parse --short HEAD').toString().trim();
const OUT = 'docs/evidence/vision';
mkdirSync(OUT, { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="500"><rect width="100%" height="100%" fill="#fff"/><text x="40" y="90" font-size="38" font-family="Arial" fill="#111">To: landlord@example.com</text><text x="40" y="160" font-size="34" font-family="Arial" fill="#111">Subject: Lease renewal (DRAFT)</text><text x="40" y="240" font-size="30" font-family="Arial" fill="#444">Hi, I wanted to ask about</text><rect x="40" y="320" width="220" height="56" fill="#2563eb"/><text x="82" y="358" font-size="26" fill="#fff" font-family="Arial">Send</text></svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();

const browser = await chromium.launch({ args: ['--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const results = { gitSha: sha, base: BASE, steps: [], failures: [] };
const statuses = [];
page.on('response', (r) => r.url().includes('/api/voice/chat') && r.request().method() === 'POST' && statuses.push(r.status()));

// the stand-in for the shared window: a canvas that looks like the unfinished email
await page.addInitScript(() => {
  navigator.mediaDevices.getDisplayMedia = async () => {
    const c = document.createElement('canvas');
    c.width = 1280;
    c.height = 720;
    const g = c.getContext('2d');
    const draw = () => {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 1280, 720);
      g.fillStyle = '#111'; g.font = '40px Arial';
      g.fillText('To: landlord@example.com', 60, 120);
      g.fillText('Subject: Lease renewal (DRAFT)', 60, 200);
      g.fillStyle = '#444'; g.font = '34px Arial';
      g.fillText('Hi, I wanted to ask about', 60, 300);
      g.fillStyle = '#2563eb'; g.fillRect(60, 500, 240, 64);
      g.fillStyle = '#fff'; g.font = '30px Arial'; g.fillText('Send', 120, 545);
    };
    draw();
    const stream = c.captureStream(5);
    setInterval(draw, 200);
    return stream;
  };
});

async function ask(label, action) {
  const before = await page.getByTestId('chat-agent-message').count();
  const t0 = Date.now();
  await action();
  await page.waitForFunction((n) => document.querySelectorAll('[data-testid="chat-agent-message"]').length > n, before, { timeout: 40000 });
  const ms = Date.now() - t0;
  const reply = (await page.getByTestId('chat-agent-message').last().locator('.bubble').innerText()).trim();
  results.steps.push({ step: label, replyMs: ms, reply });
  console.log(`${label}: ${ms} ms: ${reply}`);
}

try {
  await page.goto(BASE + '/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.waitForTimeout(1500);

  // 1. a picture
  await page.getByTestId('picture-input').setInputFiles({ name: 'draft.png', mimeType: 'image/png', buffer: png });
  await page.getByTestId('task-input').fill('I keep avoiding this. What is the next tiny step?');
  await ask('picture', () => page.getByTestId('send').click());
  await page.screenshot({ path: `${OUT}/picture.png` });

  // 2. a shared screen
  await page.waitForTimeout(1500);
  await page.getByTestId('attach-button').click();
  await page.getByTestId('share-screen').click();
  await page.getByTestId('share-bar').waitFor();
  await page.waitForFunction(() => document.querySelector('[data-testid="share-preview"]')?.readyState >= 2);
  await page.getByTestId('task-input').fill('Can you see my screen? What is half finished?');
  await ask('screen', () => page.getByTestId('send').click());
  await page.screenshot({ path: `${OUT}/screen.png` });

  // 3. a question that does not point at the screen carries no picture, and the answer is about Stay itself
  await page.waitForTimeout(1500);
  await page.getByTestId('task-input').fill('Why should I use you and not ChatGPT?');
  await ask('about-stay', () => page.getByTestId('send').click());
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  results.noPixelsInStorage = !stored.includes('data:image');
  if (!results.noPixelsInStorage) results.failures.push('a picture was found in localStorage');
} catch (e) {
  results.failures.push(String(e.message || e));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => undefined);
}
results.chatStatuses = statuses;
results.status = results.failures.length ? 'FAIL' : 'PASS';
results.limits = ['One machine, Chromium', 'The shared window is a drawn stand-in for the browser screen picker', 'A drawn email, not a real person\'s screen'];
writeFileSync(`${OUT}/run-${sha}.json`, JSON.stringify(results, null, 2));
await browser.close();
console.log(results.status, results.failures);
