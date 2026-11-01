import { test, expect, Page } from '@playwright/test';
import path from 'node:path';

async function onboard(page: Page) {
  await page.goto('/app/today');
  const careOption = page.getByTestId('care-self_managing');
  if (await careOption.isVisible({ timeout: 4000 }).catch(() => false)) {
    await careOption.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }
  await expect(page.getByTestId('orb-button')).toBeVisible();
}

test('persona card hover transform and audio preview click', async ({ page }) => {
  await page.goto('/#personas', { waitUntil: 'networkidle' });
  const personas = page.getByTestId('personas');
  await expect(personas).toBeVisible();

  const firstCard = personas.getByTestId('persona').first();
  await expect(firstCard).toBeVisible();

  // Hover first card to show transform
  await firstCard.hover();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join('test-results', 'persona-hover-transform.png') });

  // Click card to trigger audio preview
  await firstCard.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join('test-results', 'persona-playing-state.png') });
});

test('today view has idle sparkle voice visualizer and no visible face button', async ({ page }) => {
  await onboard(page);

  // Check face button is visually hidden (sr-only)
  const faceBtn = page.getByTestId('face-toggle');
  await expect(faceBtn).toHaveClass(/sr-only/);

  // Check voice visualizer mic-button exists
  const micBtn = page.getByTestId('mic-button');
  await expect(micBtn).toBeVisible();

  await page.screenshot({ path: path.join('test-results', 'today-idle-sparkle-no-face.png') });
});
