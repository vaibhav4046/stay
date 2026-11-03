import { test, expect } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * After an interruption, the next reply must be heard. The demo take of 3 Nov 2026 showed "Speaking" with silence for about 17 s after
 * the interruption; this checks that a reply following an interruption really plays (the playback marks its first played sample).
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

test('the reply after an interruption is played, not left paused', async ({ page }) => {
  await page.addInitScript(() => { (window as unknown as { __stayFastDebug: boolean }).__stayFastDebug = true; });
  const fake = await installFakeFastVoice(page, { chatReplyText: 'Here is a long first answer that keeps going for a while so that it can be interrupted part way through.', ttsChunksPerFlush: 10, ttsChunkIntervalMs: 120 });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });

  fake.pushSttFinal('Plan my whole week in detail.', 0);
  await expect(page.getByTestId('orb-status')).toHaveText('Speaking', { timeout: 10000 });
  await page.waitForTimeout(600);
  const playsBefore = await page.evaluate(() => ((window as unknown as { __stayPlayStarts?: number[] }).__stayPlayStarts ?? []).length);

  // the person talks over it: the server notices speech, then the words arrive
  fake.pushSttSpeechStarted();
  await page.waitForTimeout(200);
  fake.pushSttPartial('wait stop', 1);
  fake.pushSttFinal('Wait, stop. Make it smaller.', 1);

  // a second reply must actually play
  await expect.poll(() => page.evaluate(() => ((window as unknown as { __stayPlayStarts?: number[] }).__stayPlayStarts ?? []).length), { timeout: 15000 }).toBeGreaterThan(playsBefore);
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 20000 });
});
