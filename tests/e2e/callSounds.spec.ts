import { test, expect } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/** Owner, 2 Nov 2026: "when I'm ending the conversation, the ending noise should come, twinkle or something, like in a real phone". */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

test('a call chimes up when it connects and down when it ends', async ({ page }) => {
  await installFakeFastVoice(page, { chatReplyText: 'Okay.' });
  await page.addInitScript(() => {
    const w = window as unknown as { __notes: number[] };
    w.__notes = [];
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, ...a: Parameters<OscillatorNode['start']>) {
      w.__notes.push(Math.round(this.frequency.value));
      return start.apply(this, a);
    };
  });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  const notes = () => page.evaluate(() => (window as unknown as { __notes: number[] }).__notes.filter((f) => f === 659 || f === 988));

  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
  await expect.poll(notes).toEqual([659, 988]);

  await page.getByTestId('mic-button').click(); // end
  await expect.poll(notes).toEqual([659, 988, 988, 659]);
});
