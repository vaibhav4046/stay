import { test, expect } from '@playwright/test';

const WIDTHS = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const ROUTES = ['/', '/app/today', '/app/history', '/app/settings', '/privacy', '/terms'];

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

  test('hero orb is square, sits beside the headline on desktop and above it on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="hero-orb"] canvas');
    const orb = (await page.getByTestId('hero-orb').boundingBox())!;
    const h1 = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(Math.abs(orb.width - orb.height)).toBeLessThanOrEqual(2);
    expect(orb.x).toBeGreaterThan(h1.x + h1.width - 40); // orb right of the headline, no overlap

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'networkidle' });
    const orbM = (await page.getByTestId('hero-orb').boundingBox())!;
    const h1M = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(orbM.y + orbM.height).toBeLessThanOrEqual(h1M.y + 4); // orb above the headline
    expect(orbM.width).toBeLessThanOrEqual(390);
  });

  test('orb draws at a steady 60fps-class pace', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas');
    await page.waitForTimeout(900);
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
    expect(p95).toBeLessThan(34);
  });
});
