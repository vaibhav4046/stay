import { test, expect, type Page } from '@playwright/test';

// The hero is a book-style foldable (one inner display, two halves that meet at the spine) that plays the recorded call, in a real CSS 3D scene
// (HeroExample.tsx, FoldFrame.tsx, foldGeometry.ts, fold.css). The device floats a few degrees, so sizes are checked with a little room.

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
const tilt = (page: Page) => page.locator('.fd').evaluate((el) => Number((el as HTMLElement).style.getPropertyValue('--tilt-ry') || 0));

test.describe('Landing hero: the foldable', () => {
  test('1280 x 800: the headline, the sentence and the round mic are on the first screen, with the device beside them', async ({ page }) => {
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
    expect(device.w).toBeGreaterThanOrEqual(540); // 89% of the column: the rest is the studio plate behind it
    expect(device.w).toBeLessThanOrEqual(680);
    const a = await rect(page, '.fd-a .fd-screen');
    const b = await rect(page, '.fd-b .fd-screen');
    expect(a.h / a.w, "each half is a portrait panel").toBeGreaterThan(1.25);
    expect(a.h / a.w).toBeLessThan(1.6);
    expect(a.h, "tall enough to read").toBeGreaterThanOrEqual(340);
    expect(b.x).toBeGreaterThan(a.x + a.w * 0.8); // the second half is to the right of the first, meeting it at the spine
    expect(Math.abs(((a.w * 2) / a.h) - 3 / 2)).toBeLessThan(0.3); // one display, about 3:2 when open
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
  });

  test('phone: the foldable is stacked, spine horizontal, first half on top, the same width, and inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const a = await rect(page, '.fd-a .fd-screen');
    const b = await rect(page, '.fd-b .fd-screen');
    const device = await rect(page, '.fd');
    expect(b.y).toBeGreaterThan(a.y + a.h * 0.8);
    expect(Math.abs(a.w - b.w)).toBeLessThanOrEqual(10);
    expect(Math.abs(a.x - b.x)).toBeLessThanOrEqual(10);
    expect(device.x).toBeGreaterThanOrEqual(0);
    expect(device.right).toBeLessThanOrEqual(390);
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    // copy first, then the device, then the controls
    const copy = await rect(page, '.lp-hero-copy');
    expect(device.y).toBeGreaterThan(copy.bottom);
    await expect(page.getByTestId('hero-pause')).toBeVisible();
  });

  test('the second half takes the second half of the call and the solved step lands last on it; the text is real, in reading order', async ({ page }) => {
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

  test('choosing a scene folds the second half shut and open again, animating only transform, opacity and filter', async ({ page }) => {
    await open(page);
    const fd = page.locator('.fd');
    await expect(fd).toHaveAttribute('data-phase', 'play');
    await page.getByTestId('hero-scene-rent').click();
    await expect(fd).toHaveAttribute('data-phase', 'closing');
    const props = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => /^fd-/.test((a as CSSAnimation).animationName ?? ''))
        .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k)))
    );
    const allowed = new Set(['transform', 'opacity', 'filter', 'offset', 'easing', 'composite', 'computedOffset']);
    expect(props.length).toBeGreaterThan(0);
    expect(props.filter((p) => !allowed.has(p))).toEqual([]);
    expect(await page.locator('.fd-b').evaluate((el) => getComputedStyle(el).transformOrigin)).not.toBe('50% 50%'); // it turns about the spine
    await expect(fd).toHaveAttribute('data-phase', 'opening', { timeout: 3000 });
    await expect(fd).toHaveAttribute('data-phase', 'play', { timeout: 3000 });
    await expect(page.getByTestId('hero-scene-rent')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fd-a .bubble').first()).toBeVisible();
  });

  test('pausing stops the fold where it is; the grain overlay is off only while the device is playing', async ({ page }) => {
    await open(page);
    const grain = () => page.evaluate(() => getComputedStyle(document.body, '::after').display);
    expect(await grain()).toBe('none'); // playing on screen: the full-screen blend is off (it halves the frame rate of anything big that moves)
    await page.getByTestId('hero-scene-study').click();
    const fd = page.locator('.fd');
    await expect(fd).toHaveAttribute('data-phase', 'closing');
    await page.getByTestId('hero-pause').click();
    await expect(fd).toHaveAttribute('data-halt', 'true');
    await page.waitForTimeout(1400);
    await expect(fd).toHaveAttribute('data-phase', 'closing'); // still shut, not moved on
    expect(await grain()).not.toBe('none'); // paused: the grain is back
  });

  test('a real 3D scene: perspective on the stage, preserve-3d down the rig, an edge of strips, and the device leans toward the pointer (clamped)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    expect(await page.locator('.fd-stage').evaluate((el) => getComputedStyle(el).perspective)).not.toBe('none');
    for (const sel of ['.fd-tilt', '.fd-float', '.fd-half.fd-a', '.fd-half.fd-b']) {
      expect(await page.locator(sel).evaluate((el) => getComputedStyle(el).transformStyle), sel).toBe('preserve-3d');
    }
    expect(await page.locator('.fd-only-wide .fd-facet').count()).toBeGreaterThan(20);
    await page.mouse.move(1270, 790);
    await expect.poll(() => tilt(page)).toBeGreaterThan(1);
    expect(Math.abs(await tilt(page))).toBeLessThanOrEqual(8);
    const rx = await page.locator('.fd').evaluate((el) => Number((el as HTMLElement).style.getPropertyValue('--tilt-rx')));
    expect(Math.abs(rx)).toBeLessThanOrEqual(8);
    await page.mouse.move(2, 5);
    await expect.poll(() => tilt(page)).toBeLessThan(-1);
  });

  test('reduced motion: flat and still: no 3D parts, no float, no lean', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page);
    await page.mouse.move(1270, 790);
    await page.waitForTimeout(300);
    expect(await page.locator('.fd').evaluate((el) => (el as HTMLElement).style.getPropertyValue('--tilt-ry'))).toBe('');
    expect(await page.locator('.fd-only-wide .fd-facet').first().evaluate((el) => getComputedStyle(el).display)).toBe('none');
    expect(await page.locator('.fd-float').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });

  test.describe('the person folds it', () => {
    const fig = (page: Page) => page.getByTestId('hero-example');
    const foldVar = (page: Page) => page.locator('.fd').evaluate((el) => Number((el as HTMLElement).style.getPropertyValue('--fold') || 0));
    /** Press at `from` (a fraction of the device's width), drag `dx` px along it in 12 steps, and let go (unless `hold`). */
    const drag = async (page: Page, from: number, dx: number, hold = false) => {
      const b = (await page.locator('.fd').boundingBox())!;
      const y = b.y + b.height / 2;
      const x = b.x + b.width * from;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y, { steps: 12 });
      if (!hold) await page.mouse.up();
    };

    test('the Fold button toggles the fold and says what it will do next; Escape does nothing', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page);
      const btn = page.getByTestId('hero-fold');
      expect((await btn.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await expect(fig(page)).toHaveAttribute('data-fold', 'open');
      await expect(btn).toHaveText('Fold');
      await btn.click();
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await expect(btn).toHaveText('Unfold');
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
      expect(await foldVar(page)).toBeCloseTo(1, 2);
      await page.keyboard.press('Escape');
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await btn.click();
      await expect(fig(page)).toHaveAttribute('data-fold', 'open');
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'play', { timeout: 3000 });
      expect(await foldVar(page)).toBeCloseTo(0, 2);
    });

    test('keyboard: Enter and Space on the focused button fold and unfold', async ({ page }) => {
      await open(page);
      const btn = page.getByTestId('hero-fold');
      await btn.focus();
      await page.keyboard.press('Enter');
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await page.keyboard.press('Space');
      await expect(fig(page)).toHaveAttribute('data-fold', 'open');
    });

    test('a tap on the device toggles it, shut or open', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page);
      await page.locator('.fd').click();
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
      await page.locator('.fd').click();
      await expect(fig(page)).toHaveAttribute('data-fold', 'open');
    });

    test('dragging the second half 200 px toward the first shuts it, and dragging back opens it; the angle follows the pointer', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page);
      await drag(page, 0.8, -90, true);
      const mid = await foldVar(page);
      expect(mid).toBeGreaterThan(0.1);
      expect(mid).toBeLessThan(0.9);
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'dragging');
      expect(await page.locator('.fd-b').evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
      expect(await page.locator('.fd-a .fd-screen').evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(1); // the first half dims a little as the lid comes over it
      await page.mouse.move((await page.locator('.fd').boundingBox())!.x + 100, 400, { steps: 6 });
      expect(await foldVar(page)).toBeGreaterThan(mid);
      await page.mouse.up();
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
      expect(await foldVar(page)).toBeCloseTo(1, 2);
      expect(await page.evaluate(() => String(getSelection()))).toBe(''); // no text was selected
      expect(await page.evaluate(() => window.scrollY)).toBe(0); // and the page did not move
      await drag(page, 0.3, 200);
      await expect(fig(page)).toHaveAttribute('data-fold', 'open');
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'play', { timeout: 3000 });
      expect(await foldVar(page)).toBeCloseTo(0, 2);
    });

    test('letting go short of the half way point springs back open', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page);
      await drag(page, 0.8, -80);
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'play', { timeout: 3000 });
      await expect(fig(page)).toHaveAttribute('data-fold', 'open');
    });

    test('stacked on a phone the fold is dragged up and down (vertical drags are the device, horizontal ones scroll)', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page);
      await page.locator('.fd').scrollIntoViewIfNeeded();
      expect(await page.locator('.fd-hit').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-x');
      const b = (await page.locator('.fd').boundingBox())!;
      const x = b.x + b.width / 2;
      await page.mouse.move(x, b.y + b.height * 0.8);
      await page.mouse.down();
      await page.mouse.move(x, b.y + b.height * 0.8 - 190, { steps: 12 });
      await page.mouse.up();
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
    });

    test('the call keeps its place across a fold: the same lines are there when it opens', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page);
      const before = await page.locator('.fd-a .bubble').allTextContents();
      expect(before.length).toBeGreaterThan(0);
      await page.getByTestId('hero-fold').click();
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
      await page.waitForTimeout(1500); // it goes on under the glass
      await page.getByTestId('hero-fold').click();
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'play', { timeout: 3000 });
      const after = await page.locator('.fd-a .bubble').allTextContents();
      expect(after.length).toBeGreaterThanOrEqual(before.length);
      expect(after[0]).toContain('I have been on Instagram for two hours'); // not restarted, not another scene
      for (let i = 0; i < before.length - 1; i++) expect(after[i]).toBe(before[i]); // (the last one may still have been arriving)
      await expect(page.getByTestId('hero-scene-doomscroll')).toHaveAttribute('aria-pressed', 'true');
    });

    test('shut, the cover display shows the Stay mark and what the call is doing; the second screen is aria-hidden while shut', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page);
      await expect(page.locator('.fd-b .fd-screen')).not.toHaveAttribute('aria-hidden', 'true');
      await page.getByTestId('hero-fold').click();
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'closed', { timeout: 3000 });
      await expect(page.locator('.fd-b .fd-screen')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.locator('.fd-back .fd-cover img')).toHaveAttribute('src', /stay-mark/);
      await expect(page.locator('.fd-back .fd-cover-status')).toHaveText(/^(Listening|Speaking)$/);
      expect(await page.locator('.fd-back').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
      await expect(page.locator('.fd')).toHaveAttribute('aria-hidden', 'true'); // the picture stays out of the way; the list below has the words
    });

    test('a fold left alone opens itself after about 6 seconds', async ({ page }) => {
      test.setTimeout(30_000);
      await open(page);
      await page.getByTestId('hero-fold').click();
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await page.waitForTimeout(4000);
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await expect(fig(page)).toHaveAttribute('data-fold', 'open', { timeout: 6000 });
    });

    test('Pause freezes a fold the timeline is making, where it is', async ({ page }) => {
      await open(page);
      await page.getByTestId('hero-scene-study').click();
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'closing');
      await page.getByTestId('hero-pause').click();
      const held = await foldVar(page);
      await page.waitForTimeout(900);
      expect(await foldVar(page)).toBeCloseTo(held, 3);
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'closing');
      await page.getByTestId('hero-pause').click();
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'play', { timeout: 4000 });
    });

    test('reduced motion: the button swaps open and shut with a crossfade, no 3D swing, no drag, no auto fold', async ({ page }) => {
      test.setTimeout(30_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width: 1280, height: 800 });
      await open(page);
      const btn = page.getByTestId('hero-fold');
      await expect(btn).toBeVisible();
      await btn.click();
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'closed'); // at once: no closing in between
      expect(await foldVar(page)).toBe(0); // the angle never moves
      expect(await page.locator('.fd-b').evaluate((el) => getComputedStyle(el).transform)).toBe('none');
      await expect.poll(() => page.locator('.fd-stage').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(0);
      await expect.poll(() => page.locator('.fd-flat').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
      await expect(page.locator('.fd-flat .fd-cover-status')).toBeVisible();
      expect(await page.evaluate(() => document.getAnimations().filter((a) => /^fd-(b|front|back)/.test((a as CSSAnimation).animationName ?? '')).length)).toBe(0);
      await page.waitForTimeout(7000); // nothing opens it by itself
      await expect(fig(page)).toHaveAttribute('data-fold', 'closed');
      await btn.click();
      await expect(fig(page)).toHaveAttribute('data-fold', 'open');
      await expect.poll(() => page.locator('.fd-stage').evaluate((el) => Number(getComputedStyle(el).opacity))).toBe(1);
      const b = (await page.locator('.fd').boundingBox())!; // a drag does not turn anything
      await page.mouse.move(b.x + b.width * 0.8, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width * 0.8 - 200, b.y + b.height / 2, { steps: 8 });
      await page.mouse.up();
      expect(await foldVar(page)).toBe(0);
      await expect(page.locator('.fd')).toHaveAttribute('data-phase', 'play');
    });
  });
});
