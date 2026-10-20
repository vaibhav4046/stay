/**
 * The one seam between the web app and its native wrappers (apps/desktop, apps/mobile, apps/extension).
 * Plain DOM events with a JSON string payload (a string crosses Electron/extension isolated worlds reliably, an object may not):
 *   page -> host   window 'stay:host'     detail = JSON of a HostEvent
 *   host -> page   window 'stay:command'  detail = JSON of a HostCommand
 * On Capacitor the page also calls the native plugins directly, because a remote page cannot be injected with a script.
 * In a plain browser nothing listens, so every call here is a harmless no-op.
 */
export type HostEvent =
  | { type: 'timer-started'; minutes: number; endsAt: number }
  | { type: 'timer-ended' }
  | { type: 'timer-stopped' }
  | { type: 'reminder-added'; id: string; text: string; dueAt: number }
  | { type: 'reminder-removed'; id: string }
  | { type: 'reminder-due'; id: string; text: string }
  | { type: 'voice-state'; live: boolean };

export type HostCommand =
  | { type: 'voice-start' }
  | { type: 'voice-stop' }
  | { type: 'voice-toggle' }
  | { type: 'grounding' }
  | { type: 'timer'; minutes: number };

interface CapacitorLike {
  isNativePlatform?: () => boolean;
  /** the bridge's low-level call; a remote page has no bundled plugin wrappers, only this */
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
  addListener?: (plugin: string, event: string, cb: (data: unknown) => void) => unknown;
}
declare global {
  interface Window {
    Capacitor?: CapacitorLike;
    /** exposed by the Electron preload */
    stayHost?: { kind: string; handlesNotifications?: boolean };
  }
}

const COMMANDS = new Set(['voice-start', 'voice-stop', 'voice-toggle', 'grounding', 'timer']);

function capacitor(): CapacitorLike | null {
  if (typeof window === 'undefined') return null;
  const c = window.Capacitor;
  return c && c.isNativePlatform?.() && typeof c.nativePromise === 'function' ? c : null;
}

/** True when a wrapper shows its own system notifications, so the page must not also raise one. */
export function hostHandlesNotifications(): boolean {
  return typeof window !== 'undefined' && (!!window.stayHost?.handlesNotifications || capacitor() !== null);
}

/** A stable positive 31-bit id for Android notification ids. */
const nativeId = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) & 0x7fffffff, 7) || 1;
const TIMER_NOTIFICATION = 1;

function viaCapacitor(c: CapacitorLike, e: HostEvent): void {
  const call = (plugin: string, method: string, options?: unknown) => c.nativePromise!(plugin, method, options).catch(() => undefined);
  const schedule = async (id: number, body: string, at: number) => {
    let perm = (await call('LocalNotifications', 'checkPermissions')) as { display?: string } | undefined;
    if (perm?.display !== 'granted') perm = (await call('LocalNotifications', 'requestPermissions')) as { display?: string } | undefined;
    if (perm?.display !== 'granted') return;
    await call('LocalNotifications', 'schedule', { notifications: [{ id, title: 'Stay', body, schedule: { at: new Date(at).toISOString(), allowWhileIdle: true } }] });
  };
  const cancel = (id: number) => call('LocalNotifications', 'cancel', { notifications: [{ id }] });
  switch (e.type) {
    case 'timer-started':
      void schedule(TIMER_NOTIFICATION, 'Your block is up. How did it go?', e.endsAt);
      break;
    case 'timer-ended':
      void call('Haptics', 'notification', { type: 'SUCCESS' });
      void cancel(TIMER_NOTIFICATION);
      break;
    case 'timer-stopped':
      void cancel(TIMER_NOTIFICATION);
      break;
    case 'reminder-added':
      void schedule(nativeId(e.id), e.text, e.dueAt);
      break;
    case 'reminder-removed':
      void cancel(nativeId(e.id));
      break;
    case 'reminder-due':
      void call('Haptics', 'notification', { type: 'WARNING' });
      break;
    default:
  }
}

const LINK_ROUTES: Record<string, string> = { today: '/app/today', history: '/app/history', settings: '/app/settings', treatment: '/app/treatment', reports: '/app/reports' };
const LINK_PARAMS = ['voice', 'timer', 'action'];

/** Maps a deep link (stay://today?timer=20 or an https link to this site) onto an app path; anything else is ignored. */
export function pathFromDeepLink(raw: string, siteHost: string): string | null {
  try {
    const u = new URL(raw);
    let path: string | null = null;
    if (u.protocol === 'stay:') path = LINK_ROUTES[u.hostname] ?? null;
    else if (u.protocol === 'https:' && u.hostname === siteHost && u.pathname.startsWith('/app/')) path = u.pathname.replace(/\/+$/, '');
    if (!path || path.includes('..')) return null;
    const q = new URLSearchParams();
    for (const k of LINK_PARAMS) {
      const v = u.searchParams.get(k);
      if (v && /^[a-z0-9]{1,12}$/i.test(v)) q.set(k, v);
    }
    return path + (q.size ? '?' + q.toString() : '');
  } catch {
    return null;
  }
}

/** Android/iOS launch shortcuts and links: opens the matching screen. A no-op outside the mobile wrapper. */
export function initHostLinks(): void {
  const c = capacitor();
  if (!c) return;
  const go = (raw: unknown) => {
    const url = (raw as { url?: string } | null)?.url;
    const path = url ? pathFromDeepLink(url, window.location.hostname) : null;
    if (path && path !== window.location.pathname + window.location.search) window.location.assign(path);
  };
  void c.nativePromise!('App', 'getLaunchUrl').then(go, () => undefined);
  c.addListener?.('App', 'appUrlOpen', go);
}

export function emitHost(e: HostEvent): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('stay:host', { detail: JSON.stringify(e) }));
    const c = capacitor();
    if (c) viaCapacitor(c, e);
  } catch {
    // a wrapper failing must never break the app
  }
}

export function parseHostCommand(detail: unknown): HostCommand | null {
  try {
    const c = (typeof detail === 'string' ? JSON.parse(detail) : detail) as { type?: unknown; minutes?: unknown } | null;
    if (!c || typeof c.type !== 'string' || !COMMANDS.has(c.type)) return null;
    if (c.type === 'timer') {
      const m = Number(c.minutes);
      return Number.isFinite(m) && m >= 1 && m <= 120 ? { type: 'timer', minutes: Math.round(m) } : null;
    }
    return { type: c.type } as HostCommand;
  } catch {
    return null;
  }
}

/** Subscribes to commands from a wrapper (tray, hotkey, toolbar). Returns the unsubscribe. */
export function onHostCommand(cb: (c: HostCommand) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const h = (ev: Event) => {
    const c = parseHostCommand((ev as CustomEvent).detail);
    if (c) cb(c);
  };
  window.addEventListener('stay:command', h);
  return () => window.removeEventListener('stay:command', h);
}
