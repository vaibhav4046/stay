import { expect, test } from '@playwright/test';

const KEY = 'stay_patience_v1';
const resumes = (ms: number, n: number) => Array.from({ length: n }, () => ({ k: 'r', ms }));

test('Settings shows what Stay has learned about the person’s pauses, and the person can switch it off or start again', async ({ page }) => {
  await page.addInitScript(
    ([key, events]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key as string, JSON.stringify({ v: 1, events }));
        sessionStorage.setItem('seeded', '1');
      }
    },
    [KEY, resumes(2600, 8)],
  );
  await page.goto('/app/settings');
  const text = page.getByTestId('pacing-text');
  await expect(text).toContainText(/waits about \d\.\d seconds.*last 8 pauses/);
  await expect(page.getByTestId('pacing-toggle')).toBeChecked();

  await page.getByTestId('pacing-toggle').uncheck();
  await expect(text).toContainText('Learning is off');
  expect(await page.evaluate(() => localStorage.getItem('stay_patience_enabled_v1'))).toBe('0');
  await page.reload();
  await expect(page.getByTestId('pacing-toggle')).not.toBeChecked();

  await page.getByTestId('pacing-toggle').check();
  await page.getByTestId('pacing-reset').click();
  await expect(text).toContainText('starts learning');
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
  await expect(page.getByTestId('pacing-reset')).toBeDisabled();
});

test('with nothing learned yet it says so plainly and offers nothing to reset', async ({ page }) => {
  await page.goto('/app/settings');
  await expect(page.getByTestId('pacing-text')).toContainText('starts learning your pace');
  await expect(page.getByTestId('pacing-reset')).toBeDisabled();
});
