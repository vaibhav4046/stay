import { test, expect, type Page } from '@playwright/test';

/**
 * T0.5 consent and data. Nothing here uses the fake-voice helpers, because those start from "already agreed".
 * Counters on window.__media tell us if the browser was ever asked for the microphone, the camera or the screen.
 */
test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--mute-audio'] },
});

declare global {
  interface Window {
    __media: { mic: number; camera: number; screen: number };
  }
}

async function open(page: Page, url = '/app/today') {
  const imageRequests: string[] = [];
  page.on('request', (r) => {
    const body = r.postData() ?? '';
    if (r.method() === 'POST' && (body.includes('data:image') || r.headers()['x-stay-image'])) imageRequests.push(`${r.url()} ${body.slice(0, 60)}`);
  });
  await page.route('**/api/voice/chat', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ status: 204 });
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: 'Okay.' } }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.addInitScript(() => {
    window.__media = { mic: 0, camera: 0, screen: 0 };
    const md = navigator.mediaDevices;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = (c?: MediaStreamConstraints) => {
      if (c?.audio) window.__media.mic += 1;
      if (c?.video) window.__media.camera += 1;
      return real(c);
    };
    md.getDisplayMedia = () => {
      window.__media.screen += 1;
      return real({ video: true });
    };
  });
  await page.goto(url);
  return imageRequests;
}

async function onboard(page: Page) {
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

const media = (page: Page) => page.evaluate(() => window.__media);

test.describe('T0.5 microphone consent', () => {
  test('the first tap on the mic asks first and does not open the microphone; "text only" keeps it closed and switches to typing', async ({ page }) => {
    await open(page);
    await onboard(page);
    await page.getByTestId('mic-button').click();
    await expect(page.getByTestId('mic-consent-sheet')).toBeVisible();
    expect((await media(page)).mic).toBe(0);

    await page.getByTestId('consent-text-only').click();
    await expect(page.getByTestId('mic-consent-sheet')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('stay:mic_consented:v1'))).toBe('0');
    // "text only" means quiet mode: the mic button goes away and the microphone stays closed
    await expect(page.getByTestId('mic-button')).toHaveCount(0);
    await page.waitForTimeout(800);
    expect((await media(page)).mic).toBe(0);
  });

  test('the call button asks too, and closing the sheet leaves the microphone closed', async ({ page }) => {
    await open(page);
    await onboard(page);
    await page.getByTestId('call-direct-stay-btn').click();
    await expect(page.getByTestId('mic-consent-sheet')).toBeVisible({ timeout: 8000 });
    expect((await media(page)).mic).toBe(0);
  });

  test('?voice=auto (a shortcut link) cannot skip the question', async ({ page }) => {
    await open(page);
    await onboard(page);
    await page.goto('/app/today?voice=auto');
    await expect(page.getByTestId('mic-consent-sheet')).toBeVisible({ timeout: 8000 });
    expect((await media(page)).mic).toBe(0);
  });

  test('"Start talking" is what opens the microphone, and it is remembered', async ({ page }) => {
    await open(page);
    await onboard(page);
    await page.getByTestId('mic-button').click();
    await page.getByTestId('consent-start-talking').click();
    expect(await page.evaluate(() => localStorage.getItem('stay:mic_consented:v1'))).toBe('1');
    await expect.poll(async () => (await media(page)).mic, { timeout: 8000 }).toBeGreaterThan(0);
  });

  test('"Delete all my data" also removes the consent, so the question comes back', async ({ page }) => {
    await open(page);
    await onboard(page);
    await page.evaluate(() => {
      localStorage.setItem('stay:mic_consented:v1', '1');
      localStorage.setItem('stay:scheduled-call:v1', '{"at":1}');
    });
    await page.goto('/app/settings');
    await page.getByTestId('delete-start').click();
    await page.getByTestId('delete-confirm').click();
    await expect
      .poll(() => page.evaluate(() => ({ consent: localStorage.getItem('stay:mic_consented:v1'), call: localStorage.getItem('stay:scheduled-call:v1'), profile: localStorage.getItem('stay_v1_profile') })))
      .toEqual({ consent: null, call: null, profile: null });
  });
});

test.describe('T0.5 screen, camera and pictures', () => {
  test('nothing is shared on load, after a reload, or by talking about the screen; only the click opens it', async ({ page }) => {
    await open(page);
    await onboard(page);
    await page.waitForTimeout(1200);
    expect(await media(page)).toEqual({ mic: 0, camera: 0, screen: 0 });

    await page.getByTestId('task-input').fill('what is on my screen?');
    await page.getByTestId('send').click();
    await page.waitForTimeout(800);
    expect((await media(page)).screen).toBe(0);
    expect((await media(page)).camera).toBe(0);

    await page.getByTestId('attach-button').click();
    await page.getByTestId('share-camera').click();
    await expect(page.getByTestId('share-bar')).toBeVisible();
    expect((await media(page)).camera).toBe(1);

    // a new visit starts with nothing shared
    await page.reload();
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('share-bar')).toHaveCount(0);
    expect(await media(page)).toEqual({ mic: 0, camera: 0, screen: 0 });
  });

  test('network: while the camera is shared, no picture leaves the browser until the words point at it', async ({ page }) => {
    const images = await open(page);
    await onboard(page);
    await page.getByTestId('attach-button').click();
    await page.getByTestId('share-camera').click();
    await expect(page.getByTestId('share-bar')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (document.querySelector('[data-testid="share-preview"]') as HTMLVideoElement).readyState), { timeout: 8000 }).toBeGreaterThanOrEqual(2);

    for (const text of ['I need to write an email to my landlord', 'what is a good first step', 'thanks, that helps']) {
      await page.getByTestId('task-input').fill(text);
      await page.getByTestId('send').click();
      await page.waitForTimeout(1500);
    }
    expect(images, 'no picture should have been sent').toEqual([]);

    await page.getByTestId('task-input').fill('what do you see?');
    await page.getByTestId('send').click();
    await expect.poll(() => images.length, { timeout: 8000 }).toBe(1);
  });

  test('stopping the share turns the camera light off: no live video track is left', async ({ page }) => {
    await open(page);
    await onboard(page);
    await page.getByTestId('attach-button').click();
    await page.getByTestId('share-camera').click();
    await expect(page.getByTestId('share-bar')).toBeVisible();
    await page.getByTestId('stop-share').click();
    await expect(page.getByTestId('share-bar')).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelectorAll('video').length)).toBe(0);
  });
});
