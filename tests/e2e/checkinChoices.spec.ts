import { expect, test, type Page } from '@playwright/test';

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/e2e';

/** A browser that already holds a subscription and has allowed notifications. */
async function subscribedBrowser(page: Page, patchStatus = 200) {
  await page.addInitScript((endpoint) => {
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
    navigator.serviceWorker.getRegistration = async () =>
      ({ pushManager: { getSubscription: async () => ({ endpoint, unsubscribe: async () => true }) } }) as unknown as ServiceWorkerRegistration;
  }, ENDPOINT);
  const patches: unknown[] = [];
  await page.route('**/api/push/subscribe', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json: { enabled: true, publicKey: 'B'.repeat(87) } });
    if (req.method() === 'PATCH') {
      patches.push(req.postDataJSON());
      return route.fulfill({ status: patchStatus, json: patchStatus === 200 ? { ok: true } : { error: 'down' } });
    }
    return route.abort();
  });
  return patches;
}

test('when check-ins are on, the person can choose the windows and pause for a day', async ({ page }) => {
  const patches = await subscribedBrowser(page);
  await page.goto('/app/settings');
  await expect(page.getByTestId('checkin-choices')).toBeVisible();
  await expect(page.getByTestId('checkin-morning')).toBeChecked();
  await expect(page.getByTestId('checkin-evening')).toBeChecked();

  await page.getByTestId('checkin-morning').click();
  await expect(page.getByTestId('checkin-morning')).not.toBeChecked();
  expect(patches.at(-1)).toMatchObject({ endpoint: ENDPOINT, prefs: { morning: false, evening: true } });
  // the last window that is on cannot be switched off here: that is what the main switch is for
  await expect(page.getByTestId('checkin-evening')).toBeDisabled();

  await page.getByTestId('checkin-pause').click();
  await expect(page.getByTestId('checkin-paused')).toContainText('Paused until');
  expect(patches.at(-1)).toMatchObject({ snoozeHours: 24 });

  await page.reload();
  await expect(page.getByTestId('checkin-paused')).toBeVisible(); // remembered on this device
  await expect(page.getByTestId('checkin-morning')).not.toBeChecked();
  await page.getByTestId('checkin-resume').click();
  await expect(page.getByTestId('checkin-pause')).toBeVisible();
  expect(patches.at(-1)).toMatchObject({ snoozeHours: 0 });
});

test('a choice the server did not accept is not shown as saved', async ({ page }) => {
  await subscribedBrowser(page, 503);
  await page.goto('/app/settings');
  await page.getByTestId('checkin-morning').click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('checkin-morning')).toBeChecked();
});
