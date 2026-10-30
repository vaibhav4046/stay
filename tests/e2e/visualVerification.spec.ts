import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installFakeVoice } from './helpers/fakeVoice';

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  },
});

const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'verification-screenshots');

test.describe('Stay Visual Verification & Screenshot Suite', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  test('captures full visual verification suite across desktop and mobile', async ({ page }) => {
    test.setTimeout(60000);

    // 1. Desktop Onboarding & Idle Screen with Gemini Live Visualizer
    await page.setViewportSize({ width: 1280, height: 900 });
    const voice = await installFakeVoice(page);

    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Onboarding flow
    await page.getByTestId('care-self_managing').click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();

    // Wait for canvas orb ready
    await expect(page.getByTestId('orb-button')).toBeVisible();
    await page.waitForSelector('[data-testid="orb-button"] canvas');
    await page.waitForTimeout(1000);

    // Screenshot 1: Desktop Today Screen (Resting Orb + Idle Gemini Live Voice Capsule)
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '01-desktop-idle-gemini-live.png'),
      fullPage: true,
    });

    // Screenshot 2: Close-up of Gemini Live Visualizer in Idle State
    const micButton = page.getByTestId('mic-button');
    await expect(micButton).toBeVisible();
    await micButton.screenshot({
      path: path.join(OUTPUT_DIR, '02-gemini-live-pill-idle.png'),
    });

    // 2. Start Live Voice Session (Auto-Mic active, expanding soundwave bars)
    await micButton.click();
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
    await page.waitForTimeout(800);

    // Screenshot 3: Live Auto-Mic Active with expanding spectrum bars
    await micButton.screenshot({
      path: path.join(OUTPUT_DIR, '03-gemini-live-pill-active-automic.png'),
    });

    // Screenshot 4: Full Page in Live Listening State
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '04-desktop-listening-state.png'),
      fullPage: true,
    });

    // 3. Conversational Check-in ("Hi, how are you?")
    const input = page.getByTestId('task-input');
    await input.fill('Hi, how are you?');
    await page.getByTestId('send').click();
    await page.waitForTimeout(1200);

    // Screenshot 5: Conversational Check-in (warm reply, zero chore jargon)
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '05-conversational-greeting-checkin.png'),
      fullPage: true,
    });

    // 4. Shape Transformation ("Turn into a rocket")
    await input.fill('Turn into a rocket');
    await page.getByTestId('send').click();

    // Wait for the orb to morph into rocket shape
    await expect.poll(
      async () => {
        return await page
          .locator('[data-testid="orb-button"] [data-shape]')
          .first()
          .getAttribute('data-shape');
      },
      { timeout: 8000 }
    ).toBe('rocket');

    await page.waitForTimeout(1200);

    // Screenshot 6: Orb 3D Rocket Dot Cloud Transformation
    const orb = page.getByTestId('orb-button');
    await orb.screenshot({
      path: path.join(OUTPUT_DIR, '06-orb-rocket-transformation-closeup.png'),
    });

    // Screenshot 7: Full Screen with Active Rocket Transformation
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '07-desktop-rocket-shape-screen.png'),
      fullPage: true,
    });

    // 5. Mobile Viewport (iPhone 390x844) Responsive Verification
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(800);

    // Screenshot 8: Mobile Responsive Viewport with Rocket & Gemini Live bar
    await page.screenshot({
      path: path.join(OUTPUT_DIR, '08-mobile-390px-rocket-and-live-bar.png'),
      fullPage: true,
    });
  });
});
