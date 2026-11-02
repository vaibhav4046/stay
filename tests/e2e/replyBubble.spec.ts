import { test, expect } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * Field test, 2 Nov 2026: "from the speaker side, the full sentences came in one go and then just disappear, and then it was coming
 * word by word". The reply's text arrived before its audio and was shown whole, then repeated in a second bubble as it was spoken.
 * Now a reply has one bubble, and while Stay is speaking it never shows words that have not been spoken yet... or a second copy.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

const REPLY = 'Okay. Open the email and type one word, any word at all. Want to do that now?';

test('one bubble per reply, revealed as it is spoken, never shown whole before it is said', async ({ page }) => {
  const fake = await installFakeFastVoice(page, { chatReplyText: REPLY, ttsChunksPerFlush: 10, ttsChunkIntervalMs: 160 });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });

  // sample every frame: how many of this reply's words are on screen, and in how many places
  await page.evaluate(() => {
    const w = window as unknown as { __samples: Array<{ words: number; copies: number; speaking: boolean }> };
    w.__samples = [];
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const tick = () => {
      const places = [...document.querySelectorAll('[data-testid=chat-agent-message], [data-testid=chat-live-agent-partial]')]
        .map((b) => norm(b.textContent || ''))
        .filter((b) => /Okay|Open the/.test(b) && !/AI/.test(b));
      const words = Math.max(0, ...places.map((b) => (b.slice(b.indexOf('Okay') >= 0 ? b.indexOf('Okay') : b.indexOf('Open')).match(/\S+/g) || []).length));
      const speaking = document.querySelector('[data-testid=orb-status]')?.textContent?.trim() === 'Speaking';
      w.__samples.push({ words, copies: places.length, speaking });
      requestAnimationFrame(tick);
    };
    tick();
  });

  fake.pushSttFinal('I need to reply to my landlord and I keep avoiding it.', 0);
  await expect(page.getByTestId('chat-agent-message').last()).toContainText('Want to do that now?', { timeout: 15000 });
  await expect(page.getByTestId('orb-status')).not.toHaveText('Speaking', { timeout: 15000 });

  const samples = await page.evaluate(() => (window as unknown as { __samples: Array<{ words: number; copies: number; speaking: boolean }> }).__samples);
  const shown = samples.filter((s) => s.speaking && s.words > 0).map((s) => s.words);
  expect(shown.length, 'the reply was never seen being spoken').toBeGreaterThan(5);
  // the reply is 17 words; it starts with a few and grows as it is said (the bug: 14 of 17 in the first frame)
  expect(shown[0], `words on screen when the reply began: ${shown.slice(0, 8).join(', ')}`).toBeLessThanOrEqual(4);
  expect(new Set(shown).size, 'the words did not appear step by step').toBeGreaterThanOrEqual(6);
  expect(Math.max(...samples.map((s) => s.copies)), 'the reply was shown in two places at once').toBeLessThanOrEqual(1);
  await expect(page.getByTestId('chat-agent-message').filter({ hasText: 'Open the email' })).toHaveCount(1);
});
