// throwaway: baseline cost of ANY big composited animation on this page in this headless Chromium
import { chromium } from '@playwright/test';

const base = 'http://localhost:3120';
const browser = await chromium.launch({ args: ['--mute-audio'] });
const measure = (page, ms) => page.evaluate((span) => new Promise((resolve) => {
  const d = [];
  let last = performance.now();
  const end = last + span;
  const tick = (n) => { d.push(n - last); last = n; if (n < end) requestAnimationFrame(tick); else { d.shift(); const s = [...d].sort((a, b) => a - b); resolve(`avg ${(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1)} p95 ${s[Math.floor(s.length * 0.95)].toFixed(1)} max ${s[s.length - 1].toFixed(1)} n${d.length}`); } };
  requestAnimationFrame(tick);
}), ms);
const variants = {
  none: '',
  smallBox: '.probe { width: 40px; height: 40px; }',
  bigBox: '.probe { width: 314px; height: 468px; }',
  bigBoxNoBlend: '.probe { width: 314px; height: 468px; } body::after { display: none !important; }',
  bigBoxNoBlendNoBefore: '.probe { width: 314px; height: 468px; } body::after, body::before { display: none !important; }',
  fullFold_noBlend: 'body::after { display: none !important; }',
};
for (const [name, css] of Object.entries(variants)) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.addStyleTag({ content: css || '/* none */' });
  let res;
  if (name === 'fullFold_noBlend') {
    const out = [];
    for (const id of ['study', 'rent', 'decide']) { await page.getByTestId(`hero-scene-${id}`).click(); out.push(await measure(page, 1500)); await page.waitForTimeout(300); }
    res = out.join(' | ');
  } else if (name === 'none') {
    res = await measure(page, 1500);
  } else {
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'probe';
      d.style.cssText = 'position:absolute;left:600px;top:120px;background:#345;z-index:5;will-change:transform;animation:probe 0.6s ease-in-out infinite alternate';
      document.body.appendChild(d);
      const st = document.createElement('style');
      st.textContent = '@keyframes probe { to { transform: translateX(30px) rotateY(-40deg); } }';
      document.head.appendChild(st);
    });
    res = await measure(page, 1500);
  }
  console.log(name.padEnd(24), res);
  await ctx.close();
}
await browser.close();
