/** Browser side of Stay's own check-ins: ask permission from a tap, subscribe, tell the server, and undo all of it. */
export type PushState = 'loading' | 'unsupported' | 'needs-install' | 'unconfigured' | 'denied' | 'off' | 'on';

const ENDPOINT = '/api/push/subscribe';

const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const keyBytes = (b64url: string): Uint8Array<ArrayBuffer> => {
  const raw = atob(b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64url.length / 4) * 4, '='));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function config(): Promise<{ enabled: boolean; publicKey?: string }> {
  try {
    const res = await fetch(ENDPOINT, { cache: 'no-store' });
    return res.ok ? await res.json() : { enabled: false };
  } catch {
    return { enabled: false };
  }
}

/** iPhone and iPad only deliver web notifications to an app that was added to the Home Screen; in a Safari tab the feature is simply absent. */
const iosInBrowser = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && (navigator as Navigator & { standalone?: boolean }).standalone !== true;

export async function readPushState(): Promise<PushState> {
  if (!supported()) return iosInBrowser() ? 'needs-install' : 'unsupported';
  if (!(await config()).enabled) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  // No permission means no subscription can exist, so there is nothing to look up. Skipping the lookup also keeps a browser whose push support is
  // partial from being asked a question it cannot answer (a desktop WebKit build froze the whole tab on getSubscription()).
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

/** Must be called from a tap. Returns the state to show afterwards, or 'error' when the server could not confirm the subscription. */
export async function enablePush(): Promise<PushState | 'error'> {
  if (!supported()) return 'unsupported';
  const cfg = await config();
  if (!cfg.enabled || !cfg.publicKey) return 'unconfigured';
  if ((await Notification.requestPermission()) !== 'granted') return Notification.permission === 'denied' ? 'denied' : 'off';
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) }));
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
    if (!res.ok) {
      await sub.unsubscribe().catch(() => undefined);
      return 'error';
    }
    try {
      window.localStorage.removeItem('stay_checkin_choices_v1');
    } catch {
      // nothing to forget
    }
    return 'on';
  } catch {
    return 'error';
  }
}

export async function disablePush(): Promise<void> {
  if (!supported()) return;
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (!sub) return;
  await fetch(ENDPOINT, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
  try {
    window.localStorage.removeItem('stay_checkin_choices_v1');
  } catch {
    // nothing to forget
  }
}

export interface CheckinChoices {
  morning: boolean;
  evening: boolean;
  /** When a pause ends (ms since 1970), or 0. Kept on this device so Settings can show it; the server is what honours it. */
  pausedUntil: number;
}
const CHOICES_KEY = 'stay_checkin_choices_v1';
const DEFAULT_CHOICES: CheckinChoices = { morning: true, evening: true, pausedUntil: 0 };

export function loadChoices(): CheckinChoices {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CHOICES_KEY) || 'null');
    if (raw && typeof raw.morning === 'boolean' && typeof raw.evening === 'boolean' && (raw.morning || raw.evening)) {
      return { morning: raw.morning, evening: raw.evening, pausedUntil: typeof raw.pausedUntil === 'number' && raw.pausedUntil > Date.now() ? raw.pausedUntil : 0 };
    }
  } catch {
    // unreadable: the defaults
  }
  return DEFAULT_CHOICES;
}

/** Tells the server and, only if it agrees, remembers the choice here. Returns the choices now in force, or null when it could not be saved. */
export async function saveChoices(next: Partial<Omit<CheckinChoices, 'pausedUntil'>> & { pauseHours?: number }): Promise<CheckinChoices | null> {
  if (!supported()) return null;
  const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  if (!sub) return null;
  const cur = loadChoices();
  const merged = { morning: next.morning ?? cur.morning, evening: next.evening ?? cur.evening };
  const res = await fetch(ENDPOINT, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, prefs: merged, ...(next.pauseHours === undefined ? {} : { snoozeHours: next.pauseHours }) }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const saved: CheckinChoices = { ...merged, pausedUntil: next.pauseHours === undefined ? cur.pausedUntil : next.pauseHours === 0 ? 0 : Date.now() + next.pauseHours * 3_600_000 };
  try {
    window.localStorage.setItem(CHOICES_KEY, JSON.stringify(saved));
  } catch {
    // private mode: in force on the server, not remembered here
  }
  return saved;
}

/** The browser's own subscription, only when notifications are allowed (otherwise none can exist, and asking can freeze a browser with partial push support). */
async function activeSubscription() {
  if (!supported() || Notification.permission !== 'granted') return null;
  return (await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription()) ?? null;
}

const RING_KEY = 'stay_timer_ping_v1';
/** A minute's grace after the block ends: an app that is open handles the end itself and cancels the ping first. */
export const RING_GRACE_MS = 20_000;

/**
 * Ask the server to send a message when the focus block ends, for the person who has check-ins on and may close the app (0 cancels).
 * Only when check-ins are on; silent otherwise. The same moment is never sent twice, so reopening a running block does not start a second wait.
 */
export async function setTimerPing(atMs: number): Promise<boolean> {
  try {
    const last = Number(window.localStorage.getItem(RING_KEY) || 0);
    if (atMs === last) return true;
    if (atMs === 0 && last === 0) return true;
    const sub = await activeSubscription();
    if (!sub) return false;
    const res = await fetch(ENDPOINT, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, ringAt: atMs }),
    }).catch(() => null);
    if (!res?.ok) return false;
    window.localStorage.setItem(RING_KEY, String(atMs));
    return true;
  } catch {
    return false;
  }
}
