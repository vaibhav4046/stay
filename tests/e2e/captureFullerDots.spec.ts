import { test, expect } from '@playwright/test';

test('capture updated fuller dots on neural orb artifact', async ({ page }) => {
  await page.goto('/#artifacts-3d', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const section = page.locator('#artifacts-3d');
  await expect(section).toBeVisible();

  // Ensure canvas has drawn frames
  await page.waitForTimeout(1200);

  // Take screenshot of the 3D canvas box
  const box = section.locator('.relative.shadow-2xl');
  await box.screenshot({ path: 'fuller-dots-therapist.png' });
});
