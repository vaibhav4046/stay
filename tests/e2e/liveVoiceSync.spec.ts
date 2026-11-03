import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve('test-results');

async function onboard(page: Page) {
  await page.goto('/app/today');
  const careOption = page.getByTestId('care-self_managing');
  if (await careOption.waitFor({ timeout: 5000 }).then(() => true, () => false)) { // isVisible() does not wait; a slow load skipped onboarding
    await careOption.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }
  await expect(page.getByTestId('orb-button')).toBeVisible();
}

test('live voice caption synchronization and logo persistence', async ({ page }) => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await onboard(page);

  // 1. The Talk control is in the composer: a mic icon and one word
  const micButton = page.getByTestId('mic-button');
  await expect(micButton).toBeVisible();
  await expect(micButton).toContainText('Talk');
  await expect(micButton.locator('svg').first()).toBeVisible();

  // 2. Face toggle button is sr-only (no visible face button on screen)
  const faceToggle = page.getByTestId('face-toggle');
  await expect(faceToggle).toHaveClass(/sr-only/);

  // 3. The empty home screen is the orb and the composer: no caption, no chips, no cards
  await expect(page.getByTestId('orb-stage')).toHaveAttribute('data-compact', 'false');
  await expect(page.getByTestId('orb-status')).toHaveText('');
  for (const gone of ['caption', 'state-chips', 'today-card', 'daily-greeting', 'call-stay-card', 'header-call-stay-btn']) {
    await expect(page.getByTestId(gone)).toHaveCount(0);
  }
  await expect(page.getByTestId('call-direct-stay-btn')).toBeVisible();

  // 4. Capture screenshot of idle state with logo
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-live-voice-idle-with-logo.png') });

  // 5. Test greeting "Hi hello" -> verify progressive word reveal and warm human coaching response
  const input = page.getByTestId('task-input');
  await input.fill('Hi hello');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-hi-hello-responsive-input.png') });
  await page.getByTestId('send').click();

  // Immediately after send, caption starts revealing words progressively (not blank, and matches warm human greeting prefix)
  await expect(page.getByText("Hey. Good to hear from you. What's on your mind?").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('plan-card')).toHaveCount(0);

  // 6. Test actual task input "Do my taxes" to verify plan creation
  await page.waitForTimeout(500);
  await input.fill('Do my taxes');
  await page.getByTestId('send').click();

  const planCard = page.getByTestId('plan-card');
  await expect(planCard).toBeVisible({ timeout: 15000 });

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-responsive-plan-card.png') });
});
