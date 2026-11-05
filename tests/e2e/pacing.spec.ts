import { expect, test } from '@playwright/test';

const PATIENCE = 'stay_patience_v1';
const STYLE = 'stay_reply_style_v1';
const resumes = (ms: number, n: number) => Array.from({ length: n }, () => ({ k: 'r', ms }));

test('Settings shows what Stay has learned about the person’s pace, and the person can switch it off or start again', async ({ page }) => {
  await page.addInitScript(
    ([patience, style, events, styleEvents]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(patience as string, JSON.stringify({ v: 1, events }));
        localStorage.setItem(style as string, JSON.stringify({ v: 1, events: styleEvents }));
        sessionStorage.setItem('seeded', '1');
      }
    },
    [PATIENCE, STYLE, resumes(2600, 8), Array.from({ length: 16 }, (_, i) => (i % 2 === 0 ? 'r' : 'c'))],
  );
  await page.goto('/app/settings');
  const pause = page.getByTestId('pacing-text');
  const style = page.getByTestId('pacing-style');
  await expect(pause).toContainText(/waits about \d\.\d seconds.*last 8 pauses/);
  await expect(style).toContainText('often cut in');
  await expect(page.getByTestId('pacing-toggle')).toBeChecked();

  await page.getByTestId('pacing-toggle').uncheck();
  await expect(pause).toContainText('Learning is off');
  await expect(style).toContainText('Learning is off');
  expect(await page.evaluate(() => localStorage.getItem('stay_patience_enabled_v1'))).toBe('0');
  await page.reload();
  await expect(page.getByTestId('pacing-toggle')).not.toBeChecked();

  await page.getByTestId('pacing-toggle').check();
  await page.getByTestId('pacing-reset').click();
  await expect(pause).toContainText('starts learning');
  await expect(style).toContainText('starts after a few replies');
  expect(await page.evaluate((k) => localStorage.getItem(k), PATIENCE)).toBeNull();
  expect(await page.evaluate((k) => localStorage.getItem(k), STYLE)).toBeNull();
  await expect(page.getByTestId('pacing-reset')).toBeDisabled();
});

test('with nothing learned yet it says so plainly and offers nothing to reset', async ({ page }) => {
  await page.goto('/app/settings');
  await expect(page.getByTestId('pacing-text')).toContainText('starts learning your pace');
  await expect(page.getByTestId('pacing-style')).toContainText('starts after a few replies');
  await expect(page.getByTestId('pacing-reset')).toBeDisabled();
});
