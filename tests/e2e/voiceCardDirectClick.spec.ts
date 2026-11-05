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

  // Card: Audrey (id: 'eve')
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
  await expect(page.getByText(/Audrey ready to speak/)).toBeVisible();

  // Re-open and click Card: Paul (id: 'paul') in More voices
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

  // Close sheet and verify Paul armed receipt
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Paul ready to speak/)).toBeVisible();

  // Re-open and click Card: Adrienne (id: 'anna') in Recommended
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  await expect(page.getByTestId('voice-picker')).toBeVisible();

  const annaCard = page.getByTestId('voice-anna');
  await expect(annaCard).toBeVisible();
  await expect(annaCard).toHaveAttribute('data-usable', 'true');
  await annaCard.click();
  await expect(annaCard).toHaveClass(/!border-primary/);

  const annaSelected = await page.evaluate(() => localStorage.getItem('stay_selected_voice'));
  expect(annaSelected).toBe('anna');

  await page.keyboard.press('Escape');
  await expect(page.getByText(/Adrienne ready to speak/)).toBeVisible();

  await page.screenshot({ path: 'test-results/voice-card-armed-success.png' });
});

test('Clicking unusable voice card does not select it, shows setup explanation, and preserves prior voice', async ({ page }) => {
  // Kavya (female Indian English) is the one voice that needs Azure or a device voice; give the device none so it is unusable
  await page.addInitScript(() => {
    window.speechSynthesis.getVoices = () => [] as unknown as SpeechSynthesisVoice[];
  });
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

  // Open More voices
  await page.getByTestId('voice-more').locator('summary').click();

  // Find a voice that needs setup (Kavya, with no Azure key and no en-IN device voice)
  const unusableCard = page.locator('.el-voice-card[data-usable="false"]').first();
  await expect(unusableCard).toBeVisible();

  // Record currently selected voice before click
  const priorVoice = await page.evaluate(() => localStorage.getItem('stay_selected_voice'));

  // Click the unusable card
  await unusableCard.click();

  // Assert card is NOT selected (does not have !border-primary)
  await expect(unusableCard).not.toHaveClass(/!border-primary/);

  // Assert selected voice was NOT changed to this unusable card
  const afterVoice = await page.evaluate(() => localStorage.getItem('stay_selected_voice'));
  expect(afterVoice).toBe(priorVoice);

  // Assert setup explanation appears (in error alert or needText banner)
  const cardText = await unusableCard.textContent();
  expect(cardText).toMatch(/Needs /);

  // Assert user is not silently put into a broken voice mode
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('task-input')).toBeVisible();
});
