import { test, expect } from '@playwright/test';

test('Clicking voice card container selects voice and arms it immediately', async ({ page }) => {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();

  // Open Voice Picker
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  await expect(page.getByTestId('voice-picker')).toBeVisible();

  // Card: Countdown Cookie (id: 'eve')
  const eveCard = page.getByTestId('voice-eve');
  await expect(eveCard).toBeVisible();

  // Click on the card container directly
  await eveCard.click();

  // Wait for React to apply the active selection styling
  await expect(eveCard).toHaveClass(/!border-primary/);

  // Verify voice is selected and saved to localStorage
  const selectedVoice = await page.evaluate(() => localStorage.getItem('stay_selected_voice'));
  expect(selectedVoice).toBe('eve');

  // Close sheet and verify receipt feedback on Today screen
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Countdown Cookie armed — ready to speak/)).toBeVisible();

  // Re-open and click Card: Biscuit Blitz (id: 'paul') in More voices
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  await expect(page.getByTestId('voice-picker')).toBeVisible();

  // Open "More voices" details disclosure
  await page.getByTestId('voice-more').locator('summary').click();

  const paulCard = page.getByTestId('voice-paul');
  await expect(paulCard).toBeVisible();
  await expect(paulCard).toHaveAttribute('data-usable', 'true');

  // Direct click on Card container arms it immediately (ElevenLabs UX)
  await paulCard.click();
  await expect(paulCard).toHaveClass(/!border-primary/);

  const paulSelected = await page.evaluate(() => localStorage.getItem('stay_selected_voice'));
  expect(paulSelected).toBe('paul');

  // Close sheet and verify Biscuit Blitz armed receipt
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Biscuit Blitz armed — ready to speak/)).toBeVisible();

  await page.screenshot({ path: 'test-results/voice-card-armed-success.png' });
});
