import { test, expect, type Page } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/** T0.7: the first voice session on a device says it is an AI and shows the same words; later sessions do not repeat it. */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

const LINE = "I'm an AI, not a person";

async function open(page: Page) {
  const fake = await installFakeFastVoice(page, { chatReplyText: 'Okay.', ttsChunksPerFlush: 3, ttsChunkIntervalMs: 30 });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-age').waitFor();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  return fake;
}

const spoken = (fake: Awaited<ReturnType<typeof open>>) => fake.ttsSentJson().filter((m) => JSON.stringify(m).includes(LINE)).length;

test('onboarding shows the 18+ and AI notice', async ({ page }) => {
  await installFakeFastVoice(page);
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('onboarding-age')).toContainText('18');
  await expect(page.getByTestId('onboarding-age')).toContainText('AI');
});

test('the first call speaks the line and shows it as text; the second call on the same device does not', async ({ page }) => {
  const fake = await open(page);
  const overlay = page.getByTestId('call-overlay');

  await page.getByTestId('call-direct-stay-btn').click();
  await expect(overlay).toHaveAttribute('data-call-state', 'connected', { timeout: 12000 });
  await expect.poll(() => spoken(fake), { timeout: 8000 }).toBeGreaterThan(0);
  const firstCall = spoken(fake);
  await page.getByTestId('call-end').click();
  await expect(overlay).toBeHidden();
  await expect(page.getByTestId('chat-agent-message').first()).toContainText(LINE, { timeout: 8000 });
  expect(await page.evaluate(() => localStorage.getItem('stay:ai_disclosed:v1'))).toBe('1');

  await page.waitForTimeout(1500);
  await page.getByTestId('call-direct-stay-btn').click();
  await expect(overlay).toHaveAttribute('data-call-state', 'connected', { timeout: 12000 });
  await page.waitForTimeout(2500); // the greeting of the second call has had time to be spoken
  expect(spoken(fake)).toBe(firstCall);
});
