import { expect, test, type Page } from '@playwright/test';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e';

async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

async function startBlock(page: Page) {
  await page.getByTestId('task-input').fill('email the landlord');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('start-timer').click();
  await expect(page.getByTestId('clock')).toBeVisible();
}

/** A browser that allows notifications and already holds a subscription; every change request to the server is collected. */
async function subscribedBrowser(page: Page) {
  await page.addInitScript((endpoint) => {
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    navigator.serviceWorker.getRegistration = async () =>
      ({ pushManager: { getSubscription: async () => ({ endpoint, unsubscribe: async () => true }) } }) as unknown as ServiceWorkerRegistration;
  }, ENDPOINT);
  const patches: Array<{ endpoint: string; ringAt: number }> = [];
  await page.route('**/api/push/subscribe', (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { enabled: true, publicKey: 'B'.repeat(87) } });
    if (req.method() === 'PATCH') {
      patches.push(req.postDataJSON());
      return route.fulfill({ json: { ok: true } });
    }
    return route.abort();
  });
  return patches;
}

test('with check-ins on, starting a block asks for a ping at the moment it ends, and stopping it cancels the ping', async ({ page }) => {
  const patches = await subscribedBrowser(page);
  await onboard(page);
  const before = Date.now();
  await startBlock(page);
  await expect.poll(() => patches.length).toBeGreaterThan(0);
  const ask = patches[0];
  expect(ask.endpoint).toBe(ENDPOINT);
  // a short block by default: the moment is that many minutes from now, plus a little grace so an open app handles the end itself
  expect(ask.ringAt).toBeGreaterThan(before + 60_000);
  expect(ask.ringAt).toBeLessThanOrEqual(Date.now() + 90 * 60_000 + 30_000);

  await page.getByTestId('stop-timer').click();
  await expect.poll(() => patches.at(-1)?.ringAt).toBe(0);
});

test('without check-ins the timer never talks to the push server', async ({ page }) => {
  const patches: unknown[] = [];
  await page.route('**/api/push/subscribe', (route) => {
    if (route.request().method() === 'PATCH') patches.push(route.request().postDataJSON());
    return route.fulfill({ json: { enabled: true, publicKey: 'B'.repeat(87) } });
  });
  await onboard(page);
  await startBlock(page);
  await page.getByTestId('stop-timer').click();
  await page.waitForTimeout(800);
  expect(patches).toEqual([]);
});

test('reopening the page with the block still running does not ask a second time for the same moment', async ({ page }) => {
  const patches = await subscribedBrowser(page);
  await onboard(page);
  await startBlock(page);
  await expect.poll(() => patches.length).toBe(1);
  await page.reload();
  await expect(page.getByTestId('clock')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(patches.length).toBe(1);
});
