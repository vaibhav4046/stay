import { test, expect, type Page } from '@playwright/test';

// The hero is a dual-screen foldable that plays the recorded call (HeroExample.tsx, FoldFrame.tsx, fold.css).

const open = async (page: Page) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByTestId('hero-example').waitFor();
};
const rect = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  });
const overflowX = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('Landing hero: the foldable', () => {
  test('1280 x 800: the headline, the sentence and the round mic are on the first screen, with the device beside them and straight', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    for (const sel of ['h1', '.lp-composer', '[data-testid=hero-start]']) {
      const r = await rect(page, sel);
      expect(r.bottom, sel).toBeLessThanOrEqual(800);
      expect(r.y, sel).toBeGreaterThanOrEqual(0);
    }
    await expect(page.getByText('Say what you\'re putting off.').first()).toBeVisible();
    const copy = await rect(page, '.lp-hero-copy');
    const device = await rect(page, '.fd');
    expect(device.x).toBeGreaterThanOrEqual(copy.right); // copy left, device right
    expect(device.w).toBeGreaterThanOrEqual(600);
    expect(device.w).toBeLessThanOrEqual(680);
    const a = await rect(page, '.fd-a .fd-screen');
    const b = await rect(page, '.fd-b .fd-screen');
    expect(Math.abs(a.w - 290)).toBeLessThanOrEqual(4);
    expect(Math.abs(a.h - 420)).toBeLessThanOrEqual(4);
    expect(b.x).toBeGreaterThan(a.right); // the hinge is between them
    expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1); // straight, not tilted
    expect(await page.locator('.fd-stage').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });

  test('phone: the foldable is stacked, hinge horizontal, first screen on top, the same width, and inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const a = await rect(page, '.fd-a .fd-screen');
    const b = await rect(page, '.fd-b .fd-screen');
    const device = await rect(page, '.fd');
    expect(b.y).toBeGreaterThan(a.bottom);
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(1);
    expect(device.x).toBeGreaterThanOrEqual(0);
    expect(device.right).toBeLessThanOrEqual(390);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    // copy first, then the device, then the controls
    const copy = await rect(page, '.lp-hero-copy');
    expect(device.y).toBeGreaterThan(copy.bottom);
    await expect(page.getByTestId('hero-pause')).toBeVisible();
  });

  test('the second screen takes the second half of the call and the solved step lands last on it; the text is real, in reading order', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const onA = await page.locator('.fd-a .bubble').allTextContents();
    const onB = await page.locator('.fd-b .bubble').allTextContents();
    expect(onA).toHaveLength(3);
    expect(onB).toHaveLength(3);
    expect(onA[0]).toContain('I have been on Instagram for two hours');
    expect(onB[2]).toContain('type the first paragraph');
    await expect(page.locator('.fd-b').getByTestId('hero-outcome')).toBeVisible();
    await expect(page.locator('.fd-a').getByTestId('hero-outcome')).toHaveCount(0);
    // the device is a picture: hidden from assistive tech, the same words are in the list
    await expect(page.locator('.fd')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('figure[data-testid="hero-example"] ol.sr-only li')).toHaveCount(7);
    // reduced motion: no fold, and the scene can still be chosen
    await page.getByTestId('hero-scene-rent').click();
    await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'play');
    await expect(page.locator('.fd .bubble')).toHaveCount(4);
  });

  test('choosing a scene folds the second screen shut and open again, animating only transform, opacity and filter', async ({ page }) => {
    await open(page);
    const fd = page.locator('.fd');
    await expect(fd).toHaveAttribute('data-phase', 'play');
    await page.getByTestId('hero-scene-rent').click();
    await expect(fd).toHaveAttribute('data-phase', 'closing');
    const props = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => /^fd-(b|a|content|glass|glow)/.test((a as CSSAnimation).animationName ?? ''))
        .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)))
    );
    const allowed = new Set(['transform', 'opacity', 'filter', 'offset', 'easing', 'composite', 'computedOffset']);
    expect(props.length).toBeGreaterThan(0);
    expect(props.filter((p) => !allowed.has(p))).toEqual([]);
    expect(await page.locator('.fd-b').evaluate((el) => getComputedStyle(el).transformOrigin)).not.toBe('50% 50%'); // it turns about the hinge
    await expect(fd).toHaveAttribute('data-phase', 'opening', { timeout: 3000 });
    await expect(fd).toHaveAttribute('data-phase', 'play', { timeout: 3000 });
    await expect(page.getByTestId('hero-scene-rent')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fd-a .bubble').first()).toBeVisible();
  });

  test('pausing stops the fold where it is, and the grain overlay is only off while a fold is actually running', async ({ page }) => {
    await open(page);
    await page.getByTestId('hero-scene-study').click();
    const fd = page.locator('.fd');
    await expect(fd).toHaveAttribute('data-phase', 'closing');
    await page.getByTestId('hero-pause').click();
    await expect(fd).toHaveAttribute('data-halt', 'true');
    await page.waitForTimeout(1400);
    await expect(fd).toHaveAttribute('data-phase', 'closing'); // still shut, not moved on
    expect(await page.evaluate(() => getComputedStyle(document.body, '::after').display)).not.toBe('none');
  });
});
