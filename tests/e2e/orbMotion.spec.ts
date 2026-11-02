import { test, expect } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/** Owner, 2 Nov 2026: "enhance it more, transform effects". A ripple when Stay starts to speak, and a glow that follows its voice. */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

type OrbDebug = { pulse?: number; glow?: number; frameMs: number[] };

test('the orb ripples when Stay starts speaking and glows with its voice, at a smooth frame rate', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __stayOrbDebug: boolean }).__stayOrbDebug = true;
    (window as unknown as { __peak: { pulse: number; glow: number } }).__peak = { pulse: 0, glow: 0 };
    const tick = () => {
      const o = (window as unknown as { __stayOrb?: OrbDebug }).__stayOrb;
      const p = (window as unknown as { __peak: { pulse: number; glow: number } }).__peak;
      if (o) {
        p.pulse = Math.max(p.pulse, o.pulse ?? 0);
        p.glow = Math.max(p.glow, o.glow ?? 0);
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  const fake = await installFakeFastVoice(page, { chatReplyText: 'Okay. Open the email and type one word. Want to do that now?', ttsChunksPerFlush: 8, ttsChunkIntervalMs: 120 });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
  await page.evaluate(() => { (window as unknown as { __peak: { pulse: number; glow: number } }).__peak = { pulse: 0, glow: 0 }; });
  fake.pushSttFinal('I need to reply to my landlord and I keep avoiding it.', 0);
  await expect(page.getByTestId('chat-agent-message').last()).toContainText('Open the email', { timeout: 10000 });
  await page.waitForTimeout(1500);

  const peak = await page.evaluate(() => (window as unknown as { __peak: { pulse: number; glow: number } }).__peak);
  expect(peak.pulse, 'ripple when speaking starts').toBeGreaterThan(0.5);
  expect(peak.glow, 'glow follows the voice').toBeGreaterThan(0.05);
  const frames = await page.evaluate(() => ((window as unknown as { __stayOrb?: OrbDebug }).__stayOrb?.frameMs ?? []).slice(-120).sort((a, b) => a - b));
  const p95 = frames[Math.floor(frames.length * 0.95)];
  expect(p95, `95th percentile frame ${p95} ms`).toBeLessThan(40);
});

test('reduced motion: no ripple', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => { (window as unknown as { __stayOrbDebug: boolean }).__stayOrbDebug = true; });
  const fake = await installFakeFastVoice(page, { chatReplyText: 'Okay. Open the email and type one word.' });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
  fake.pushSttFinal('I need to reply to my landlord.', 0);
  await expect(page.getByTestId('chat-agent-message').last()).toContainText('Open the email', { timeout: 10000 });
  const pulse = await page.evaluate(() => (window as unknown as { __stayOrb?: OrbDebug }).__stayOrb?.pulse ?? 0);
  expect(pulse).toBe(0);
});
