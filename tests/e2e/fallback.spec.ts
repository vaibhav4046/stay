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
    await page.addInitScript(() => {
      localStorage.setItem(
        'stay_v1_profile',
        JSON.stringify({
          careContext: 'self_managing',
          onboardingCompleted: true,
          interactionMode: 'voice_and_text',
        })
      );
      localStorage.setItem('stay_fast_voice', '0');
      localStorage.setItem('stay:mic_consented:v1', '1');
    });

    const fakeVoice = await installFakeVoice(page);
    await page.goto('/app/today');

    await expect(page.getByTestId('orb-button')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('orb-button').click();
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
    expect(fakeVoice.ready()).toBe(true);

    // The connection badge lives in the voice sheet (More, Voice and language), not on the home screen.
    // It must honestly disclose Backup voice when running on the managed-agent socket.
    await expect(page.getByTestId('transport-badge')).toHaveCount(0);
    await page.getByTestId('menu-button').click();
    await page.getByRole('button', { name: 'Voice and language' }).click();
    const badge = page.getByTestId('transport-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/Backup voice/i);
  });
});
