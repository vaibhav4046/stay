import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

test.use({
  permissions: ['camera', 'microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--mute-audio'] },
});

// a real picture: white page with a blue block
let PNG: Buffer;
test.beforeAll(async () => {
  PNG = await sharp({ create: { width: 320, height: 200, channels: 3, background: '#ffffff' } })
    .composite([{ input: { create: { width: 120, height: 40, channels: 3, background: '#2563eb' } }, left: 20, top: 120 }])
    .png()
    .toBuffer();
});

interface Seen { image?: string; messages: Array<{ role: string; content: string }>; withTools?: boolean; header?: string | undefined }

async function openHome(page: Page) {
  const seen: Seen[] = [];
  await page.route('**/api/voice/chat', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ status: 204 });
    const body = route.request().postDataJSON() as Seen;
    seen.push({ ...body, header: route.request().headers()['x-stay-image'] });
    const reply = body.image ? 'I can see a draft email. The next small step is the subject line.' : 'Okay.';
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\ndata: [DONE]\n\n`,
    });
  });
  await page.addInitScript(() => {
    // a stand-in for the browser's screen picker, which cannot be driven from a test
    navigator.mediaDevices.getDisplayMedia = () => navigator.mediaDevices.getUserMedia({ video: true });
  });
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
  return seen;
}

test.describe('Vision: show Stay a screen, the camera or a picture', () => {
  test('the plus button opens Show Stay with three ways and the privacy words', async ({ page }) => {
    await openHome(page);
    await page.getByTestId('attach-button').click();
    const panel = page.getByTestId('inline-panel');
    await expect(panel).toHaveAttribute('data-panel', 'Show Stay');
    for (const id of ['share-screen', 'share-camera', 'add-picture']) await expect(page.getByTestId(id), id).toBeVisible();
    await expect(page.getByTestId('vision-privacy')).toContainText('not saved');
    await expect(page.getByTestId('vision-privacy')).toContainText('never goes into your history');
  });

  test('a picture is sent with the question, answered by the vision model, shown as a thumbnail, and never saved', async ({ page }) => {
    const seen = await openHome(page);
    await page.getByTestId('picture-input').setInputFiles({ name: 'draft.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('pending-picture')).toBeVisible();
    await page.getByTestId('task-input').fill('what is wrong with this?');
    await page.getByTestId('send').click();

    await expect(page.getByTestId('chat-picture')).toBeVisible();
    await expect(page.getByTestId('chat-agent-message').last()).toContainText('subject line', { timeout: 10000 });
    expect(seen).toHaveLength(1);
    expect(seen[0].image).toMatch(/^data:image\/jpeg;base64,/);
    expect(seen[0].header).toBe('1');
    expect(seen[0].withTools).toBe(false);
    expect(seen[0].messages.at(-1)).toEqual({ role: 'user', content: 'what is wrong with this?' });
    await expect(page.getByTestId('pending-picture')).toHaveCount(0);

    // no pixels in storage, and no plan card for a picture
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    expect(stored).not.toContain('data:image');
    await expect(page.getByTestId('plan-card')).toHaveCount(0);
  });

  test('crisis wording the server found in a picture goes to help, not to "could not make that out"', async ({ page }) => {
    await openHome(page);
    // the server read the vision model's reply, found crisis wording from the picture, and stopped it (T0.3)
    await page.route('**/api/voice/chat', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ safety: 'crisis' }) }));
    await page.getByTestId('picture-input').setInputFiles({ name: 'note.png', mimeType: 'image/png', buffer: PNG });
    await page.getByTestId('task-input').fill('what does this say?');
    await page.getByTestId('send').click();
    await expect(page.getByText('116 123').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('could not make that out')).toHaveCount(0);
  });

  test('an instruction about medication in a picture reply shows the boundary, never the order', async ({ page }) => {
    await openHome(page);
    await page.route('**/api/voice/chat', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ safety: 'medication' }) }));
    await page.getByTestId('picture-input').setInputFiles({ name: 'note.png', mimeType: 'image/png', buffer: PNG });
    await page.getByTestId('task-input').fill('what does this say?');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('chat-agent-message').last()).toContainText('cannot advise on medication', { timeout: 8000 });
  });

  test('a picture alone can be sent, and a non-picture file is refused kindly', async ({ page }) => {
    const seen = await openHome(page);
    await page.getByTestId('picture-input').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.getByText('That is not a picture.')).toBeVisible();
    await expect(page.getByTestId('pending-picture')).toHaveCount(0);

    await page.getByTestId('picture-input').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
    await page.getByTestId('send').click();
    await expect.poll(() => seen.length).toBe(1);
    expect(seen[0].image).toBeTruthy();
  });

  test('camera: the share bar shows, Look now sends a frame, Stop turns it off', async ({ page }) => {
    const seen = await openHome(page);
    await page.getByTestId('attach-button').click();
    await page.getByTestId('share-camera').click();
    const bar = page.getByTestId('share-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('data-share-mode', 'camera');
    await expect(bar).toContainText('Stay only looks when you ask');
    await expect.poll(() => page.evaluate(() => (document.querySelector('[data-testid="share-preview"]') as HTMLVideoElement).readyState), { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    await page.getByTestId('look-now').click();
    await expect.poll(() => seen.length, { timeout: 8000 }).toBe(1);
    expect(seen[0].image).toMatch(/^data:image\/jpeg;base64,/);
    await page.getByTestId('stop-share').click();
    await expect(bar).toHaveCount(0);
    const live = await page.evaluate(() => document.querySelectorAll('video').length);
    expect(live).toBe(0);
  });

  test('screen: words that point at the screen carry a frame, ordinary talk does not, "share my screen" opens the panel', async ({ page }) => {
    const seen = await openHome(page);
    await page.getByTestId('task-input').fill('share my screen');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('inline-panel')).toHaveAttribute('data-panel', 'Show Stay');
    expect(seen).toHaveLength(0);

    await page.getByTestId('share-screen').click();
    await expect(page.getByTestId('share-bar')).toHaveAttribute('data-share-mode', 'screen');
    await expect.poll(() => page.evaluate(() => (document.querySelector('[data-testid="share-preview"]') as HTMLVideoElement).readyState), { timeout: 8000 }).toBeGreaterThanOrEqual(2);

    await page.waitForTimeout(1400);
    await page.getByTestId('task-input').fill('what do you see on my screen?');
    await page.getByTestId('send').click();
    await expect.poll(() => seen.filter((s) => s.image).length, { timeout: 8000 }).toBe(1);

    await page.waitForTimeout(1400);
    await page.getByTestId('task-input').fill('thanks, that helps');
    await page.getByTestId('send').click();
    await page.waitForTimeout(1500);
    expect(seen.filter((s) => s.image)).toHaveLength(1); // the second message pointed at nothing
  });

  test('phone width: the plus button, input and controls fit', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await openHome(page);
    for (const id of ['attach-button', 'task-input', 'mic-button', 'call-direct-stay-btn']) {
      const b = (await page.getByTestId(id).boundingBox())!;
      expect(b.x, id).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, id).toBeLessThanOrEqual(375);
    }
    const input = (await page.getByTestId('task-input').boundingBox())!;
    expect(input.width).toBeGreaterThan(60);
  });
});
