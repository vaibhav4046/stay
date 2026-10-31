import { expect, test, type Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

test('capture ElevenLabs voice cards in Voice Picker', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  const picker = page.getByTestId('voice-picker');
  await expect(picker).toBeVisible();

  // Expand more voices
  await page.getByTestId('voice-more').locator('summary').click();
  await page.waitForTimeout(500);

  // Take screenshot of the dialog with ElevenLabs cards
  const dialog = page.getByRole('dialog');
  await dialog.screenshot({ path: 'elevenlabs-voice-cards.png' });

  // Test clicking Ready filter
  await page.getByRole('button', { name: /^Ready \(/ }).click();
  await page.waitForTimeout(400);
  await dialog.screenshot({ path: 'elevenlabs-ready-voices-filtered.png' });
});
