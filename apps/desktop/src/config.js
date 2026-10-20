'use strict';
/* Pure policy for the desktop shell: which URL to load, what may be navigated to, requested, or granted.
 * No Electron imports, so it is unit-tested with `node --test`. */

const PROD_ORIGIN = 'https://stay-two-swart.vercel.app';
const LOCAL_ORIGIN = 'http://localhost:3000';
const START_PATH = '/app/today';

/** Hosts the page itself talks to (mirrors the CSP connect-src/style-src/font-src in next.config.mjs), besides the Stay origin. */
const SERVICE_HOSTS = [
  'streaming.assemblyai.com',
  'streaming-tts.assemblyai.com',
  'agents.assemblyai.com',
  'api.groq.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];
const SERVICE_SUFFIXES = ['.supabase.co'];

// Ctrl+Shift+Space belongs to the Murmur dictation app and Ctrl+Alt+Space was already taken on the dev machine (probed), so the default is Alt+Shift+S.
const HOTKEY_PRESETS = ['Alt+Shift+S', 'Control+Shift+Alt+Space', 'Control+Alt+Space', 'Control+Shift+F12'];
const DEFAULT_HOTKEY = HOTKEY_PRESETS[0];

function parseUrl(u) {
  try {
    return new URL(u);
  } catch {
    return null;
  }
}

/** argv/env decide the target. STAY_URL wins; --local (or STAY_LOCAL=1) means a local `next start`. */
function resolveTarget(argv = [], env = {}) {
  const custom = env.STAY_URL && parseUrl(env.STAY_URL);
  let origin = PROD_ORIGIN;
  if (custom && (custom.protocol === 'https:' || (custom.protocol === 'http:' && isLoopback(custom.hostname)))) origin = custom.origin;
  else if (argv.includes('--local') || env.STAY_LOCAL === '1') origin = LOCAL_ORIGIN;
  return { origin, url: origin + START_PATH, isLocal: origin !== PROD_ORIGIN && isLoopback(new URL(origin).hostname) };
}

function isLoopback(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

/** Main-frame navigation: the Stay origin only (and the bundled offline page, which main loads itself). */
function isAppUrl(url, origin) {
  const u = parseUrl(url);
  return !!u && u.origin === origin;
}

/** Any network request the session may make: the Stay origin, the services above, and inert local schemes. */
function isAllowedRequest(url, origin) {
  const u = parseUrl(url);
  if (!u) return false;
  if (['data:', 'blob:', 'devtools:'].includes(u.protocol)) return true;
  if (u.protocol === 'file:') return false;
  if (u.origin === origin) return true;
  if (!['https:', 'wss:'].includes(u.protocol)) return false;
  return SERVICE_HOSTS.includes(u.hostname) || SERVICE_SUFFIXES.some((s) => u.hostname.endsWith(s));
}

/** Links that leave the app open in the system browser, and only over safe schemes. */
function isSafeExternal(url) {
  const u = parseUrl(url);
  return !!u && ['https:', 'mailto:', 'tel:'].includes(u.protocol);
}

/** Microphone (audio only) and notifications, for the Stay origin only. Camera, screen, geolocation, MIDI, etc. are refused. */
function isPermissionGranted(permission, requestingUrl, origin, details = {}) {
  if (!isAppUrl(requestingUrl || '', origin)) return false;
  if (permission === 'notifications') return true;
  if (permission === 'media') {
    const types = details.mediaTypes || (details.mediaType ? [details.mediaType] : ['audio']);
    return types.length > 0 && types.every((t) => t === 'audio');
  }
  return false;
}

const DEFAULT_SETTINGS = {
  hotkey: DEFAULT_HOTKEY,
  launchAtLogin: false,
  voiceOnSummon: true,
  closeToTray: true,
  bounds: null,
  maximized: false,
};

/** Merges a stored settings object over the defaults, dropping anything of the wrong type. */
function sanitizeSettings(raw) {
  const s = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object') return s;
  if (raw.hotkey === '' || (typeof raw.hotkey === 'string' && raw.hotkey.length <= 40)) s.hotkey = raw.hotkey;
  for (const k of ['launchAtLogin', 'voiceOnSummon', 'closeToTray', 'maximized']) if (typeof raw[k] === 'boolean') s[k] = raw[k];
  const b = raw.bounds;
  if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width >= 320 && b.height >= 480) s.bounds = { x: b.x, y: b.y, width: b.width, height: b.height };
  return s;
}

/** True when a saved window rectangle is still mostly on a connected display (monitors get unplugged). */
function boundsVisible(b, displays) {
  if (!b) return false;
  return displays.some((d) => {
    const w = Math.min(b.x + b.width, d.x + d.width) - Math.max(b.x, d.x);
    const h = Math.min(b.y + b.height, d.y + d.height) - Math.max(b.y, d.y);
    return w >= 120 && h >= 80;
  });
}

module.exports = {
  PROD_ORIGIN, LOCAL_ORIGIN, START_PATH, SERVICE_HOSTS, HOTKEY_PRESETS, DEFAULT_HOTKEY, DEFAULT_SETTINGS,
  resolveTarget, isAppUrl, isAllowedRequest, isSafeExternal, isPermissionGranted, sanitizeSettings, boundsVisible,
};
