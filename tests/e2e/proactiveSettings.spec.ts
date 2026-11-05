import { expect, test } from '@playwright/test';

/** CI has no push keys and no store, so the card must say so plainly instead of offering a switch that cannot work. */
test('Settings says check-ins are not set up when the server has no push keys', async ({ page }) => {
  await page.route('**/api/push/subscribe', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: { enabled: false } }) : route.abort()));
  await page.goto('/app/settings');
  await expect(page.getByTestId('proactive-settings')).toBeVisible();
  await expect(page.getByTestId('proactive-note')).toContainText(/not switched on|cannot receive/i);
  await expect(page.getByTestId('proactive-toggle')).toHaveCount(0);
});

/** Headless browsers disagree about the starting permission, so each test states it. */
const withPermission = (page: import('@playwright/test').Page, value: 'default' | 'denied') =>
  page.addInitScript((v) => Object.defineProperty(Notification, 'permission', { get: () => v }), value);
const serverReady = (page: import('@playwright/test').Page) =>
  page.route('**/api/push/subscribe', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: { enabled: true, publicKey: 'B'.repeat(87) } }) : route.abort()));

test('Settings offers the switch, off by default, when the server is set up', async ({ page }) => {
  await withPermission(page, 'default');
  await serverReady(page);
  await page.goto('/app/settings');
  const toggle = page.getByTestId('proactive-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toBeChecked();
  await expect(page.getByTestId('proactive-settings')).toContainText('nothing you say or plan');
});

test('Settings explains a blocked notification permission instead of showing a dead switch', async ({ page }) => {
  await withPermission(page, 'denied');
  await serverReady(page);
  await page.goto('/app/settings');
  await expect(page.getByTestId('proactive-note')).toContainText('blocked');
  await expect(page.getByTestId('proactive-toggle')).toHaveCount(0);
});
