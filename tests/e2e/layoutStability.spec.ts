import { test, expect, type Page } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * Field test, 2 Nov 2026: while talking to Stay "it wasn't looking smooth, and left right was there". This runs a short call
 * (partial words, a finished turn, a spoken reply) and records every layout shift and any sideways overflow. Nothing on the
 * page may jump while words arrive. (The voice services are faked, so this times the page, not the network.)
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

const SHIFT_BUDGET = 0.02; // a "good" page scores under 0.1 over its whole life; a conversation should add almost nothing

async function track(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: Array<{ value: number; at: number }>; __maxOverflow: number };
    w.__shifts = [];
    w.__maxOverflow = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
        if (!e.hadRecentInput) w.__shifts.push({ value: e.value, at: Math.round(performance.now()) });
      }
    }).observe({ type: 'layout-shift', buffered: true });
    window.setInterval(() => {
      w.__maxOverflow = Math.max(w.__maxOverflow, document.documentElement.scrollWidth - window.innerWidth);
    }, 100);
  });
}

for (const [name, size] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]] as const) {
  test(`a call does not move the page around (${name})`, async ({ page }) => {
    await page.setViewportSize(size);
    await track(page);
    const fake = await installFakeFastVoice(page, { chatReplyText: 'Okay. Open the email and type one word. Want to do that now?', ttsChunksPerFlush: 8, ttsChunkIntervalMs: 120 });
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId('care-self_managing').click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
    await expect(page.getByTestId('task-input')).toBeVisible();
    await page.waitForTimeout(800); // let the page settle: only shifts during the call count
    await page.evaluate(() => { (window as unknown as { __shifts: unknown[] }).__shifts = []; });

    await page.getByTestId('mic-button').click();
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
    for (const [text, order] of [['I need to', 0], ['I need to reply to my landlord', 0]] as const) {
      fake.pushSttPartial(text, order);
      await page.waitForTimeout(250);
    }
    fake.pushSttFinal('I need to reply to my landlord and I keep avoiding it.', 0);
    await expect(page.getByTestId('chat-agent-message').last()).toContainText('Open the email', { timeout: 10000 });
    await page.waitForTimeout(2500); // the reply plays and settles

    const { shifts, overflow } = await page.evaluate(() => {
      const w = window as unknown as { __shifts: Array<{ value: number }>; __maxOverflow: number };
      return { shifts: w.__shifts.reduce((s, x) => s + x.value, 0), overflow: w.__maxOverflow };
    });
    console.log(`layout ${name}: total shift ${shifts.toFixed(4)}, widest overflow ${overflow}px`);
    expect(overflow, 'sideways overflow').toBeLessThanOrEqual(1);
    expect(shifts, 'layout shift during the call').toBeLessThanOrEqual(SHIFT_BUDGET);
  });
}
