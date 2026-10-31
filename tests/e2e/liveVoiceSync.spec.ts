import { test, expect, Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/app/today');
  const careOption = page.getByTestId('care-self_managing');
  if (await careOption.isVisible()) {
    await careOption.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }
  await expect(page.getByTestId('orb-button')).toBeVisible();
}

test('live voice caption synchronization and logo persistence', async ({ page }) => {
  await onboard(page);

  // 1. Verify StayLogo is visibly present in mic-button capsule when idle
  const micButton = page.getByTestId('mic-button');
  await expect(micButton).toBeVisible();
  const stayLogo = micButton.locator('img');
  await expect(stayLogo).toBeVisible();

  // 2. Face toggle button is sr-only (no visible face button on screen)
  const faceToggle = page.getByTestId('face-toggle');
  await expect(faceToggle).toHaveClass(/sr-only/);

  // 3. Initial idle caption is "What are you putting off?"
  const caption = page.getByTestId('caption');
  await expect(caption).toHaveText('What are you putting off?');

  // 4. Capture screenshot of idle state with logo
  await page.screenshot({ path: 'C:/Users/lalwa/.gemini/antigravity/brain/f13ac96d-8370-4da4-b76f-a95c33b66555/08-live-voice-idle-with-logo.png' });

  // 5. Test greeting "Hi hello"
  const input = page.getByTestId('task-input');
  await input.fill('Hi hello');
  await page.screenshot({ path: 'C:/Users/lalwa/.gemini/antigravity/brain/f13ac96d-8370-4da4-b76f-a95c33b66555/09-hi-hello-responsive-input.png' });
  await page.getByTestId('send').click();
  await page.waitForTimeout(400);

  // 6. Test actual task input "Do my taxes" to verify plan creation
  await input.fill('Do my taxes');
  await page.getByTestId('send').click();

  const planCard = page.getByTestId('plan-card');
  await expect(planCard).toBeVisible({ timeout: 10000 });

  await page.screenshot({ path: 'C:/Users/lalwa/.gemini/antigravity/brain/f13ac96d-8370-4da4-b76f-a95c33b66555/10-responsive-plan-card.png' });
});
