import { test, expect } from '@playwright/test';

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const ROUTES = ['/', '/demo', '/app/today', '/app/history', '/app/settings', '/privacy'];

test.describe('Responsive layout', () => {
  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const route of ROUTES) {
        await page.goto(route, { waitUntil: 'networkidle' });
        const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(sw, `${route} at ${width}px`).toBeLessThanOrEqual(cw + 1);
      }
    });
  }

  test('hero orb stays inside its walkthrough card (no overlap with text)', async ({ page }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/', { waitUntil: 'networkidle' });
      const card = page.getByTestId('hero-interactive-walkthrough');
      await page.waitForTimeout(800);
      const cardBox = await card.boundingBox();
      const orbBox = await card.locator('canvas').first().boundingBox();
      expect(cardBox && orbBox).toBeTruthy();
      expect(orbBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
      expect(orbBox!.x + orbBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
      expect(orbBox!.y + orbBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);
      // the orb must not be taller than a small icon-sized slot
      expect(orbBox!.height).toBeLessThanOrEqual(130);
    }
  });

  test('orb canvas is square and steady 60fps-class on the demo page', async ({ page }) => {
    await page.goto('/demo', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.waitForTimeout(900);
    const box = await page.locator('canvas').first().boundingBox();
    expect(Math.abs(box!.width - box!.height)).toBeLessThanOrEqual(2);
    const p95 = await page.evaluate(() => new Promise<number>((resolve) => {
      const d: number[] = [];
      let last = performance.now();
      const end = last + 2500;
      const tick = (n: number) => {
        d.push(n - last);
        last = n;
        if (n < end) requestAnimationFrame(tick);
        else { d.sort((a, b) => a - b); resolve(d[Math.floor(d.length * 0.95)]); }
      };
      requestAnimationFrame(tick);
    }));
    expect(p95).toBeLessThan(34); // no sustained frames worse than ~30fps
  });
});
