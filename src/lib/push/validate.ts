/** What the server accepts as a push subscription. Only the browsers' own push services are allowed as targets, so the server can never be steered at someone else's address. */
export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const PUSH_HOSTS: RegExp[] = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
];

const B64URL = (min: number, max: number) => new RegExp(`^[A-Za-z0-9_-]{${min},${max}}$`);

export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string' || endpoint.length > 700) return false;
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && !u.username && !u.password && u.port === '' && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch {
    return false;
  }
}

export function parseSubscription(raw: unknown): PushSubscriptionJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const { endpoint, keys } = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (!isPushEndpoint(endpoint) || !keys) return null;
  const { p256dh, auth } = keys;
  if (typeof p256dh !== 'string' || typeof auth !== 'string') return null;
  if (!B64URL(86, 88).test(p256dh) || !B64URL(22, 24).test(auth)) return null;
  return { endpoint, keys: { p256dh, auth } };
}

/** An IANA zone name the runtime knows, e.g. "Europe/London". */
export function parseTimeZone(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(raw)) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw });
    return raw;
  } catch {
    return null;
  }
}

/** { morning, evening } as booleans, at least one on; anything else is refused. */
export function parsePrefs(raw: unknown): { morning: boolean; evening: boolean } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { morning, evening } = raw as { morning?: unknown; evening?: unknown };
  if (typeof morning !== 'boolean' || typeof evening !== 'boolean' || (!morning && !evening)) return null;
  return { morning, evening };
}

/** Whole hours of quiet, 0 (resume) to 72. */
export function parseSnoozeHours(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 72 ? raw : null;
}
