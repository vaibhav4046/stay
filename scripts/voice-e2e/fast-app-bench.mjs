// Real app, real fake-microphone WAV, both voice engines, same sentences: reads Stay's own reply-speed readout.
// Usage: node scripts/voice-e2e/fast-app-bench.mjs <mic.wav> [baseURL] [seconds] [engines=agent,fast]
// Needs the app running (npm run start) and keys in .env.local on the server. Prints the in-app measurement per reply.
import { chromium } from '@playwright/test';

const wav = process.argv[2];
const base = process.argv[3] || 'http://localhost:3000';
const seconds = Number(process.argv[4] || 45);
const engines = (process.argv[5] || 'agent,fast').split(',');
if (!wav) { console.error('usage: node scripts/voice-e2e/fast-app-bench.mjs <mic.wav> [baseURL] [seconds] [engines]'); process.exit(1); }

for (const engine of engines) {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wav}%noloop`, '--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  if (process.env.DEBUG) { page.on('console', (m) => m.text().startsWith('[fast]') && console.log('  ', m.text().slice(0, 160))); page.on('requestfinished', (r) => r.url().includes('/api/') && console.log('  [api]', r.method(), r.url().replace(base, ''))); page.on('websocket', (ws) => { console.log('  [ws open]', ws.url().split('?')[0]); ws.on('framereceived', (f) => { const t = String(f.payload).slice(0, 110); if (!t.includes('"Audio"')) console.log('   <-', t); }); ws.on('close', () => console.log('  [ws close]', ws.url().split('?')[0])); }); }
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  if (process.env.DEBUG) await page.addInitScript(() => { window.__stayFastDebug = true; });
  await page.goto(base + '/app/today');
  await page.evaluate((e) => { localStorage.clear(); localStorage.setItem('stay_fast_voice', e === 'fast' ? '1' : '0'); }, engine);
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await page.getByTestId('orb-button').waitFor();
  await page.getByTestId('orb-button').click();
  await page.waitForTimeout(seconds * 1000);
  const caption = await page.evaluate(() => document.querySelector('[data-testid=caption]')?.textContent || '');
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  const el = page.getByTestId('reply-speed');
  const times = (await el.getAttribute('data-times')) || '';
  const eng = await el.getAttribute('data-engine');
  const text = (await el.textContent()) || '';
  console.log(`${engine.padEnd(6)} engine=${eng || 'none'}  replies(ms from the last moment the mic heard you): [${times}]\n       ${text.slice(0, 160)}
       caption: ${JSON.stringify(caption.slice(0, 160))}${errors.length ? `\n       page errors: ${errors.join(' | ')}` : ''}`);
  await browser.close();
}
