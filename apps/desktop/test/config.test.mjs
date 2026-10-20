import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cfg = require('../src/config.js');
const { createNotifier } = require('../src/notifier.js');

const O = cfg.PROD_ORIGIN;

test('target: production by default, local with --local, STAY_URL only for https or loopback', () => {
  assert.equal(cfg.resolveTarget([], {}).origin, O);
  assert.equal(cfg.resolveTarget(['--local'], {}).origin, cfg.LOCAL_ORIGIN);
  assert.equal(cfg.resolveTarget([], { STAY_URL: 'http://127.0.0.1:4010' }).origin, 'http://127.0.0.1:4010');
  assert.equal(cfg.resolveTarget([], { STAY_URL: 'http://evil.example' }).origin, O);
  assert.equal(cfg.resolveTarget([], { STAY_URL: 'javascript:alert(1)' }).origin, O);
});

test('navigation: only the Stay origin', () => {
  assert.ok(cfg.isAppUrl(O + '/app/today', O));
  assert.ok(!cfg.isAppUrl('https://stay-two-swart.vercel.app.evil.com/', O));
  assert.ok(!cfg.isAppUrl('https://example.com/', O));
  assert.ok(!cfg.isAppUrl('not a url', O));
});

test('requests: Stay + AssemblyAI + Groq + Supabase + fonts, nothing else', () => {
  for (const u of [O + '/api/x', 'wss://streaming.assemblyai.com/v3/ws', 'wss://agents.assemblyai.com/v1', 'https://api.groq.com/openai/v1', 'https://abc.supabase.co/rest', 'https://fonts.gstatic.com/s/x.woff2', 'data:image/png;base64,AA', 'blob:https://stay-two-swart.vercel.app/1']) {
    assert.ok(cfg.isAllowedRequest(u, O), u);
  }
  for (const u of ['https://example.com/', 'http://streaming.assemblyai.com/', 'file:///C:/secret', 'https://assemblyai.com.evil.io/', 'ftp://x']) {
    assert.ok(!cfg.isAllowedRequest(u, O), u);
  }
});

test('permissions: audio and notifications for the Stay origin only', () => {
  assert.ok(cfg.isPermissionGranted('media', O + '/app/today', O, { mediaTypes: ['audio'] }));
  assert.ok(!cfg.isPermissionGranted('media', O + '/app/today', O, { mediaTypes: ['audio', 'video'] }));
  assert.ok(!cfg.isPermissionGranted('media', O + '/', O, { mediaTypes: ['video'] }));
  assert.ok(cfg.isPermissionGranted('notifications', O + '/', O));
  assert.ok(!cfg.isPermissionGranted('media', 'https://example.com/', O, { mediaTypes: ['audio'] }));
  for (const p of ['geolocation', 'display-capture', 'midi', 'clipboard-read', 'openExternal', 'hid']) assert.ok(!cfg.isPermissionGranted(p, O + '/', O));
});

test('external links: https, mailto, tel only', () => {
  assert.ok(cfg.isSafeExternal('https://chadd.org'));
  assert.ok(cfg.isSafeExternal('tel:116123'));
  assert.ok(!cfg.isSafeExternal('javascript:alert(1)'));
  assert.ok(!cfg.isSafeExternal('file:///C:/Windows/System32/calc.exe'));
  assert.ok(!cfg.isSafeExternal('http://insecure.example'));
});

test('default hotkey avoids Murmur (Ctrl+Shift+Space)', () => {
  assert.notEqual(cfg.DEFAULT_HOTKEY, 'Control+Shift+Space');
  assert.ok(!cfg.HOTKEY_PRESETS.includes('Control+Shift+Space'));
});

test('settings: sanitised over defaults', () => {
  const s = cfg.sanitizeSettings({ hotkey: 'Alt+Shift+S', launchAtLogin: 'yes', closeToTray: false, bounds: { x: 1, y: 2, width: 10, height: 10 } });
  assert.equal(s.hotkey, 'Alt+Shift+S');
  assert.equal(s.launchAtLogin, false); // wrong type ignored
  assert.equal(s.closeToTray, false);
  assert.equal(s.bounds, null); // too small to be a real window
  assert.equal(cfg.sanitizeSettings({ hotkey: '' }).hotkey, ''); // empty = shortcut off
  assert.deepEqual(cfg.sanitizeSettings(null), cfg.DEFAULT_SETTINGS);
});

test('window bounds must still be on a connected display', () => {
  const d = [{ x: 0, y: 0, width: 1920, height: 1040 }];
  assert.ok(cfg.boundsVisible({ x: 100, y: 100, width: 480, height: 820 }, d));
  assert.ok(!cfg.boundsVisible({ x: 5000, y: 100, width: 480, height: 820 }, d)); // monitor unplugged
  assert.ok(!cfg.boundsVisible(null, d));
});

test('notifier: schedules, dedupes the page-side due event, cancels on removal', () => {
  let t = 1000;
  const shown = [];
  const timers = new Map();
  let id = 0;
  const n = createNotifier({
    show: (title, body) => shown.push(body),
    setTimer: (fn, ms) => (timers.set(++id, { fn, at: t + ms }), id),
    clearTimer: (h) => timers.delete(h),
    now: () => t,
  });
  const run = (to) => { t = to; for (const [h, x] of [...timers]) if (x.at <= t) (timers.delete(h), x.fn()); };

  n.handle({ type: 'reminder-added', id: 'a', text: 'stretch', dueAt: 5000 });
  n.handle({ type: 'reminder-added', id: 'b', text: 'water', dueAt: 6000 });
  n.handle({ type: 'reminder-removed', id: 'b' });
  run(5000);
  assert.deepEqual(shown, ['stretch']);
  n.handle({ type: 'reminder-due', id: 'a', text: 'stretch' }); // the page says it too: no second notification
  assert.deepEqual(shown, ['stretch']);

  n.handle({ type: 'reminder-due', id: 'late', text: 'was due while closed' }); // never scheduled (app restarted)
  assert.equal(shown.at(-1), 'was due while closed');

  n.handle({ type: 'timer-started', minutes: 10, endsAt: 9000 });
  n.handle({ type: 'timer-stopped' });
  run(9000);
  assert.equal(shown.length, 2); // stopped timer never fires
  n.handle({ type: 'timer-started', minutes: 10, endsAt: 12000 });
  run(12000);
  n.handle({ type: 'timer-ended' });
  assert.equal(shown.filter((s) => s.startsWith('Your block')).length, 1);

  for (const junk of [null, 5, { type: 'nope' }, { type: 'reminder-added', id: 1, dueAt: 'x' }, { type: 'timer-started', endsAt: 'soon' }]) n.handle(junk);
  assert.equal(n.pendingCount(), 0);
});
