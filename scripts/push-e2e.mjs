/**
 * Real end-to-end check of Stay's check-ins, no mocks: a real Chrome subscribes through the real push service (FCM), the local
 * server stores the subscription in the real private Blob store and sends the welcome message, the service worker shows it.
 * Then the tick endpoint is called with the secret and the stored record is read back, and finally the switch is turned off.
 * Run with the app on STAY_URL (default http://localhost:3121) and the same .env.local the app uses. Always muted.
 */
import { chromium } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { get, list } from '@vercel/blob';

const URL_BASE = process.env.STAY_URL || 'http://localhost:3121';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);
process.env.BLOB_READ_WRITE_TOKEN = env.BLOB_READ_WRITE_TOKEN;

const step = (ok, text) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  if (!ok) process.exitCode = 1;
};

const count = async () => (await list({ prefix: 'push/' })).blobs.length;

// Chrome refuses Web Push in incognito, which is what a plain Playwright context is: use a real profile folder.
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'stay-push-')), { channel: 'chrome', headless: true, args: ['--mute-audio'], permissions: ['notifications'], baseURL: URL_BASE });
const page = await context.newPage();
const before = await count();
await page.goto('/app/settings');
const toggle = page.getByTestId('proactive-toggle');
await toggle.waitFor({ timeout: 20_000 });
step(true, 'settings shows the check-ins switch (server reports push configured)');

await page.evaluate(() => navigator.serviceWorker.ready);
await toggle.click();
await page.waitForFunction(() => document.querySelector('[data-testid=proactive-toggle]')?.checked === true && !document.querySelector('[data-testid=proactive-toggle]')?.disabled, null, { timeout: 30_000 }).catch(() => undefined);
const failedBanner = await page.getByRole('alert').filter({ hasText: 'Could not turn it on' }).count();
step(failedBanner === 0, 'turning it on did not show an error');

const sub = await page.evaluate(async () => {
  const s = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
  return s ? s.endpoint.split('/').slice(0, 3).join('/') : null;
});
step(Boolean(sub), `browser holds a real push subscription (${sub})`);
step((await count()) === before + 1, 'server stored exactly one new record in the Blob store');

// the welcome message must arrive at the service worker and be shown
let shown = [];
for (let i = 0; i < 40 && shown.length === 0; i++) {
  await page.waitForTimeout(500);
  shown = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag })));
}
step(shown.length === 1 && shown[0].title === 'Stay' && /^Stay is on/.test(shown[0].body), `service worker showed the welcome notification: ${JSON.stringify(shown[0] ?? null)}`);

// what the server holds
const blobs = (await list({ prefix: 'push/' })).blobs;
const rec = JSON.parse(await new Response((await get(blobs[blobs.length - 1].pathname, { access: 'private', useCache: false })).stream).text());
step(JSON.stringify(Object.keys(rec).sort()) === '["created","sent","sub","tz"]', `record holds only ${Object.keys(rec).join(', ')}`);

// the scheduler: right now is probably outside the windows or already marked sent, so nothing is sent and nothing breaks
const t = await fetch(`${URL_BASE}/api/push/tick`, { method: 'POST', headers: { authorization: `Bearer ${env.PUSH_TICK_SECRET}` } });
const tally = await t.json();
step(t.status === 200 && tally.failed === 0 && tally.subscribers >= 1, `tick answered ${t.status}: ${JSON.stringify(tally)}`);
const denied = await fetch(`${URL_BASE}/api/push/tick`, { method: 'POST', headers: { authorization: 'Bearer nope' } });
step(denied.status === 401, `tick refuses a wrong secret (${denied.status})`);

// a real scheduled send: move this subscriber into a zone where it is morning or evening right now, forget what was sent, and tick
const inWindow = (tz) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  const m = Number(p.hour) * 60 + Number(p.minute);
  return (m >= 540 && m < 660) || (m >= 1110 && m < 1230);
};
const zone = ['Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles', 'America/Denver', 'America/Chicago', 'America/New_York', 'America/Halifax', 'America/Sao_Paulo', 'Atlantic/Azores', 'UTC', 'Europe/Paris', 'Europe/Athens', 'Europe/Moscow', 'Asia/Dubai', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Brisbane', 'Pacific/Noumea', 'Pacific/Auckland'].find(inWindow);
step(Boolean(zone), `found a zone where it is inside a send window right now: ${zone}`);
const { put } = await import('@vercel/blob');
const path = blobs[blobs.length - 1].pathname;
await put(path, JSON.stringify({ ...rec, tz: zone, sent: { day: '2000-01-01', slots: [] } }), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
const due = await (await fetch(`${URL_BASE}/api/push/tick`, { method: 'POST', headers: { authorization: `Bearer ${env.PUSH_TICK_SECRET}` } })).json();
step(due.sent === 1 && due.failed === 0, `tick sent the due message: ${JSON.stringify(due)}`);
let nudge = null;
for (let i = 0; i < 40 && !nudge; i++) {
  await page.waitForTimeout(500);
  const all = await page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => n.body));
  nudge = all.find((b) => !/^Stay is on/.test(b)) ?? null;
}
step(Boolean(nudge), `the check-in arrived in the browser: "${nudge}"`);
const again = await (await fetch(`${URL_BASE}/api/push/tick`, { method: 'POST', headers: { authorization: `Bearer ${env.PUSH_TICK_SECRET}` } })).json();
step(again.sent === 0, `a second tick in the same window sends nothing: ${JSON.stringify(again)}`);

// switch off: the address leaves the server and the browser
await toggle.click();
await page.waitForFunction(() => document.querySelector('[data-testid=proactive-toggle]')?.checked === false, null, { timeout: 15_000 }).catch(() => undefined);
await page.waitForTimeout(1500);
const gone = await page.evaluate(async () => !(await (await navigator.serviceWorker.ready).pushManager.getSubscription()));
step(gone, 'browser subscription removed');
step((await count()) === before, 'server record removed (store back to its starting size)');

await context.close();
