import { expect, test, type Page } from '@playwright/test';

/** Automated browsers skip the intro (so the other fold tests stay deterministic); these tests pretend to be a person's browser. */
const asPerson = (page: Page) => page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));

/** Watches the device for a few seconds: the most the first screen was blurred, the phases it went through, and where the fold got to. */
const watch = (page: Page, ms: number) =>
  page.evaluate(
    (span) =>
      new Promise<{ blur: number; fold: number; phases: string[]; opacity: number }>((resolve) => {
        const fd = document.querySelector('.fd') as HTMLElement;
        const first = document.querySelector('.fd-a .fd-screen') as HTMLElement;
        const t0 = performance.now();
        const out = { blur: 0, fold: 0, phases: [] as string[], opacity: 1 };
        const step = () => {
          const m = /blur\(([\d.]+)px\)/.exec(getComputedStyle(first).filter);
          if (m) out.blur = Math.max(out.blur, parseFloat(m[1]));
          out.fold = Math.max(out.fold, parseFloat(fd.style.getPropertyValue('--fold') || '0'));
          out.opacity = Math.min(out.opacity, parseFloat(getComputedStyle(first).opacity));
          const phase = fd.getAttribute('data-phase') || '';
          if (out.phases[out.phases.length - 1] !== phase) out.phases.push(phase);
          if (performance.now() - t0 < span) requestAnimationFrame(step);
          else resolve(out);
        };
        step();
      }),
    ms,
  );

test('on the first view the device folds shut and opens once, the first screen going soft as it folds and sharp as it opens', async ({ page }) => {
  await asPerson(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  const seen = await watch(page, 5000);
  expect(seen.phases).toEqual(expect.arrayContaining(['closing', 'closed', 'opening', 'play']));
  expect(seen.fold).toBeGreaterThan(0.95); // it really did shut
  expect(seen.blur).toBeGreaterThan(5); // the first screen went soft while the second came over it
  expect(seen.opacity).toBeLessThan(0.8); // and translucent
  // opened again: sharp, solid
  await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'play');
  expect(await page.locator('.fd-a .fd-screen').evaluate((el) => getComputedStyle(el).filter)).toBe('none');
  expect(await page.locator('.fd-a .fd-screen').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
});

test('the intro plays only once, however long the person stays', async ({ page }) => {
  await asPerson(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500); // the intro is over
  const later = await watch(page, 8000); // the call goes on; nothing folds it again this soon
  expect(later.phases.filter((p) => p === 'closing')).toHaveLength(0);
});

test('with reduced motion the device does not fold by itself and nothing is blurred', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await asPerson(page);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  expect(await page.locator('.fd-a .fd-screen').evaluate((el) => getComputedStyle(el).filter)).toBe('none');
  await expect(page.locator('.fd')).not.toHaveAttribute('data-phase', 'closing');
  await ctx.close();
});

test('an automated browser does not get the intro (so the rest of the suite stays deterministic)', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const seen = await watch(page, 2500);
  expect(seen.phases).toEqual(['play']);
});
