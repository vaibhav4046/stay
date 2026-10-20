import { test, expect, type Page } from '@playwright/test';

const shapeOf = (page: Page) => page.locator('[data-testid="hero-orb"] [data-shape]').first().getAttribute('data-shape');

async function open(page: Page) {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="hero-orb"] canvas');
}

test.describe('Landing: hero', () => {
  test('chips reshape the same dots, and one of them becomes the face, still dots only', async ({ page }) => {
    await open(page);
    const chips = page.getByTestId('hero-chips');
    await chips.getByRole('button', { name: 'Taxes' }).click();
    await expect.poll(() => shapeOf(page), { timeout: 8000 }).toBe('coin');
    await expect(chips.getByRole('button', { name: 'Taxes' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('hero-input')).toHaveValue('my taxes');
    await chips.getByRole('button', { name: 'Overwhelmed' }).click();
    await expect.poll(() => shapeOf(page), { timeout: 8000 }).toBe('tangle');
    await page.getByTestId('hero-face').click();
    await expect.poll(() => shapeOf(page), { timeout: 8000 }).toBe('human');
    await expect(page.locator('[data-testid="hero-orb"] img, [data-testid="hero-orb"] svg, [data-testid="hero-orb"] video')).toHaveCount(0);
    // typing takes the face away again
    await page.getByTestId('hero-input').fill('my taxes');
    await expect.poll(() => shapeOf(page), { timeout: 8000 }).toBe('coin');
  });

  test('hovering a chip with a mouse previews it', async ({ page }) => {
    await open(page);
    await page.getByTestId('hero-chips').getByRole('button', { name: 'No energy' }).hover();
    await expect.poll(() => shapeOf(page), { timeout: 8000 }).toBe('battery');
  });
});

test.describe('Landing: demo player', () => {
  test('custom chrome: big play, scrubber, captions toggle, chapters that seek', async ({ page }) => {
    await open(page);
    const player = page.getByTestId('player');
    await player.scrollIntoViewIfNeeded();
    await expect(player.getByTestId('player-bigplay')).toBeVisible();
    await expect(player.getByTestId('player-scrub')).toHaveAttribute('type', 'range');
    await expect(player.getByTestId('player-toggle')).toHaveAccessibleName('Play');
    // the captions file is loaded as a real text track (9 cues), whether or not this browser can decode the video
    await expect.poll(() => page.evaluate(() => (document.querySelector('video')!.textTracks[0].cues ?? []).length)).toBe(9);

    const cap = player.getByTestId('player-captions');
    await expect(cap).toHaveAttribute('aria-pressed', 'true');
    await cap.click();
    await expect(cap).toHaveAttribute('aria-pressed', 'false');
    await cap.click();
    await expect(cap).toHaveAttribute('aria-pressed', 'true');

    const chapters = player.getByTestId('chapter');
    await expect(chapters).toHaveCount(8);
    await chapters.filter({ hasText: 'It waits' }).click();
    const t = await page.evaluate(() => document.querySelector('video')!.currentTime);
    expect(t).toBeGreaterThan(40);
    expect(t).toBeLessThan(41);
    await expect(chapters.filter({ hasText: 'It waits' })).toHaveAttribute('aria-current', 'true');
  });

  test('the player keeps one consistent frame: 16:9, never wider than the screen, same radius token as the stage', async ({ page }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const box = (await page.locator('.lp-player').boundingBox())!;
      expect(Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.02);
      expect(box.width).toBeLessThanOrEqual(width);
      const radius = await page.locator('.lp-player').evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
      expect(radius).toBe(width < 640 ? '0px' : '28px'); // edge to edge on a phone, --radius-stage otherwise
    }
  });

  test('a transcript is there for anyone who cannot watch', async ({ page }) => {
    await open(page);
    await page.locator('summary', { hasText: 'Read the transcript' }).click();
    await expect(page.locator('.lp-transcript li')).toHaveCount(9);
  });
});

test.describe('Landing: week explorer (sample data)', () => {
  test('is labelled as a sample, links to the real History, and every denominator is shown', async ({ page }) => {
    await open(page);
    const ex = page.getByTestId('week-explorer');
    await ex.scrollIntoViewIfNeeded();
    await expect(ex.getByTestId('sample-badge')).toContainText('Sample');
    await expect(ex.getByTestId('week-real-link')).toHaveAttribute('href', '/app/history');
    await expect(ex.getByTestId('explorer-denominator')).toContainText(/\d+ of \d+ logged sessions started/);
    const dens = await ex.getByTestId('strategy-denominator').allTextContents();
    expect(dens).toHaveLength(4);
    for (const d of dens) expect(d).toMatch(/\d+ of \d+ started|No sessions logged yet/);
  });

  test('range and strategy filters change the numbers; the heatmap and bars open the blocks behind them', async ({ page }) => {
    await open(page);
    const ex = page.getByTestId('week-explorer');
    await ex.scrollIntoViewIfNeeded();
    const label = () => ex.getByTestId('explorer-denominator').textContent();
    await ex.getByTestId('range-28').click();
    const all28 = await label();
    await ex.getByTestId('range-7').click();
    const all7 = await label();
    expect(all7).not.toBe(all28);
    await ex.getByTestId('range-28').click();
    await ex.getByTestId('filter-reframing').click();
    expect(await label()).not.toBe(all28);
    await expect(ex.getByTestId('filter-reframing')).toHaveAttribute('aria-pressed', 'true');
    await ex.getByTestId('filter-reframing').click();
    expect(await label()).toBe(all28);

    await ex.getByRole('gridcell').filter({ hasText: /^[1-9]/ }).first().click();
    await expect(ex.getByTestId('explorer-inspector')).toContainText(/of \d+ block/);

    // keyboard: one tab stop, arrows move between days
    const bars = ex.getByTestId('day-bar');
    await bars.nth(10).focus();
    await page.keyboard.press('ArrowRight');
    await expect(bars.nth(11)).toBeFocused();
    await expect(bars.nth(11)).toHaveAttribute('aria-pressed', 'true');
    expect(await bars.evaluateAll((els) => els.filter((e) => e.getAttribute('tabindex') === '0').length)).toBe(1);
  });

  test('says there are no streaks, and a quiet day costs nothing', async ({ page }) => {
    await open(page);
    const ex = page.getByTestId('week-explorer');
    await expect(ex).toContainText(/no counter to protect/i);
    await expect(page.getByText(/streak (broken|lost)|day streak/i)).toHaveCount(0);
  });
});

test.describe('Landing: measured results', () => {
  test('shows Stay slower, ChatGPT voice talking over a pause, and the limits without opening anything', async ({ page }) => {
    await open(page);
    const sec = page.getByTestId('measured');
    await sec.scrollIntoViewIfNeeded();
    const reply = sec.getByTestId('result-reply');
    await expect(reply).toContainText('Stay is slower here');
    await expect(reply).toContainText('1.95 s median');
    await expect(reply).toContainText('1.65 s median');
    await expect(reply).toContainText('1.44 s median');
    await expect(sec.getByTestId('result-pause')).toContainText('Started talking in 2 of 2 runs');
    await expect(sec.getByTestId('result-behind')).toContainText('18 s');
    await expect(sec.getByTestId('result-limits')).toBeVisible();
    await expect(sec.getByTestId('result-limits')).toContainText(/not a microphone test/i);
    await expect(sec.getByTestId('languages')).toContainText('pt');
    expect(await sec.locator('[data-ok="true"]').count()).toBe(23);
    expect(await sec.locator('[data-ok="false"]').count()).toBe(8);
  });

  test('the bars animate in when scrolled to, and stay still with reduced motion', async ({ page }) => {
    await open(page);
    const state = () => page.locator('[data-testid="measured"] [data-reveal]').first().getAttribute('data-reveal');
    await page.getByTestId('measured').scrollIntoViewIfNeeded();
    await expect.poll(state).toBe('in');

    const ctx = await page.context().browser()!.newContext({ reducedMotion: 'reduce' });
    const rm = await ctx.newPage();
    await rm.goto('/', { waitUntil: 'networkidle' });
    await rm.getByTestId('measured').scrollIntoViewIfNeeded();
    expect(await rm.locator('[data-reveal="armed"]').count()).toBe(0); // nothing is ever collapsed
    await ctx.close();
  });
});

test.describe('Landing: scroll story and artifacts', () => {
  test('the story follows the scroll: the step in the middle is the active one', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const story = page.getByTestId('story');
    await story.scrollIntoViewIfNeeded();
    await expect(story.locator('li[aria-current="step"]')).toContainText('You say it, badly');
    await story.locator('li[data-step="3"]').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 100));
    await expect(story.locator('li[aria-current="step"]')).toContainText(/You start, with company|You log what happened|It shrinks the task/);
    await story.locator('li[data-step="2"]').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(story.locator('li[aria-current="step"]')).toContainText('It shrinks the task');
    await expect(story.locator('.lp-stage-pane[data-on="true"]')).toContainText('Your first step');
  });

  test('brain dump: move a later item to today', async ({ page }) => {
    await open(page);
    const card = page.getByTestId('art-dump');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toContainText('Start with this');
    await card.getByRole('button', { name: 'Move to today: Call mum someday' }).click();
    await expect(card.getByRole('region', { name: 'Today' })).toContainText('Call mum someday');
    await expect(card.getByRole('region', { name: 'Later, no pressure' })).not.toContainText('Call mum someday');
  });

  test('summary preview: sections toggle, sample banner stays, numbers come from the sample records', async ({ page }) => {
    await open(page);
    const card = page.getByTestId('art-report');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toContainText(/SAMPLE DATA PREVIEW/);
    await expect(card).toContainText(/Start rate: \d+% \(\d+ of \d+ logged sessions started/);
    await card.getByLabel('Strategy table').uncheck();
    await expect(card).not.toContainText('Strategies (observational self-log)');
    await card.getByLabel('Care context').uncheck();
    await expect(card.locator('.lp-paper-h').first()).toContainText('1. Task-initiation overview'); // numbering follows what is included
  });

  test('routine and check-in cards respond', async ({ page }) => {
    await open(page);
    const r = page.getByTestId('art-routine');
    await r.scrollIntoViewIfNeeded();
    await expect(r.getByTestId('routine-step')).toContainText('Keys, phone, wallet');
    await r.getByTestId('routine-next').click();
    await expect(r.getByTestId('routine-step')).toContainText('Bag packed');
    const c = page.getByTestId('art-reminder');
    await c.getByRole('button', { name: '10 min' }).click();
    await c.getByTestId('reminder-set').click();
    await expect(c.getByTestId('reminder-set')).toHaveAttribute('aria-pressed', 'true');
    await expect(c).toContainText('in 10 min');
  });

  test('the sixteen voices filter to the five native accents', async ({ page }) => {
    await open(page);
    const p = page.getByTestId('personas');
    await p.scrollIntoViewIfNeeded();
    await expect(p.getByTestId('persona')).toHaveCount(16);
    await p.getByRole('button', { name: /Native accent/ }).click();
    await expect(p.getByTestId('persona')).toHaveCount(5);
    await expect(p).toContainText('Native Italian voice');
  });
});

test.describe('Landing: platforms and honesty', () => {
  test('says plainly what exists: web and installable now, desktop and mobile apps not', async ({ page }) => {
    await open(page);
    const pl = page.getByTestId('platforms');
    await expect(pl.getByTestId('platform-web')).toContainText('Available now');
    await expect(pl.getByTestId('platform-pwa')).toContainText('Installable now');
    await expect(pl.getByTestId('platform-desktop')).toContainText('Not available yet');
    await expect(pl.getByTestId('platform-mobile')).toContainText('Not available yet');
    expect(await pl.locator('a[href*="download"], a[href$=".exe"], a[href$=".dmg"], a[href$=".apk"], a[href*="apps.apple.com"], a[href*="play.google.com"]').count()).toBe(0);
  });

  test('the manifest and offline shell behind "installable" exist', async ({ request }) => {
    const m = await request.get('/manifest.webmanifest');
    expect(m.ok()).toBe(true);
    const json = await m.json();
    expect(json.display).toBe('standalone');
    expect(json.icons.length).toBeGreaterThanOrEqual(2);
    expect((await request.get('/sw.js')).ok()).toBe(true);
  });

  test('no invented social proof anywhere on the page', async ({ page }) => {
    await open(page);
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const banned of [/testimonial/, /trusted by/, /users love/, /rated/, /\d+ stars/, /join thousands/, /faster than chatgpt/, /beats chatgpt/, /better than google/]) expect(text, String(banned)).not.toMatch(banned);
  });
});

test.describe('Landing: accessibility and policy', () => {
  test('headings never skip a level, every section label points at a heading, one h1, every control has a name', async ({ page }) => {
    await open(page);
    const out = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map((h) => Number(h.tagName[1]));
      const skips = hs.filter((l, i) => i > 0 && l - hs[i - 1] > 1);
      const dangling = [...document.querySelectorAll('[aria-labelledby]')].filter((el) => !document.getElementById(el.getAttribute('aria-labelledby')!)).length;
      const unnamed = [...document.querySelectorAll('button, a[href], input, summary')].filter((el) => {
        const e = el as HTMLElement;
        const labelled = e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || (e.textContent || '').trim() || (e as HTMLInputElement).labels?.length || e.getAttribute('title');
        return !labelled;
      }).length;
      return { h1: hs.filter((l) => l === 1).length, skips: skips.length, dangling, unnamed };
    });
    expect(out).toEqual({ h1: 1, skips: 0, dangling: 0, unnamed: 0 });
  });

  test('no CSP violations and no console errors while scrolling the whole page', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
    });
    await open(page);
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 700) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(60);
    }
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
    // the demo video cannot be decoded by Playwright's Chromium (no H.264); that one error is about the browser, not the page
    expect(errors.filter((e) => !/media|video|codec|mp4|DEMUXER|NotSupported/i.test(e))).toEqual([]);
  });

  test('the keyboard can reach and operate the hero chips, the player and the week explorer', async ({ page }) => {
    await open(page);
    await page.getByTestId('hero-input').focus();
    await page.keyboard.press('Tab'); // the submit link
    await page.keyboard.press('Tab'); // first chip
    await expect(page.getByTestId('hero-chips').getByRole('button').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => shapeOf(page), { timeout: 8000 }).toBe('coin');
    await page.getByTestId('player-bigplay').focus();
    await expect(page.getByTestId('player-bigplay')).toBeFocused();
  });

  test('reduced motion: no looping animation runs on the landing page', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto('/', { waitUntil: 'networkidle' });
    const running = await page.evaluate(() =>
      document.getAnimations().filter((a) => {
        const t = a.effect?.getComputedTiming();
        return t && (t.iterations === Infinity || (t.activeDuration as number) > 100) && a.playState === 'running';
      }).length,
    );
    expect(running).toBe(0);
    await ctx.close();
  });
});

test.describe('Landing: layout and speed', () => {
  test('no horizontal overflow at 320 and 1920 with every disclosure open', async ({ page }) => {
    for (const width of [320, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      await open(page);
      await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      expect(sw, `width ${width}`).toBeLessThanOrEqual(cw + 1);
    }
  });

  test('largest paint is text and fast, and nothing shifts, on a throttled phone profile (median of 3 loads)', async ({ browser }) => {
    // This laptop is shared with other builds, so a single load can be slowed by something else; the median of three is the figure.
    const runs: Array<{ lcp: number; tag: string; cls: number }> = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await page.addInitScript(() => {
        const w = window as unknown as { __lcp: number; __lcpTag: string; __cls: number };
        w.__lcp = 0;
        w.__lcpTag = '';
        w.__cls = 0;
        new PerformanceObserver((l) => {
          const e = l.getEntries().at(-1) as PerformanceEntry & { element?: Element };
          w.__lcp = e.startTime;
          w.__lcpTag = e.element?.tagName ?? '';
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) if (!e.hadRecentInput) w.__cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto('/', { waitUntil: 'load' });
      await page.waitForTimeout(4500);
      runs.push(
        await page.evaluate(() => {
          const w = window as unknown as { __lcp: number; __lcpTag: string; __cls: number };
          return { lcp: w.__lcp, tag: w.__lcpTag, cls: w.__cls };
        }),
      );
      await ctx.close();
    }
    console.log('LCP/CLS runs (390px, 4x CPU, slow 4G-ish):', JSON.stringify(runs));
    const median = [...runs].sort((a, b) => a.lcp - b.lcp)[1];
    expect(['P', 'H1', 'INPUT', 'SPAN']).toContain(median.tag);
    expect(median.lcp).toBeLessThan(2500);
    for (const r of runs) expect(r.cls).toBeLessThan(0.1);
  });
});
