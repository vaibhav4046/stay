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

test('preview 22nd card mariachi metronome with logo and hover transform', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  const picker = page.getByTestId('voice-picker');
  await expect(picker).toBeVisible();

  // Expand more voices to reach 22nd card
  await page.getByTestId('voice-more').locator('summary').click();
  await page.waitForTimeout(400);

  // Card 22: Mariachi Metronome
  const card22 = page.getByTestId('voice-mariachi');
  await expect(card22).toBeVisible();
  await card22.scrollIntoViewIfNeeded();

  // Screenshot idle 22nd card
  await card22.screenshot({ path: 'card-22-mariachi-idle.png' });

  // Hover 22nd card to trigger 3D logo transform animation
  await card22.hover();
  await page.waitForTimeout(400);
  await card22.screenshot({ path: 'card-22-mariachi-hover.png' });

  // Also capture recommended card (Lady Lavender) with logo and hover
  const card1 = page.getByTestId('voice-anna');
  await card1.scrollIntoViewIfNeeded();
  await card1.hover();
  await page.waitForTimeout(400);
  await card1.screenshot({ path: 'card-1-lady-lavender-hover.png' });
});
