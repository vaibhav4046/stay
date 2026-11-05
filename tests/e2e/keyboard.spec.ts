import { test, expect, type Page } from '@playwright/test';

/** QA review, 4 Nov 2026: Space on a focused control opened the mic consent sheet; dialogs did not hold focus; Escape did not close Ground me or Today's list. */
async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

test.describe('Keyboard', () => {
  test('Space on a focused button activates that button and never opens the microphone sheet', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('menu-button').focus();
    await page.keyboard.press('Space');
    await expect(page.getByText('Before we use your microphone')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible(); // More opened: it is the button's own key
  });

  test('a dialog takes focus, keeps Tab inside, and gives focus back on Escape', async ({ page }) => {
    await onboard(page);
    const more = page.getByTestId('menu-button');
    await more.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(more).toBeFocused();
  });

  test('Escape closes Ground me', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('menu-button').click();
    await page.getByRole('button', { name: /Ground me/i }).click();
    await expect(page.getByRole('dialog').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the hidden face toggle is not a tab stop', async ({ page }) => {
    await onboard(page);
    await expect(page.getByTestId('face-toggle')).toHaveAttribute('tabindex', '-1');
  });
});
