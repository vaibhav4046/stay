/* End-to-end smoke test of the real Electron app, driven through Playwright's Electron support.
 *   STAY_URL=http://127.0.0.1:3100 node test/smoke.mjs        (a local `next start`)
 *   node test/smoke.mjs                                       (the production site)
 * Exits non-zero on the first failed check. Writes a screenshot of the live window to ../../docs/ecosystem/. */
import { _electron as electron } from '@playwright/test';
import { mkdtempSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..');
const shotDir = join(appDir, '..', '..', 'docs', 'ecosystem');
// STAY_EXE points at a packaged build (dist/win-unpacked/Stay.exe); otherwise the app runs from source under node_modules/electron
const packaged = process.env.STAY_EXE || '';
const electronBin = packaged || createRequire(import.meta.url)('electron');
const launchArgs = packaged ? [] : [appDir];
const target = process.env.STAY_URL || 'https://stay-two-swart.vercel.app';
const userData = mkdtempSync(join(tmpdir(), 'stay-desktop-'));
const env = { ...process.env, STAY_TEST: '1', STAY_USER_DATA: userData, STAY_URL: target };
delete env.ELECTRON_RUN_AS_NODE;

let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const launch = (extraEnv = {}) => electron.launch({ ...(packaged ? { executablePath: packaged } : {}), args: launchArgs, env: { ...env, ...extraEnv }, timeout: 60_000 });

mkdirSync(shotDir, { recursive: true });
console.log(`target ${target}\nuserData ${userData}\n`);

// ---------- run 1: the real app against the target ----------
const app = await launch();
const page = await app.firstWindow();
await page.waitForURL(/\/app\/today/, { timeout: 45_000 });
await page.waitForLoadState('networkidle').catch(() => undefined);
check('loads the Stay app', new URL(page.url()).pathname === '/app/today', page.url());
check('window title', (await page.title()).toLowerCase().includes('stay'), await page.title());

// a fresh profile shows onboarding; seed a finished one so the real home screen is what gets tested
await page.evaluate(() => localStorage.setItem('stay_v1_profile', JSON.stringify({ userId: 'local-user', careContext: 'waitlisted', interactionMode: 'voice_and_text', proactiveCheckins: true, onboardingCompleted: true, updatedAt: new Date().toISOString() })));
await page.reload();
await page.waitForSelector('[aria-label="Talk to Stay"]', { timeout: 30_000 });

const prefs = await app.evaluate(() => global.__stay.win().webContents.getLastWebPreferences());
check('contextIsolation on', prefs.contextIsolation === true);
check('nodeIntegration off', prefs.nodeIntegration === false);
check('sandbox on', prefs.sandbox === true);
check('webSecurity on', prefs.webSecurity !== false);
check('page has no Node access', await page.evaluate(() => typeof require === 'undefined' && typeof process === 'undefined' && typeof module === 'undefined'));
check('preload exposes only the host descriptor', await page.evaluate(() => JSON.stringify(Object.keys(window.stayHost || {}).sort())) === JSON.stringify(['handlesNotifications', 'kind', 'platform']));

// navigation allowlist + new windows
await page.evaluate(() => { location.href = 'https://example.com/'; });
await sleep(1500);
check('cross-origin navigation blocked', new URL(page.url()).origin === new URL(target).origin, page.url());
const opened = await page.evaluate(() => window.open('https://example.com/x', '_blank') === null);
await sleep(500);
check('window.open denied, one window only', opened && app.windows().length === 1, `windows=${app.windows().length}`);
const ext = await app.evaluate(() => global.__stay.state.external);
check('https link handed to the system browser, not loaded', ext.includes('https://example.com/') && ext.includes('https://example.com/x'), JSON.stringify(ext));
await page.evaluate(() => { location.href = 'file:///C:/Windows/win.ini'; });
await sleep(800);
check('file:// navigation blocked', new URL(page.url()).protocol === 'https:' || new URL(page.url()).protocol === 'http:');

// microphone: the path the Talk button takes
const mic = await page.evaluate(async () => {
  const out = {};
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    out.audio = s.getAudioTracks().length;
    s.getTracks().forEach((t) => t.stop());
  } catch (e) { out.audioError = e.name; }
  try {
    const v = await navigator.mediaDevices.getUserMedia({ video: true });
    out.video = v.getVideoTracks().length;
    v.getTracks().forEach((t) => t.stop());
  } catch (e) { out.videoError = e.name; }
  try { await navigator.geolocation.getCurrentPosition(() => (out.geo = 'granted'), (e) => (out.geoError = e.code)); } catch (e) { out.geoError = e.name; }
  return out;
});
await sleep(800);
check('microphone granted (audio-only request)', mic.audio === 1, JSON.stringify(mic));
check('camera refused', mic.video === undefined && !!mic.videoError, mic.videoError || '');
const micStatus = await app.evaluate(({ systemPreferences }) => systemPreferences.getMediaAccessStatus('microphone'));
console.log(`INFO  OS microphone status: ${micStatus}`);

// tray, hotkey, settings
const labels = await app.evaluate(() => global.__stay.menu().items.map((i) => i.label));
check('tray menu has Start voice, 20 minute block, Ground me, Quit', ['Start voice', 'Start a 20 minute block', 'Ground me', 'Quit Stay'].every((l) => labels.includes(l)), labels.join(' | '));
check('summon hotkey registered (Alt+Shift+S; Murmur uses Ctrl+Shift+Space)', (await app.evaluate(() => global.__stay.state.hotkeyOk)) === true && (await app.evaluate(() => global.__stay.settings().hotkey)) === 'Alt+Shift+S');
await app.evaluate(() => global.__stay.setHotkey('Control+Shift+F12'));
check('hotkey is configurable', (await app.evaluate(() => global.__stay.state.hotkeyOk)) === true && JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')).hotkey === 'Control+Shift+F12');
await app.evaluate(() => global.__stay.setHotkey('Alt+Shift+S'));

// host -> page commands arrive as DOM events (and the page reacts when it is the new build)
await page.evaluate(() => { window.__cmds = []; window.addEventListener('stay:command', (e) => window.__cmds.push(e.detail)); });
await app.evaluate(() => global.__stay.sendCommand({ type: 'timer', minutes: 20 }));
await sleep(600);
const cmds = await page.evaluate(() => window.__cmds);
check('tray command reaches the page', cmds.length === 1 && JSON.parse(cmds[0]).minutes === 20, JSON.stringify(cmds));
// the page answered the command by starting its timer, which it announces as a host event the main process schedules
check('page acts on the command (timer-started comes back)', (await app.evaluate(() => global.__stay.notifier.pendingCount())) === 1);

// page -> host events become native notifications on time
await page.evaluate(() => {
  const send = (e) => window.dispatchEvent(new CustomEvent('stay:host', { detail: JSON.stringify(e) }));
  send({ type: 'reminder-added', id: 'smoke-1', text: 'Drink some water', dueAt: Date.now() + 1200 });
  send({ type: 'reminder-added', id: 'smoke-2', text: 'cancelled one', dueAt: Date.now() + 1200 });
  send({ type: 'reminder-removed', id: 'smoke-2' });
});
await sleep(2200);
const notified = await app.evaluate(() => global.__stay.state.notified);
check('reminder becomes one native notification, cancelled one does not', notified.filter((n) => n.body === 'Drink some water').length === 1 && !notified.some((n) => n.body === 'cancelled one'), JSON.stringify(notified));

// window state persistence
await app.evaluate(() => global.__stay.win().setBounds({ x: 60, y: 40, width: 700, height: 700 }));
await sleep(900);
const saved = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8'));
check('window bounds saved', saved.bounds && saved.bounds.width === 700 && saved.bounds.height === 700, JSON.stringify(saved.bounds));

// the screenshot a human wants to see
await app.evaluate(() => global.__stay.win().setBounds({ x: 60, y: 40, width: 480, height: 820 }));
await page.goto(new URL('/app/today', target).href).catch(() => undefined);
await page.waitForLoadState('networkidle').catch(() => undefined);
await sleep(2500);
const shot = join(shotDir, 'desktop-window.png');
await page.screenshot({ path: shot });
check('screenshot written', existsSync(shot), shot);

// single instance: a second launch must hand over and exit by itself
const second = spawn(electronBin, launchArgs, { env, stdio: 'ignore' });
const secondCode = await new Promise((res) => { const t = setTimeout(() => (second.kill(), res('timeout')), 15_000); second.on('exit', (c) => (clearTimeout(t), res(c))); });
check('second instance exits (single-instance lock)', secondCode === 0, `exit=${secondCode}`);

// clean quit
const proc = app.process();
const exited = new Promise((res) => proc.on('exit', (code) => res(code)));
await app.evaluate(({ app: a }) => a.quit()).catch(() => undefined);
const code = await Promise.race([exited, sleep(15_000).then(() => 'timeout')]);
check('quits cleanly', code === 0, `exit=${code}`);

// ---------- run 2: saved bounds restored ----------
await sleep(2500);
const app2 = await launch();
await app2.firstWindow();
const b = await app2.evaluate(() => global.__stay.win().getBounds());
const want = JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf8')).bounds;
check('window bounds restored on next launch', Math.abs(b.width - want.width) <= 2 && Math.abs(b.height - want.height) <= 8 && b.x === want.x, `saved=${JSON.stringify(want)} got=${JSON.stringify(b)}`);
await app2.evaluate(({ app: a }) => a.quit()).catch(() => undefined);
await sleep(1500);

// ---------- run 3: unreachable site shows the offline page ----------
const app3 = await launch({ STAY_URL: 'http://127.0.0.1:1', STAY_USER_DATA: mkdtempSync(join(tmpdir(), 'stay-desktop-off-')) });
const p3 = await app3.firstWindow();
await p3.waitForLoadState('domcontentloaded');
await p3.waitForSelector('#retry', { timeout: 20_000 }).catch(() => undefined);
check('offline page when the site is unreachable', (await p3.locator('h1').textContent().catch(() => '')).includes("can't reach"), await p3.url());
await app3.evaluate(({ app: a }) => a.quit()).catch(() => undefined);

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall desktop smoke checks passed');
process.exit(failed ? 1 : 0);
