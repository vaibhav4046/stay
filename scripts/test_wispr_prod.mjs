import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--mute-audio']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  console.log('Navigating to production...');
  await page.goto('https://stay-two-swart.vercel.app/app/today', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  const careOption = page.getByTestId('care-self_managing');
  if (await careOption.isVisible({ timeout: 5000 }).catch(() => false)) {
    await careOption.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }

  await page.waitForSelector('[data-testid="task-input"]', { timeout: 10000 });
  const taskInput = page.getByTestId('task-input');
  await taskInput.fill('Organize garage tools');
  await page.getByTestId('send').click();
  await page.waitForSelector('[data-testid="plan-card"]', { timeout: 15000 });

  const langBadge = await page.getByTestId('chat-language-badge').textContent().catch(() => 'not found');
  const scratchBtn = await page.getByTestId('wispr-scratch-btn').isVisible().catch(() => false);
  const repeatBtn = await page.getByTestId('wispr-repeat-btn').isVisible().catch(() => false);
  const heardBtn = await page.getByTestId('wispr-heard-btn').isVisible().catch(() => false);
  const modeToggle = await page.getByTestId('chat-mode-toggle').isVisible().catch(() => false);
  const chatLiveCard = await page.getByTestId('chat-live-card').isVisible().catch(() => false);

  console.log('Wispr Flow Audit Results:', {
    chatLiveCard,
    langBadge,
    scratchBtn,
    repeatBtn,
    heardBtn,
    modeToggle,
  });

  const screenshotPath = 'C:/Users/lalwa/.gemini/antigravity/brain/f13ac96d-8370-4da4-b76f-a95c33b66555/wispr-flow-live-chat-prod.png';
  await page.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot to ${screenshotPath}`);

  await browser.close();
}

main().catch(console.error);
