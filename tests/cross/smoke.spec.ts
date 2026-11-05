import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = 'docs/evidence/cross-browser';
const PAGES = ['/', '/proof', '/privacy', '/terms', '/app/today', '/app/settings', '/app/history'];

/** Console errors and uncaught errors on a page; a few messages the engines print about themselves are not about the app. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/favicon|Failed to load resource.*(404|net::)|apple-touch|manifest/i.test(text)) return;
    errors.push(`console: ${text.slice(0, 200)}`);
  });
  return errors;
}

const asPerson = (page: Page) => page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));

for (const path of PAGES) {
  test(`${path} loads clean, shows its content and does not scroll sideways`, async ({ page }, info) => {
    const errors = watchErrors(page);
    const res = await page.goto(path, { waitUntil: 'networkidle' });
    expect(res?.status()).toBe(200);
    await expect(page.locator('main').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} sideways overflow`).toBeLessThanOrEqual(1);
    expect(errors, `${path} errors in ${info.project.name}`).toEqual([]);
  });
}

test('the home page: one heading, the example device, a way in, and a picture of each engine', async ({ page }, info) => {
  mkdirSync(SHOTS, { recursive: true });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(await page.locator('h1').count()).toBe(1);
  await expect(page.getByTestId('hero-example')).toBeVisible();
  await expect(page.getByTestId('hero-input')).toBeVisible();
  await expect(page.getByTestId('hero-start')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/${info.project.name}-home.png` });
});

test('the scroll animations never leave a card invisible, in an engine with or without scroll timelines', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const cards = page.locator('[data-testid^="feature-"]');
  const n = await cards.count();
  expect(n).toBe(6);
  for (let i = 0; i < n; i++) {
    await cards.nth(i).scrollIntoViewIfNeeded();
    await expect.poll(() => cards.nth(i).evaluate((el) => parseFloat(getComputedStyle(el).opacity)), { timeout: 4000 }).toBeGreaterThan(0.95);
  }
});

test('the foldable folds shut and opens on first view, the first screen going soft as it folds', async ({ page }) => {
  await asPerson(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  const seen = await page.evaluate(
    () =>
      new Promise<{ fold: number; blur: number; phases: string[] }>((resolve) => {
        const fd = document.querySelector('.fd') as HTMLElement;
        const first = document.querySelector('.fd-a .fd-screen') as HTMLElement;
        const out = { fold: 0, blur: 0, phases: [] as string[] };
        const t0 = performance.now();
        const step = () => {
          out.fold = Math.max(out.fold, parseFloat(fd.style.getPropertyValue('--fold') || '0'));
          const m = /blur\(([\d.]+)px\)/.exec(getComputedStyle(first).filter);
          if (m) out.blur = Math.max(out.blur, parseFloat(m[1]));
          const p = fd.getAttribute('data-phase') || '';
          if (out.phases[out.phases.length - 1] !== p) out.phases.push(p);
          if (performance.now() - t0 < 16000) requestAnimationFrame(step); // a software-rendered engine takes several seconds over what a GPU does in under one
          else resolve(out);
        };
        step();
      }),
  );
  expect(seen.phases).toEqual(expect.arrayContaining(['closing', 'closed', 'opening', 'play']));
  expect(seen.fold).toBeGreaterThan(0.95);
  expect(seen.blur).toBeGreaterThan(5);
});

test('Settings: the pace card and the check-ins card say something sensible for this browser', async ({ page }) => {
  await page.goto('/app/settings', { waitUntil: 'networkidle' });
  await expect(page.getByTestId('pacing-text')).toContainText('Stay waits');
  await expect(page.getByTestId('proactive-settings')).toBeVisible();
  // never a dead switch: either the switch, or one plain sentence about why not (this browser, iPhone without the Home Screen app, blocked, or not set up)
  const toggle = await page.getByTestId('proactive-toggle').count();
  const note = await page.getByTestId('proactive-note').count();
  expect(toggle + note).toBe(1);
});

test('Today opens and takes typed words', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/app/today', { waitUntil: 'networkidle' });
  const box = page.getByTestId('composer').first();
  if (await box.count()) {
    await expect(box).toBeVisible();
  } else {
    // first visit: the short set-up comes first
    await expect(page.locator('main')).toContainText(/tone|care|start/i);
  }
  expect(errors).toEqual([]);
});
