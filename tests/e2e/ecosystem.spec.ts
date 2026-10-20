import { expect, test } from '@playwright/test';

/** The web app's side of the ecosystem: the wrapper bridge (src/lib/host.ts), the manifest, the share target, the offline page. */
async function seedProfile(page: import('@playwright/test').Page) {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      'stay_v1_profile',
      JSON.stringify({ userId: 'local-user', careContext: 'waitlisted', interactionMode: 'voice_and_text', proactiveCheckins: true, onboardingCompleted: true, updatedAt: new Date().toISOString() }),
    ),
  );
}

test('wrapper bridge: a command starts the timer and the page announces it', async ({ page }) => {
  await seedProfile(page);
  await page.goto('/app/today');
  await page.waitForSelector('[aria-label="Talk to Stay"]');
  await page.evaluate(() => {
    (window as unknown as { __host: string[] }).__host = [];
    window.addEventListener('stay:host', (e) => (window as unknown as { __host: string[] }).__host.push((e as CustomEvent).detail));
  });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('stay:command', { detail: JSON.stringify({ type: 'timer', minutes: 20 }) })));
  await expect.poll(() => page.evaluate(() => (window as unknown as { __host: string[] }).__host.map((d) => JSON.parse(d).type))).toContain('timer-started');
  const started = await page.evaluate(() => (window as unknown as { __host: string[] }).__host.map((d) => JSON.parse(d)).find((e) => e.type === 'timer-started'));
  expect(started.minutes).toBe(20);
  expect(started.endsAt).toBeGreaterThan(Date.now() + 19 * 60_000);
});

test('wrapper bridge: unknown commands are ignored', async ({ page }) => {
  await seedProfile(page);
  await page.goto('/app/today');
  await page.waitForSelector('[aria-label="Talk to Stay"]');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('stay:command', { detail: JSON.stringify({ type: 'timer', minutes: -5 }) })));
  await page.waitForTimeout(500);
  await expect(page.getByTestId('timer-card')).toHaveCount(0);
});

test('brain dump shortcut opens the brain dump sheet', async ({ page }) => {
  await seedProfile(page);
  await page.goto('/app/today?action=dump');
  await expect(page.getByText(/brain dump/i).first()).toBeVisible();
});

test('manifest is installable and complete', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  const m = await res.json();
  expect(m.id).toBe('/app/today');
  expect(m.display).toBe('standalone');
  const purposes = m.icons.map((i: { purpose: string; sizes: string }) => `${i.purpose}:${i.sizes}`);
  expect(purposes).toEqual(expect.arrayContaining(['any:192x192', 'any:512x512', 'maskable:192x192', 'maskable:512x512', 'monochrome:512x512']));
  expect(m.shortcuts.map((s: { name: string }) => s.name)).toEqual(expect.arrayContaining(['Talk to Stay', 'Brain dump']));
  expect(m.share_target.action).toBe('/app/share');
  expect(m.screenshots.map((s: { form_factor: string }) => s.form_factor).sort()).toEqual(['narrow', 'wide']);
  for (const url of [...m.icons, ...m.screenshots].map((x: { src: string }) => x.src)) {
    const r = await request.get(url);
    expect(r.ok(), url).toBeTruthy();
    expect(r.headers()['content-type']).toContain('image/png');
  }
});

test('share target parks the shared text locally', async ({ page }) => {
  await seedProfile(page);
  await page.goto('/app/share?title=Read%20later&text=check%20the%20lease&url=https%3A%2F%2Fexample.com%2Fa');
  await expect(page.getByTestId('share-text')).toContainText('check the lease');
  const parked = await page.evaluate(() => JSON.parse(localStorage.getItem('stay_parking_lot') || '[]').map((i: { text: string }) => i.text));
  expect(parked[0]).toContain('check the lease');
});

test('offline page is served and themed', async ({ page }) => {
  await page.goto('/offline.html');
  await expect(page.getByRole('heading', { name: /no connection/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /try again/i })).toHaveAttribute('href', '/app/today');
});
