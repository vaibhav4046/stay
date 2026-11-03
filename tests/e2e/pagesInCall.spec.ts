import { test, expect } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * Soak, 3 Nov 2026: "Show my report" during a call navigated to another page, which ended the call. Report, settings and check-in now open
 * inside the conversation, and the call keeps going.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

for (const [say, value, testId] of [
  ['Show my report.', 'report', 'inline-reports'],
  ['Open settings.', 'settings', 'inline-settings'],
  ['Take me to my check-in.', 'checkin', 'inline-treatment'],
] as const) {
  test(`"${say}" opens inside the call and the call stays connected`, async ({ page }) => {
    const fake = await installFakeFastVoice(page, {
      chatReplyText: 'Here it is.',
      chatToolCall: (_text, withTools) => (withTools ? { action: 'open', value } : null),
    });
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId('care-self_managing').click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
    await page.getByTestId('mic-button').click();
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });

    fake.pushSttFinal(say, 0);
    await expect(page.getByTestId(testId)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/app\/today/); // it did not navigate away
    await expect(page.getByTestId('orb-button')).toHaveAttribute('aria-pressed', 'true'); // the call is still on
    await page.getByTestId(`${testId}-close`).click();
    await expect(page.getByTestId(testId)).toHaveCount(0);
    await expect(page.getByTestId('orb-button')).toHaveAttribute('aria-pressed', 'true');
  });
}
