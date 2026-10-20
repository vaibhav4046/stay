/* Drives the debug APK on a running Android emulator or device through adb, and inspects the WebView over raw CDP
 * (Playwright's connectOverCDP does not support Android WebView).
 *   ADB=<path to adb> node test/emulator-verify.mjs <path-to-apk>
 * The APK must have been built with STAY_MOBILE_URL pointing at a Stay the emulator can reach (http://10.0.2.2:3100). */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shots = resolve(here, '..', '..', '..', 'docs', 'ecosystem');
mkdirSync(shots, { recursive: true });
const ADB = process.env.ADB || 'adb';
const apk = process.argv[2];
const PKG = 'app.stay.mobile';
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\r/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!ok) failed++;
};
const shot = (name) => writeFileSync(join(shots, name), execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));

/** Minimal CDP client for the app's WebView page. */
async function webview() {
  for (let i = 0; i < 40; i++) {
    const sockets = adb('shell', 'cat /proc/net/unix').split('\n').filter((l) => l.includes('webview_devtools_remote'));
    const name = sockets.length && sockets[sockets.length - 1].match(/@(webview_devtools_remote_\d+)/)?.[1];
    if (name) {
      adb('forward', 'tcp:9333', `localabstract:${name}`);
      try {
        const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
        const t = targets.find((x) => x.type === 'page');
        if (t) return connect(t.webSocketDebuggerUrl, t.url);
      } catch { /* socket not ready */ }
    }
    await sleep(1000);
  }
  throw new Error('no WebView devtools socket');
}

function connect(wsUrl) {
  return new Promise((resolveConn, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) (pending.get(msg.id)(msg), pending.delete(msg.id));
    };
    ws.onerror = () => reject(new Error('cdp socket error'));
    const send = (method, params = {}) => new Promise((res) => { pending.set(++id, res); ws.send(JSON.stringify({ id, method, params })); });
    ws.onopen = () =>
      resolveConn({
        /** evaluates an expression in the page (promises are awaited) and returns its JSON value */
        async ev(expression) {
          const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
          if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'page error');
          return r.result?.result?.value;
        },
        url: () => send('Runtime.evaluate', { expression: 'location.href', returnByValue: true }).then((r) => r.result.result.value),
        close: () => ws.close(),
      });
  });
}

console.log(adb('shell', 'getprop ro.product.model').trim(), '| Android', adb('shell', 'getprop ro.build.version.release').trim(), '| sdk', adb('shell', 'getprop ro.build.version.sdk').trim());
if (apk) adb('install', '-r', apk);
check('APK installed', adb('shell', 'pm list packages', PKG).includes(PKG));
adb('shell', 'pm', 'clear', PKG);
for (const p of ['RECORD_AUDIO', 'POST_NOTIFICATIONS']) adb('shell', 'pm', 'grant', PKG, `android.permission.${p}`); // the runtime prompt itself is not automated

// cold start: splash, then the app
adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
await sleep(600);
shot('android-splash.png');
let w = await webview();
for (let i = 0; i < 30 && !/\/app\/today/.test(await w.url()); i++) await sleep(1000);
check('loads the Stay site inside the WebView', /\/app\/today/.test(await w.url()), await w.url());
await w.ev(`localStorage.setItem('stay_v1_profile', JSON.stringify({ userId: 'local-user', careContext: 'waitlisted', interactionMode: 'voice_and_text', proactiveCheckins: true, onboardingCompleted: true, updatedAt: new Date().toISOString() })); location.reload(); 1`);
await sleep(1500);
w.close();
w = await webview();
for (let i = 0; i < 40 && !(await w.ev(`!!document.querySelector('[aria-label="Talk to Stay"]')`).catch(() => false)); i++) await sleep(1000);
await sleep(2500);
shot('android-app.png');

const bridge = await w.ev(`({ native: window.Capacitor?.isNativePlatform?.(), platform: window.Capacitor?.getPlatform?.(), np: typeof window.Capacitor?.nativePromise })`);
check('Capacitor bridge is present on the remote page', bridge.native === true && bridge.platform === 'android' && bridge.np === 'function', JSON.stringify(bridge));

const insets = await w.ev(`(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)'; document.body.appendChild(d); const cs = getComputedStyle(d); const r = { top: cs.paddingTop, bottom: cs.paddingBottom, vw: innerWidth, vh: innerHeight }; d.remove(); return r; })()`);
console.log('INFO  safe-area insets seen by the page:', JSON.stringify(insets));

const haptic = await w.ev(`window.Capacitor.nativePromise('Haptics', 'notification', { type: 'SUCCESS' }).then(() => 'ok', (e) => String(e && e.message || e))`);
check('haptics call reaches the native plugin', haptic === 'ok', haptic);
const perm = await w.ev(`window.Capacitor.nativePromise('LocalNotifications', 'checkPermissions').then((r) => r.display, (e) => String(e && e.message || e))`);
check('notification permission granted', perm === 'granted', perm);

// the app's own flow: a 1 minute block schedules a native notification that fires with the app backgrounded
await w.ev(`window.dispatchEvent(new CustomEvent('stay:command', { detail: JSON.stringify({ type: 'timer', minutes: 1 }) })); 1`);
await sleep(2000);
const alarms = adb('shell', 'dumpsys alarm');
check('timer start scheduled a native alarm for the app', alarms.split('\n').some((l) => l.includes(PKG) && /RTC|ELAPSED|alarm/i.test(l)), '');
adb('shell', 'input', 'keyevent', 'KEYCODE_HOME');
console.log('INFO  waiting 80 s for the block to end while the app is in the background');
await sleep(80_000);
const notifications = adb('shell', 'dumpsys notification --noredact');
check('native notification "Your block is up" posted', /Your block is up/.test(notifications), '');
w.close();

// deep link / launcher shortcut
adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'stay://today?action=grounding', PKG);
await sleep(3500);
const w2 = await webview();
const url2 = await w2.url();
check('deep link stay://today?action=grounding is routed by the app', /action=grounding/.test(url2), url2);
await sleep(1500);
shot('android-deeplink.png');
w2.close();

const shortcuts = adb('shell', 'dumpsys shortcut', PKG);
check('launcher shortcuts registered (Talk, Focus 20m, Ground me)', ['Talk', 'Focus 20m', 'Ground me'].every((s) => shortcuts.includes(s)), '');

console.log(failed ? `\n${failed} check(s) FAILED` : '\nall android checks passed');
process.exit(failed ? 1 : 0);
