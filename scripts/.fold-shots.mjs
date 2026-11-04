// throwaway: hero screenshots at four widths + fit check (no sound)
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const OUT = 'C:/Users/lalwa/AppData/Local/Temp/claude/D--/697552a1-f809-44de-a453-57c714bd21a7/scratchpad/fold';
fs.mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:3120';
const browser = await chromium.launch({ args: ['--mute-audio'] });
for (const [w, h] of [[1440, 900], [1280, 800], [768, 1024], [390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: path.join(OUT, `hero-${w}x${h}.png`) });
  const info = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const r = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    const fd = q('.fd');
    return {
      fd: r(fd),
      h1: r(q('h1')),
      composer: r(q('.lp-composer')),
      fig: r(q('[data-testid=hero-example]')),
      scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      u: getComputedStyle(q('.fd-bubble') || fd).fontSize,
      screens: [...document.querySelectorAll('.fd-screen')].map((s) => ({ sh: s.scrollHeight, ch: s.clientHeight, thread: (() => { const t = s.querySelector('.fd-thread'); return [t.scrollHeight, t.clientHeight]; })() })),
    };
  });
  console.log(w, h, JSON.stringify(info), errs.length ? 'ERR ' + errs.join(' | ') : '');
  await ctx.close();
}
await browser.close();
