import { test, expect, type Page } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * Field test, 2 Nov 2026: "when I'm calling, 2 or 3 voices are coming up". A second tap, the call ring timer or a retry could start a
 * second voice session while the first was still connecting (the "connected" flag only turns true when the session is ready), and the
 * first kept speaking. Every session start asks for a fresh voice token, so counting token requests counts session starts.
 * The token is delayed here so the connecting window is long enough to tap into, as it is on a real network.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

async function openToday(page: Page) {
  await installFakeFastVoice(page, { chatReplyText: 'Okay.', ttsChunksPerFlush: 3, ttsChunkIntervalMs: 30 });
  let tokens = 0;
  // registered after the helper's route, so it runs first and hands on to it after the delay
  await page.route('**/api/voice/fast-token*', async (route) => {
    tokens += 1;
    await new Promise((r) => setTimeout(r, 1800));
    await route.fallback();
  });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
  return { tokenRequests: () => tokens };
}

test('tapping the mic again while it is still connecting does not start a second session', async ({ page }) => {
  const { tokenRequests } = await openToday(page);
  const mic = page.getByTestId('mic-button');
  await mic.click();
  await page.waitForTimeout(400);
  await mic.click({ force: true }); // still connecting: the token has not come back
  await page.waitForTimeout(400);
  await mic.click({ force: true });
  await expect.poll(() => tokenRequests(), { timeout: 8000 }).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 12000 });
  await page.waitForTimeout(1500);
  expect(tokenRequests()).toBe(1);
});

test('the call button, then the mic while it rings and connects, is still one session', async ({ page }) => {
  const { tokenRequests } = await openToday(page);
  await page.getByTestId('call-direct-stay-btn').click();
  await page.waitForTimeout(1500);
  await page.getByTestId('mic-button').click({ force: true, timeout: 2000 }).catch(() => undefined); // may be covered by the call screen: either way it must not start a second one
  await expect(page.getByTestId('call-overlay')).toHaveAttribute('data-call-state', 'connected', { timeout: 15000 });
  await page.waitForTimeout(1500);
  expect(tokenRequests()).toBe(1);
});
