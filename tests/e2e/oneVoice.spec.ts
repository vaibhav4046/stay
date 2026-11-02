import { test, expect, type Page } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * Field test, 2 Nov 2026: "when I'm calling, 2 or 3 voices are coming up". A second tap, the call ring timer or a retry could start a
 * second voice session while the first was still connecting; the first kept speaking. One tap or many, there is one session.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

async function openToday(page: Page) {
  const fake = await installFakeFastVoice(page, { chatReplyText: 'Okay.', ttsChunksPerFlush: 3, ttsChunkIntervalMs: 30 });
  const sockets: string[] = [];
  page.on('websocket', (ws) => sockets.push(ws.url()));
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
  return { fake, sockets };
}

const count = (sockets: string[], host: string) => sockets.filter((u) => u.includes(host)).length;

test('tapping the mic twice in a row opens one speech session and one voice session, not two', async ({ page }) => {
  const { sockets } = await openToday(page);
  const mic = page.getByTestId('mic-button');
  await mic.click();
  await mic.click({ force: true }); // while the first is still connecting
  await page.waitForTimeout(300);
  await mic.click({ force: true });
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
  await page.waitForTimeout(1500);
  expect(count(sockets, 'streaming.assemblyai.com'), sockets.join('\n')).toBe(1);
  expect(count(sockets, 'tts.us.assemblyai.com'), sockets.join('\n')).toBe(1);
});

test('the call button, then the mic while it rings, is still one session', async ({ page }) => {
  const { sockets } = await openToday(page);
  await page.getByTestId('call-direct-stay-btn').click();
  await page.getByTestId('mic-button').click({ force: true }).catch(() => undefined); // may be covered by the call screen: either way it must not start a second one
  await expect(page.getByTestId('call-overlay')).toHaveAttribute('data-call-state', 'connected', { timeout: 15000 });
  await page.waitForTimeout(1500);
  expect(count(sockets, 'streaming.assemblyai.com'), sockets.join('\n')).toBe(1);
  expect(count(sockets, 'tts.us.assemblyai.com'), sockets.join('\n')).toBe(1);
});
