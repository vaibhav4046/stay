import { test, expect } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * T4.1: from a cold load of /app/today to Stay listening takes at most two clicks (Talk, then the consent sheet) and 10 s or less.
 * Label: the voice services are faked (no network), so this times the app, not AssemblyAI. A real connection adds its own time.
 * A returning person (consent already given) needs one click.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

const START_BUDGET_MS = 10_000;

async function onboardFresh(page: import('@playwright/test').Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

test('a first-time visitor: Talk, then Start talking, then listening, within 10 s of the page being ready', async ({ page }) => {
  await installFakeFastVoice(page, { chatReplyText: 'Okay.' });
  // this person has not agreed yet, so undo the helper's "already agreed"
  await page.addInitScript(() => localStorage.removeItem('stay:mic_consented:v1'));
  await onboardFresh(page);
  await page.evaluate(() => localStorage.removeItem('stay:mic_consented:v1'));

  const t0 = Date.now();
  let clicks = 0;
  await page.getByTestId('mic-button').click();
  clicks += 1;
  await page.getByTestId('consent-start-talking').click();
  clicks += 1;
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: START_BUDGET_MS });
  const elapsed = Date.now() - t0;
  console.log(`T4.1 first visit: ${clicks} clicks, ${elapsed} ms from first click to Listening (voice services faked)`);
  expect(clicks).toBeLessThanOrEqual(2);
  expect(elapsed).toBeLessThanOrEqual(START_BUDGET_MS);
});

test('a returning visitor: one click to listening', async ({ page }) => {
  await installFakeFastVoice(page, { chatReplyText: 'Okay.' });
  await onboardFresh(page);
  const t0 = Date.now();
  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: START_BUDGET_MS });
  console.log(`T4.1 returning visit: 1 click, ${Date.now() - t0} ms to Listening (voice services faked)`);
  expect(Date.now() - t0).toBeLessThanOrEqual(START_BUDGET_MS);
});
