import { test, expect, type Page } from '@playwright/test';

/**
 * Dark only: no large light surface on any page. A surface counts as light when its background is mostly opaque, not the blue accent, and its
 * relative luminance is above 0.45; videos, canvases and images are ignored (the demo video is a recording).
 */
const ROUTES = ['/', '/privacy', '/terms', '/app/today', '/app/history', '/app/reports', '/app/settings', '/app/share', '/app/treatment'];

async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const care = page.getByTestId('care-self_managing');
  if (await care.isVisible({ timeout: 5000 }).catch(() => false)) {
    await care.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }
}

async function lightSurfaces(page: Page) {
  return page.evaluate(() => {
    const lum = (r: number, g: number, b: number) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (['CANVAS', 'VIDEO', 'IMG', 'SVG', 'PATH', 'CIRCLE', 'INPUT'].includes(el.tagName.toUpperCase())) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < 2500 || r.width === 0) continue;
      const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?/);
      if (!m) continue;
      const a = m[4] === undefined ? 1 : Number(m[4]);
      const saturatedBlue = +m[3] - +m[1] > 50; // the blue accent fills (primary buttons) are intentionally bright
      if (a >= 0.5 && !saturatedBlue && lum(+m[1], +m[2], +m[3]) > 0.45) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return bad.slice(0, 8);
  });
}

for (const route of ROUTES) {
  test(`dark only: ${route} has no light surface and declares a dark colour scheme`, async ({ page }) => {
    if (route.startsWith('/app')) await onboard(page);
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('dark');
    expect(await lightSurfaces(page), `light surfaces on ${route}`).toEqual([]);
  });
}