import { test, expect, type Page } from '@playwright/test';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * Field test, 2 Nov 2026: while talking to Stay "it wasn't looking smooth, and left right was there". This runs a short call
 * (partial words, a finished turn, a spoken reply) and records every layout shift and any sideways overflow. Nothing on the
 * page may jump while words arrive. (The voice services are faked, so this times the page, not the network.)
 *
 * The orb is the one deliberate move: it goes from the big centred spot to a small one above the conversation when the first words
 * arrive. It glides there (src/components/Glide.tsx). Chrome's layout-shift tracker scores a glide as a shift anyway (it pairs the new
 * layout with the starting transform), so the budget below covers everything except the glide, and a separate check proves the orb
 * passes through intermediate positions instead of snapping in one frame.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

const SHIFT_BUDGET = 0.02; // a "good" page scores under 0.1 over its whole life; a conversation should add almost nothing

async function track(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: Array<{ value: number; at: number; glide: boolean }>; __maxOverflow: number; __orbYs: number[] };
    w.__shifts = [];
    w.__maxOverflow = 0;
    w.__orbYs = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean; sources?: Array<{ node?: Element }> }>) {
        const glide = !!e.sources?.length && e.sources.every((s) => !!s.node?.closest?.('[data-glide]'));
        if (!e.hadRecentInput) w.__shifts.push({ value: e.value, at: Math.round(performance.now()), glide });
      }
    }).observe({ type: 'layout-shift', buffered: true });
    const sampleOrb = () => {
      const orb = document.querySelector('[data-testid=orb-button]');
      if (orb) {
        const y = Math.round(orb.getBoundingClientRect().y);
        if (w.__orbYs[w.__orbYs.length - 1] !== y) w.__orbYs.push(y);
      }
      requestAnimationFrame(sampleOrb);
    };
    requestAnimationFrame(sampleOrb);
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
    await page.evaluate(() => {
      const w = window as unknown as { __shifts: unknown[]; __orbYs: number[] };
      w.__shifts = [];
      w.__orbYs = [];
    });

    await page.getByTestId('mic-button').click();
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
    for (const [text, order] of [['I need to', 0], ['I need to reply to my landlord', 0]] as const) {
      fake.pushSttPartial(text, order);
      await page.waitForTimeout(250);
    }
    fake.pushSttFinal('I need to reply to my landlord and I keep avoiding it.', 0);
    await expect(page.getByTestId('chat-agent-message').last()).toContainText('Open the email', { timeout: 10000 });
    await page.waitForTimeout(2500); // the reply plays and settles

    const { shifts, glided, overflow, orbYs } = await page.evaluate(() => {
      const w = window as unknown as { __shifts: Array<{ value: number; glide: boolean }>; __maxOverflow: number; __orbYs: number[] };
      const sum = (list: Array<{ value: number }>) => list.reduce((s, x) => s + x.value, 0);
      return { shifts: sum(w.__shifts.filter((x) => !x.glide)), glided: sum(w.__shifts.filter((x) => x.glide)), overflow: w.__maxOverflow, orbYs: w.__orbYs };
    });
    console.log(`layout ${name}: shift outside the orb glide ${shifts.toFixed(4)} (orb glide, as scored by Chrome: ${glided.toFixed(4)}), widest overflow ${overflow}px, orb passed through ${orbYs.length} positions`);
    expect(overflow, 'sideways overflow').toBeLessThanOrEqual(1);
    expect(shifts, 'layout shift during the call, outside the orb glide').toBeLessThanOrEqual(SHIFT_BUDGET);
    // a snap shows two positions (big, small); a glide passes through several
    expect(orbYs.length, `orb positions ${orbYs.join(', ')}`).toBeGreaterThanOrEqual(4);
  });
}
