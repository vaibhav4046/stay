import { test, expect } from '@playwright/test';
import { installFakeVoice } from './helpers/fakeVoice';

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  },
});

test.describe('Explicit Managed-Agent Fallback Transport (fallback.spec.ts)', () => {
  test('When stay_fast_voice is explicitly set to 0, connects to managed-agent fallback and displays honest Backup voice badge', async ({ page }) => {
    const fakeVoice = await installFakeVoice(page);
    await page.goto('/app/today');

    const careOption = page.getByTestId('care-self_managing');
    if (await careOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await careOption.click();
      await page.getByTestId('onboarding-ack').click();
      await page.getByTestId('onboarding-done').click();
    }

    await page.getByTestId('orb-button').click();
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
    expect(fakeVoice.ready()).toBe(true);

    // Transport badge must honestly disclose Backup voice when running on the managed-agent socket
    const badge = page.getByTestId('transport-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/Backup voice/i);
  });
});
