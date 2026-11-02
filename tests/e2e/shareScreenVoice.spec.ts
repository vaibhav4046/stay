import { test, expect } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * Field test, 2 Nov 2026: "Share my screen and everything is not working. It looks gimmick... when I click to share my screen,
 * automatically voice should be turned on rather than type." Sharing now starts the voice and Stay takes a first look on its own.
 */
test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

test('sharing the screen turns the voice on and Stay looks at the screen without being asked', async ({ page }) => {
  await installFakeFastVoice(page, { chatReplyText: 'I can see a draft email. Want help with the first line?' });
  const pictures: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/voice/chat') && r.method() === 'POST') {
      const body = r.postDataJSON() as { image?: string; messages?: Array<{ content?: string }> };
      if (body.image) pictures.push(String(body.messages?.at(-1)?.content ?? ''));
    }
  });
  await page.addInitScript(() => {
    navigator.mediaDevices.getDisplayMedia = () => navigator.mediaDevices.getUserMedia({ video: true }); // stand-in for the browser's picker
  });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('orb-button')).toHaveAttribute('aria-pressed', 'false');

  await page.getByTestId('task-input').fill('share my screen');
  await page.getByTestId('send').click();
  await page.getByTestId('share-screen').click();

  await expect(page.getByTestId('share-bar')).toHaveAttribute('data-share-mode', 'screen');
  await expect(page.getByTestId('orb-button')).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 }); // the voice is on
  await expect.poll(() => pictures.length, { timeout: 10000 }).toBe(1); // Stay looked
  expect(pictures[0]).toMatch(/my screen/i);
  await expect(page.getByTestId('chat-agent-message').last()).toContainText('I can see', { timeout: 10000 });
});
