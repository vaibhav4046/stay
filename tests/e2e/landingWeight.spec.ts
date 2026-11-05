import { expect, test } from '@playwright/test';

/** The home page is read by most visitors and used by few. The app's own code (about 140 KB of script) must not be fetched and run for all of them. */
const APP_CHUNK = /\/_next\/static\/chunks\/app\/app\//;

test('the home page does not download the app code until the person shows interest', async ({ page }) => {
  const fetched: string[] = [];
  page.on('request', (r) => APP_CHUNK.test(r.url()) && fetched.push(r.url()));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // idle prefetching, if any, would have started by now
  expect(fetched).toEqual([]);

  await page.getByTestId('cta-open').hover(); // interest: the code is warmed so the click is still quick
  await expect.poll(() => fetched.length).toBeGreaterThan(0);
});

test('a click on Open Stay still lands on Today', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByTestId('cta-open').click();
  await expect(page).toHaveURL(/\/app\/today/);
  await expect(page.getByRole('main')).toBeVisible();
});
