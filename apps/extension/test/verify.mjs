/* Loads the unpacked dev build into a real Chromium (Playwright persistent context) and drives it against a local Stay.
 *   node build.mjs --dev && STAY_EXT_URL=http://127.0.0.1:3100 node test/verify.mjs
 * A native right-click menu cannot be automated, so the menu handler is invoked directly; its registration is proven by
 * asking Chrome to create a duplicate item. */
import { chromium } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ext = join(here, '..', 'dist-dev');
const stay = process.env.STAY_EXT_URL || 'http://127.0.0.1:3100';
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'stay-ext-')), {
  headless: false,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--no-first-run'],
});
try {
  let [sw] = ctx.serviceWorkers();
  sw ??= await ctx.waitForEvent('serviceworker', { timeout: 20_000 });
  const id = new URL(sw.url()).hostname;
  check('extension installed, service worker running', sw.url().startsWith('chrome-extension://'), sw.url());

  const manifest = await sw.evaluate(() => chrome.runtime.getManifest());
  check('manifest v3, no remote code, host access limited to Stay (+ local in dev)', manifest.manifest_version === 3 && manifest.host_permissions.every((h) => /stay-two-swart|localhost|127\.0\.0\.1/.test(h)), JSON.stringify(manifest.host_permissions));
  check('permissions are minimal', JSON.stringify([...manifest.permissions].sort()) === JSON.stringify(['alarms', 'contextMenus', 'storage']), manifest.permissions.join(','));

  // context menu is registered
  const dup = await sw.evaluate(() => new Promise((res) => chrome.contextMenus.create({ id: 'park-thought', title: 'x', contexts: ['selection'] }, () => res(chrome.runtime.lastError?.message || 'created'))));
  check('context menu item "Park this thought" is registered', /duplicate id/i.test(dup), dup);

  // commands registered with the suggested keys
  const cmds = await sw.evaluate(() => chrome.commands.getAll());
  const voice = cmds.find((c) => c.name === 'open-voice');
  check('keyboard command open-voice is registered', !!voice, voice && (voice.shortcut || '(no shortcut bound)'));

  // 1. the context-menu handler runs and queues the thought locally
  await sw.evaluate(() => self.StayBg.onMenuClick({ menuItemId: 'park-thought', selectionText: '  remember   to email Dr Patel ' }));
  const inbox = await sw.evaluate(() => chrome.storage.local.get('inbox').then((r) => r.inbox));
  check('menu click queues the selected text (whitespace cleaned)', JSON.stringify(inbox) === JSON.stringify(['remember to email Dr Patel']), JSON.stringify(inbox));
  const badge = await sw.evaluate(() => chrome.action.getBadgeText({}));
  check('toolbar badge confirms with "+"', badge === '+', badge);

  // 2. opening Stay files it into the app's own parking lot
  const page = await ctx.newPage();
  const reqs = [];
  // requests made by the extension itself (its service worker or its own pages); the Stay page's own font loads are the web app's business
  ctx.on('request', (r) => {
    let own = !!r.serviceWorker() && r.serviceWorker().url().startsWith('chrome-extension://'); // Stay's own service worker is the web app's
    try { own = own || r.frame().url().startsWith('chrome-extension://'); } catch { /* service worker request */ }
    if (own && !r.url().startsWith('chrome-extension:') && !r.url().startsWith('data:')) reqs.push(r.url());
  });
  await page.goto(stay + '/app/today');
  await page.evaluate(() => localStorage.setItem('stay_v1_profile', JSON.stringify({ userId: 'local-user', careContext: 'waitlisted', interactionMode: 'voice_and_text', proactiveCheckins: true, onboardingCompleted: true, updatedAt: new Date().toISOString() })));
  await page.reload();
  await page.waitForSelector('[data-testid="parking-open"], [aria-label="Talk to Stay"]', { timeout: 30_000 });
  await sleep(1500);
  const parked = await page.evaluate(() => JSON.parse(localStorage.getItem('stay_parking_lot') || '[]'));
  check('content script moved the thought into stay_parking_lot', parked.length === 1 && parked[0].text === 'remember to email Dr Patel' && /^p-\d+-/.test(parked[0].id), JSON.stringify(parked));
  check('queue emptied after filing', (await sw.evaluate(() => chrome.storage.local.get('inbox').then((r) => r.inbox))).length === 0);

  // the app really shows it
  await page.getByText('More', { exact: true }).first().click();
  await page.getByTestId('parking-open').click();
  const seen = await page.getByTestId('parking-list').textContent({ timeout: 10_000 }).catch(() => '');
  check('Stay shows the parked thought in its parking lot', seen.includes('email Dr Patel'), seen.slice(0, 80));

  // 3. a thought parked while Stay is open arrives live
  await sw.evaluate(() => self.StayBg.park('book the dentist'));
  await sleep(1500);
  const live = await page.evaluate(() => JSON.parse(localStorage.getItem('stay_parking_lot') || '[]').map((i) => i.text));
  check('thought parked while Stay is open arrives live', live[0] === 'book the dentist' && live.length === 2, JSON.stringify(live));

  // 4. toolbar badge follows the app's reminders
  await page.evaluate(() => {
    localStorage.setItem('stay_reminders_v1', JSON.stringify([{ id: 'rem-1', text: 'stretch', dueAt: Date.now() + 7 * 60000 - 5000 }]));
    window.dispatchEvent(new CustomEvent('stay:host', { detail: JSON.stringify({ type: 'reminder-added', id: 'rem-1', text: 'stretch', dueAt: 0 }) }));
  });
  await sleep(2500);
  const b2 = await sw.evaluate(() => chrome.action.getBadgeText({}));
  const title = await sw.evaluate(() => chrome.action.getTitle({}));
  check('badge shows minutes to the next reminder', b2 === '7', `badge="${b2}" title="${title}"`);

  // 5. the keyboard command opens Stay with voice
  const before = ctx.pages().length;
  await sw.evaluate(() => self.StayBg.onCommand('open-voice'));
  await sleep(1500);
  const urls = ctx.pages().map((p) => p.url());
  check('open-voice command focuses Stay and requests voice', urls.some((u) => u.includes('/app/today?voice=auto')), urls.join(' | '));

  // 6. popup UI
  const pop = await ctx.newPage();
  await pop.goto(`chrome-extension://${id}/popup.html`);
  check('popup shows the next check-in', (await pop.locator('#next').textContent()).includes('Next: check in'), await pop.locator('#next').textContent());
  await pop.fill('#thought', 'water the plant');
  await pop.click('#park button[type=submit]');
  await pop.waitForFunction(() => document.getElementById('status').textContent.startsWith('Parked'), null, { timeout: 5000 });
  check('popup parks a thought', true);
  await pop.screenshot({ path: join(here, '..', '..', '..', 'docs', 'ecosystem', 'extension-popup.png') });

  // 7. local-first: nothing left the machine except to the Stay origin
  check('no network requests made by or for the extension', reqs.length === 0, reqs.join(', '));
} finally {
  await ctx.close();
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall extension checks passed');
process.exit(failed ? 1 : 0);
