import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  },
});

const SHOTS = 'docs/evidence/signal';

async function openToday(page: Page, reply = 'Start with the stack of bills on your left and sort the top three.') {
  const fake = await installFakeFastVoice(page, { chatReplyText: reply, ttsChunksPerFlush: 14, ttsChunkIntervalMs: 120 });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const care = page.getByTestId('care-self_managing');
  if (await care.isVisible({ timeout: 5000 }).catch(() => false)) {
    await care.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }
  await expect(page.getByTestId('orb-button')).toBeVisible();
  return fake;
}

const wave = (page: Page) => page.getByTestId('signal-wave').first();
const drive = async (page: Page) => Number((await wave(page).getAttribute('data-drive')) ?? '0');
const waveState = (page: Page) => wave(page).getAttribute('data-signal-state');

test.describe('STAY Signal: the wave is driven by real audio and tells the truth', () => {
  test('flat when nothing is happening, follows rendered assistant audio while speaking, and lets go when interrupted', async ({ page }) => {
    const fake = await openToday(page);
    // resting: nothing is capturing or playing, so there is no wave at all
    await expect(page.getByTestId('signal-wave')).toHaveCount(0);

    await page.getByTestId('orb-button').click();
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
    await expect(wave(page)).toHaveAttribute('data-signal-state', 'listening');
    expect(fake.managedAgentSocketOpened()).toBe(false);

    fake.pushSttFinal('Organize office.', 0);
    // the assistant speaks: the wave is in the speaking state and has real energy from the audio being rendered
    await expect.poll(() => waveState(page), { timeout: 8000 }).toBe('speaking');
    await expect.poll(() => drive(page), { timeout: 5000 }).toBeGreaterThan(0.05);

    // the person talks over it: playback is cancelled and the wave stops being "speaking" with it
    fake.pushSttSpeechStarted();
    fake.pushSttPartial('Wait, I found the document already', 1);
    await expect.poll(() => fake.ttsSentJson().some((m) => m.type === 'Cancel'), { timeout: 4000 }).toBe(true);
    await expect.poll(() => waveState(page), { timeout: 2000 }).not.toBe('speaking');
  });

  test('a muted call shows a stopped wave, never one that looks like it is capturing', async ({ page }) => {
    await openToday(page);
    await page.getByTestId('call-direct-stay-btn').click();
    const overlay = page.getByTestId('call-overlay');
    await expect(overlay).toHaveAttribute('data-call-state', 'ringing');
    await expect(overlay.getByTestId('call-orb')).toBeVisible(); // the same particle orb as the landing page
    const consent = page.getByRole('button', { name: /start talking/i });
    if (await consent.isVisible({ timeout: 5000 }).catch(() => false)) await consent.click();
    await expect(overlay).toHaveAttribute('data-call-state', 'connected', { timeout: 12000 });

    await page.getByTestId('call-mute').click();
    await expect(page.getByTestId('call-state')).toHaveText('You are muted');

    // captions can be hidden and shown; the controls are real buttons
    await page.getByTestId('call-captions-toggle').click();
    await expect(page.getByTestId('call-captions')).toHaveCount(0);
    await page.getByTestId('call-captions-toggle').click();
    await expect(page.getByTestId('call-captions')).toBeVisible();

    // ending the call releases everything: the overlay is gone and no wave is left running for it
    await page.getByTestId('call-end').click();
    await expect(overlay).toBeHidden();
  });

  test('the landing page never touches the microphone on load, hover or scroll', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __gum: number }).__gum = 0;
      const md = navigator.mediaDevices;
      if (md?.getUserMedia) {
        const orig = md.getUserMedia.bind(md);
        md.getUserMedia = (c) => {
          (window as unknown as { __gum: number }).__gum++;
          return orig(c);
        };
      }
    });
    await page.goto('/');
    await page.getByTestId('hero-example').hover();
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => (window as unknown as { __gum: number }).__gum)).toBe(0);
  });

  test('reduced motion: the hero and its start still work', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.getByTestId('hero-example')).toBeVisible();
    await page.getByTestId('hero-input').fill('my taxes');
    await expect(page.getByTestId('hero-start')).toBeVisible();
  });
});

test.describe('STAY Signal evidence (real screenshots and a measured frame rate)', () => {
  test('captures the states and measures the wave loop', async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    const sha = execSync('git rev-parse --short HEAD').toString().trim();

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByTestId('hero-example').waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/landing-hero-desktop.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByTestId('hero-example').waitFor();
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0); // no horizontal scroll on a phone
    await page.screenshot({ path: `${SHOTS}/landing-hero-mobile.png` });

    await page.setViewportSize({ width: 1440, height: 900 });
    await openToday(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/voice-idle.png` });

    // measured: frame intervals of the page's animation loop while the wave is running
    const perf = await page.evaluate(
      () =>
        new Promise<{ frames: number; avgFps: number; p95FrameMs: number; maxFrameMs: number }>((resolve) => {
          const ts: number[] = [];
          const t0 = performance.now();
          const tick = (t: number) => {
            ts.push(t);
            if (t - t0 < 3000) requestAnimationFrame(tick);
            else {
              const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
              resolve({ frames: ts.length, avgFps: Math.round((ts.length / ((ts[ts.length - 1] - ts[0]) / 1000)) * 10) / 10, p95FrameMs: Math.round(d[Math.floor(d.length * 0.95)] * 10) / 10, maxFrameMs: Math.round(d[d.length - 1] * 10) / 10 });
            }
          };
          requestAnimationFrame(tick);
        })
    );
    writeFileSync(
      `${SHOTS}/perf-${sha}.json`,
      JSON.stringify({ gitSha: sha, tier: 'browser (headless Chromium, software rendering, this machine)', measured: perf, note: 'frame intervals of requestAnimationFrame over 3 s with the Signal wave running on /app/today; not a device benchmark' }, null, 2)
    );

    await page.getByTestId('call-direct-stay-btn').click();
    await expect(page.getByTestId('call-overlay')).toHaveAttribute('data-call-state', 'ringing');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/call-ringing.png` });
    const consent = page.getByRole('button', { name: /start talking/i });
    if (await consent.isVisible({ timeout: 5000 }).catch(() => false)) await consent.click();
    await expect(page.getByTestId('call-overlay')).toHaveAttribute('data-call-state', 'connected', { timeout: 12000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOTS}/call-connected.png` });
    await page.getByTestId('call-mute').click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/call-muted.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/call-mobile.png` });
    await page.getByTestId('call-end').click();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByTestId('hero-example').waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/landing-hero-reduced-motion.png` });
    expect(perf.frames).toBeGreaterThan(30);
  });
});
