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
}
