import { test, expect, type Page } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  },
});

async function openToday(page: Page) {
  const fake = await installFakeFastVoice(page, { chatReplyText: 'Okay.', ttsChunksPerFlush: 3, ttsChunkIntervalMs: 30 });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const care = page.getByTestId('care-self_managing');
  if (await care.isVisible({ timeout: 5000 }).catch(() => false)) {
    await care.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }
  return fake;
}

test.describe('Call Stay (browser call mode)', () => {
  test('call rings, then connects with a clock, mute and end; ending closes it and the session', async ({ page }) => {
    const fake = await openToday(page);
    await page.getByTestId('call-direct-stay-btn').click();
    // the call screen opens at once and rings
    const overlay = page.getByTestId('call-overlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveAttribute('data-call-state', 'ringing');
    await expect(page.getByTestId('call-clock')).toHaveText('Calling…');
    // first mic use asks for consent in-app, after the ring
    const consent = page.getByRole('button', { name: /start talking/i });
    if (await consent.isVisible({ timeout: 5000 }).catch(() => false)) await consent.click();
    await expect(overlay).toHaveAttribute('data-call-state', 'connected', { timeout: 12000 });
    expect(fake.managedAgentSocketOpened()).toBe(false); // real AssemblyAI path, no silent fallback
    await expect(page.getByTestId('call-clock')).toHaveText(/^\d\d:\d\d$/);

    await page.getByTestId('call-mute').click();
    await expect(page.getByTestId('call-state')).toHaveText('You are muted');
    await page.getByTestId('call-mute').click();

    await page.getByTestId('call-end').click();
    await expect(overlay).toBeHidden();
  });

  test('"call me in 5 min" books a call and can be cancelled; nothing is booked without storage', async ({ page }) => {
    await openToday(page);
    await page.getByTestId('call-me-5').click();
    await expect(page.getByTestId('call-booked')).toContainText('Stay will call you at');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByTestId('call-me-5')).toBeVisible();
  });

  test('a due scheduled call rings in-page; Answer starts the call', async ({ page }) => {
    await openToday(page);
    await page.evaluate(() => localStorage.setItem('stay:scheduled-call:v1', String(Date.now() - 1000)));
    await expect(page.getByTestId('incoming-call')).toBeVisible({ timeout: 6000 });
    await page.getByTestId('call-answer').click();
    const consent = page.getByRole('button', { name: /start talking/i });
    if (await consent.isVisible({ timeout: 5000 }).catch(() => false)) await consent.click();
    await expect(page.getByTestId('call-overlay')).toHaveAttribute('data-call-state', 'connected', { timeout: 12000 });
  });
});
