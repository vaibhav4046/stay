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

  test('the hero example sits within the page on desktop and on a phone', async ({ page }) => {
    for (const [w, h] of [[1440, 900], [390, 844]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/', { waitUntil: 'networkidle' });
      const box = (await page.getByTestId('hero-example').boundingBox())!;
      expect(box.x, `left edge at ${w}px`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `right edge at ${w}px`).toBeLessThanOrEqual(w);
      expect(box.width).toBeGreaterThan(250);
    }
  });

  test('orb draws at a steady 60fps-class pace', async ({ page }) => {
    // the orb lives in the app (the landing page has no orb since 2 Nov 2026)
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId('care-self_managing').click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
    await page.waitForSelector('[data-testid="orb-button"] canvas');
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
