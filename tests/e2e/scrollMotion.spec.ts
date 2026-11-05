import { test, expect, type Page } from '@playwright/test';

/**
 * Landing scroll motion (scroll.css, SmoothScroll.tsx): native scroll-driven animations, so what matters is that they track the scroll, switch off
 * for reduced motion, never hide a word, and never push the page sideways. (Lenis is off in automated browsers on purpose: scripted scrolling is exact.)
 */
const supportsTimelines = (page: Page) => page.evaluate(() => CSS.supports('animation-timeline: scroll()') && CSS.supports('animation-timeline: view()'));
const progressScale = (page: Page) => page.locator('.lp-progress').evaluate((el) => parseFloat(getComputedStyle(el).scale.split(' ')[0] || '1'));

test.describe('Landing: scroll motion', () => {
  test('the coral progress line grows with the page: about 0 at the top, about 1 at the bottom', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    test.skip(!(await supportsTimelines(page)), 'this browser has no scroll-driven animations (the line is hidden there)');
    await expect(page.locator('.lp-progress')).toHaveCSS('display', 'block'); // (at 0 it has no width, so "visible" would say no)
    expect(await progressScale(page)).toBeLessThan(0.02);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
    await expect.poll(() => progressScale(page)).toBeGreaterThan(0.35);
    expect(await progressScale(page)).toBeLessThan(0.65);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => progressScale(page)).toBeGreaterThan(0.97);
    const box = await page.locator('.lp-progress').boundingBox();
    expect(box!.height).toBeLessThanOrEqual(2.01); // a line, not a bar
  });

  test('reduced motion: nothing is driven by the scroll, the line is gone, and every card and word is plainly visible', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'networkidle' });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 1200) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(20);
    }
    const state = await page.evaluate(() => {
      const anims = document.getAnimations();
      // the layout's own scroll-progress line (glass.css, 'stay-progress') has always run, reduced motion or not, and is hidden on the landing: count the landing's own scroll-linked animations
      const linked = anims.filter((a) => a.timeline && !(a.timeline instanceof DocumentTimeline) && !/^stay-progress$/.test((a as CSSAnimation).animationName ?? '')).length;
      const running = anims.filter((a) => a.playState === 'running' && ((a.effect?.getComputedTiming().activeDuration as number) > 100 || a.effect?.getComputedTiming().iterations === Infinity)).length;
      const progress = getComputedStyle(document.querySelector('.lp-progress')!).display;
      const faded = [...document.querySelectorAll('.pipe-node, .bento-card, .bench-card, .lp-w, .lp-cta')].filter((el) => Number(getComputedStyle(el).opacity) < 1).length;
      return { linked, running, progress, faded };
    });
    expect(state).toEqual({ linked: 0, running: 0, progress: 'none', faded: 0 });
    await ctx.close();
  });

  test('every heading is readable text in the accessibility tree (the split words are one name)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    const domHeadings = await page.evaluate(() => [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) => (h.textContent ?? '').replace(/\s+/g, ' ').trim()));
    expect(domHeadings.length).toBeGreaterThan(10);
    expect(domHeadings.every((t) => t.length > 0)).toBe(true);
    await expect(page.getByRole('heading', { name: 'A paper due at nine. A thumb stuck on the feed.' })).toHaveCount(1);
    for (const name of domHeadings) await expect(page.getByRole('heading', { name, exact: true }).first(), name).toBeAttached();
    // the words are real, selectable text in one heading, not images or pseudo-content
    expect(await page.locator('#watch-title').innerText()).toBe('A paper due at nine. A thumb stuck on the feed.');
  });

  test('nothing is wider than the phone while scrolling the whole page at 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    let worst = 0;
    for (let y = 0; y <= h; y += 600) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(25);
      worst = Math.max(worst, await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    }
    expect(worst).toBeLessThanOrEqual(0);
  });
});
