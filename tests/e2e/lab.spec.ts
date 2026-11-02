import { test, expect } from '@playwright/test';

/** The two hidden pages the owner uses for the human runs (T1.6 listening test, T2.8 real-microphone run). */

test('the listening test page loads, is not for search engines, and asks to prepare the voices first', async ({ page }) => {
  await page.goto('/lab/voices');
  await expect(page.getByRole('heading', { name: 'Listening test' })).toBeVisible();
  await expect(page.getByTestId('lab-prepare')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByText("I'd happily listen to this for ten minutes")).toBeVisible();
  // nothing starts speaking, and nothing asks for the microphone, until the person presses a button
  await expect(page.getByTestId('lab-begin')).toHaveCount(0);
});

test('the real-microphone page explains the run and links to the recorder, which is not there without the link', async ({ page }) => {
  await page.goto('/lab/latency');
  await expect(page.getByRole('heading', { name: 'Real-microphone run' })).toBeVisible();
  await expect(page.getByTestId('latency-open')).toHaveAttribute('href', '/app/today?lab=latency');
  await page.goto('/app/today');
  await expect(page.getByTestId('latency-recorder')).toHaveCount(0);
});

test('the recorder inside the app reads the marks into rows, and exports them', async ({ page }) => {
  await page.goto('/app/today?lab=latency');
  await expect(page.getByTestId('latency-recorder')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('latency-count')).toContainText('Recording marks');

  // the app's own marks, as a real run would leave them: end of turn at 10 s and 30 s, mic loud until 9.8 s and 29.7 s
  await page.evaluate(() => {
    const w = window as unknown as { __stayFastMarks: Array<[string, number]>; __stayPlayStarts: number[]; __stayLoud: number[] };
    w.__stayFastMarks = [['eot', 10_000], ['eot', 30_000]];
    w.__stayPlayStarts = [10_950, 31_200];
    w.__stayLoud = [9_500, 9_800, 29_500, 29_700];
  });
  await expect(page.getByTestId('latency-table')).toContainText('1150', { timeout: 5000 });
  await expect(page.getByTestId('latency-table')).toContainText('1500');
  await expect(page.getByTestId('latency-count')).toContainText('With a reply: 2');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('latency-export').click()]);
  const text = await (await import('node:fs/promises')).readFile((await download.path())!, 'utf8');
  const json = JSON.parse(text);
  expect(json.labels).toEqual(['real-mic', 'live-model']);
  expect(json.turns).toHaveLength(2);
  expect(json.summary.n).toBe(2);
});
