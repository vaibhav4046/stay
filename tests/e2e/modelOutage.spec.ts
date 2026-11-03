import { test, expect, type Page } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * Soak, 3 Nov 2026: with the voice connection down, twelve turns were heard and answered by the model and every answer was thrown
 * away: no words, no sound, an orb that said Listening. With the voice down the words still reach the screen and the call goes on.
 * And when the model is out of tokens, Stay says so in plain words, once, and listens again.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

async function startCall(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
}

const MSG = 'I am getting too many requests right now, so I cannot answer yet. Give it a minute and ask again.';

test('model out of tokens: the plain failure line shows once per turn and the call returns to listening', async ({ page }) => {
  const fake = await installFakeFastVoice(page, { chatFails: { error: 'quota', message: MSG } });
  await startCall(page);
  await expect(page.getByTestId('chat-agent-message')).toHaveCount(1, { timeout: 15000 }); // the greeting
  for (const [order, say] of ['I do not know where to start.', 'Pick one thing for me to do.'].entries()) {
    const before = await page.getByTestId('chat-agent-message').count();
    fake.pushSttFinal(say, order);
    await expect(page.getByTestId('chat-agent-message')).toHaveCount(before + 1, { timeout: 10000 });
    await page.waitForTimeout(1500); // a doubled line would show up as a second bubble
    await expect(page.getByTestId('chat-agent-message')).toHaveCount(before + 1);
    await expect(page.getByTestId('chat-agent-message').last()).toContainText(MSG);
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
  }
});

test('voice service down: the reply still appears as words and the call goes on', async ({ page }) => {
  const fake = await installFakeFastVoice(page, { chatReplyText: 'Open the email and type the first line.', ttsDown: true });
  await startCall(page);
  await expect(page.getByTestId('chat-agent-message')).toHaveCount(1, { timeout: 15000 }); // the greeting
  await page.waitForTimeout(3500); // the voice connection drops
  for (const [order, say] of ['I do not know where to start.', 'Okay, and then what?'].entries()) {
    const before = await page.getByTestId('chat-agent-message').count();
    fake.pushSttFinal(say, order);
    await expect(page.getByTestId('chat-agent-message')).toHaveCount(before + 1, { timeout: 10000 });
    await expect(page.getByTestId('chat-agent-message').last()).toContainText('Open the email and type the first line.');
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
  }
});
