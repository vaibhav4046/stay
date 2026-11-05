import { expect, test, type Page } from '@playwright/test';

/** What the service worker leaves behind when a check-in arrives with the app closed. */
const seed = (page: Page, entries: Array<[string, string]>) =>
  page.evaluate(async (list) => {
    const cache = await caches.open('stay-inbox');
    for (const [key, body] of list) await cache.put(key, new Response(body, { headers: { 'content-type': 'application/json' } }));
  }, entries);

const AT = Date.now() - 60_000;

test('a check-in that arrived while the app was closed shows as a From Stay card with an unread dot', async ({ page }) => {
  await page.goto('/app/today');
  await seed(page, [[`/__stay-inbox/${AT}`, JSON.stringify({ at: AT, body: 'Morning. One small thing is enough to start.' })]]);
  await page.reload();
  const card = page.getByTestId('checkin-inbox');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('checkin-text')).toHaveText('Morning. One small thing is enough to start.');
  await expect(card.getByTestId('checkin-dot')).toBeVisible();
  await expect(page.getByTestId('nav-unread-dot').first()).toBeAttached();
  await expect(card.getByTestId('checkin-talk')).toHaveAttribute('href', '/app/today?voice=auto');
});

test('dismissing clears the card, the dot and what was stored', async ({ page }) => {
  await page.goto('/app/today');
  await seed(page, [[`/__stay-inbox/${AT}`, JSON.stringify({ at: AT, body: 'Evening. If something is still spinning, say it out loud.' })]]);
  await page.reload();
  await page.getByTestId('checkin-dismiss').click();
  await expect(page.getByTestId('checkin-inbox')).toHaveCount(0);
  await expect(page.getByTestId('nav-unread-dot')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('stay-inbox')).keys()).length)).toBe(0);
  await page.reload();
  await expect(page.getByTestId('checkin-inbox')).toHaveCount(0);
});

test('shows the newest first and ignores anything that is not a real check-in', async ({ page }) => {
  await page.goto('/app/today');
  await seed(page, [
    [`/__stay-inbox/${AT - 5000}`, JSON.stringify({ at: AT - 5000, body: 'older one' })],
    [`/__stay-inbox/${AT}`, JSON.stringify({ at: AT, body: 'newest one' })],
    ['/__stay-inbox/junk', 'not json at all'],
    ['/__stay-inbox/empty', JSON.stringify({ at: AT + 1, body: '' })],
  ]);
  await page.reload();
  await expect(page.getByTestId('checkin-text')).toHaveText('newest one');
  await expect(page.getByTestId('checkin-inbox')).toContainText('1 earlier');
});

test('no card and no dot when nothing arrived', async ({ page }) => {
  await page.goto('/app/today');
  await expect(page.getByTestId('checkin-inbox')).toHaveCount(0);
  await expect(page.getByTestId('nav-unread-dot')).toHaveCount(0);
});

test('Talk it through clears the card first, then opens the voice on Today', async ({ page }) => {
  await page.goto('/app/settings');
  await seed(page, [[`/__stay-inbox/${AT}`, JSON.stringify({ at: AT, body: 'Morning. One small thing is enough to start.' })]]);
  await page.reload();
  await page.getByTestId('checkin-talk').click();
  await page.waitForURL('**/app/today?voice=auto');
  await expect(page.getByTestId('checkin-inbox')).toHaveCount(0);
  expect(await page.evaluate(async () => (await (await caches.open('stay-inbox')).keys()).length)).toBe(0);
});
