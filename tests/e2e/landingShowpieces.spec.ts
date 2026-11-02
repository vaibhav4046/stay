import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { LIVE } from '../../src/components/landing/liveRun';

const open = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByTestId('pipeline')).toBeAttached();
};

test.describe('Landing showpieces: motion loop, feature cards, benchmark board', () => {
  test('the page has the five-stage loop, six feature cards and the benchmark board, as faceted glass', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('pipeline').locator('li')).toHaveCount(5);
    await expect(page.getByTestId('features').locator('li[data-testid^="feature-"]')).toHaveCount(6);
    for (const id of ['bench-waterfall', 'bench-words', 'bench-languages', 'bench-speed', 'bench-audio']) {
      await expect(page.getByTestId(id), id).toBeAttached();
    }
    const card = page.getByTestId('feature-pauses');
    const css = await card.evaluate((el) => {
      const s = getComputedStyle(el);
      return { clip: s.clipPath, blur: s.backdropFilter || (s as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter };
    });
    expect(css.clip).toContain('polygon');
    expect(css.blur).toContain('blur');
  });

  test('every number on the board is read from the evidence files, and the waterfall adds up', async ({ page }) => {
    await open(page);
    const wf = page.getByTestId('bench-waterfall');
    await wf.scrollIntoViewIfNeeded();
    const run = JSON.parse(readFileSync(LIVE.file, 'utf8'));
    expect(run.status).toBe('PASS');
    expect(LIVE.firstSound).not.toBeNull();
    await expect(wf).toContainText(`${LIVE.firstSound} ms`);
    await expect(wf).toContainText(LIVE.file);
    const rows = await wf.locator('.wf-ms').allTextContents();
    expect(rows).toHaveLength(4);
    expect(rows[0]).toBe('0 ms');
    expect(rows.map((r) => parseInt(r, 10))).toEqual([...rows.map((r) => parseInt(r, 10))].sort((a, b) => a - b)); // time only moves forward
    expect(parseInt(rows[3], 10)).toBe(LIVE.firstSound);

    const measure = JSON.parse(readFileSync('docs/evidence/real-provider/measure-0f93339.json', 'utf8'));
    await expect(page.getByTestId('bench-speed')).toContainText(`${(measure.firstPartialMs.p50 / 1000).toFixed(2)} s`);
    await expect(page.getByTestId('bench-speed')).toContainText(`${(measure.ttsFirstAudioMs.p50 / 1000).toFixed(2)} s`);
    await expect(page.getByTestId('bench-audio')).toContainText(String(LIVE.underflows));
  });

  test('it moves when motion is welcome and is completely still with reduced motion', async ({ browser }) => {
    const looping = (page: Page) =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => {
            const t = a.effect?.getTiming();
            const el = (a.effect as KeyframeEffect | null)?.target as Element | null;
            return t?.iterations === Infinity && el?.closest('#how-it-works, #features');
          }).length,
      );
    const moving = await browser.newContext();
    const a = await moving.newPage();
    await open(a);
    await a.locator('#how-it-works').scrollIntoViewIfNeeded(); // sections far down are not rendered (content-visibility) until they are near
    await a.locator('#features').scrollIntoViewIfNeeded();
    expect(await looping(a)).toBeGreaterThan(10);
    await moving.close();

    const still = await browser.newContext({ reducedMotion: 'reduce' });
    const b = await still.newPage();
    await open(b);
    await b.locator('#how-it-works').scrollIntoViewIfNeeded();
    await b.locator('#features').scrollIntoViewIfNeeded();
    expect(await looping(b)).toBe(0);
    await still.close();
  });

  for (const width of [320, 390, 1440]) {
    test(`no sideways scroll at ${width}px and the cards stay inside the screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      for (const id of ['pipeline', 'features', 'benchmarks']) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box, id).not.toBeNull();
        expect(box!.x + box!.width, id).toBeLessThanOrEqual(width + 1);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflow).toBe(false);
    });
  }

  test('the headings stay in order: one h1, section titles are h2, cards are h3', async ({ page }) => {
    await open(page);
    expect(await page.locator('h1').count()).toBe(1);
    const bad = await page.evaluate(() => {
      const levels = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]));
      return levels.some((l, i) => i > 0 && l - levels[i - 1] > 1);
    });
    expect(bad).toBe(false);
  });
});
