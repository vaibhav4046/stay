import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { dueSlot } from '@/lib/push/schedule';
import { parsePrefs, parseSnoozeHours } from '@/lib/push/validate';

const blobs = new Map<string, string>();
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (path: string, body: string) => void blobs.set(path, body)),
  del: vi.fn(async (path: string) => void blobs.delete(path)),
  get: vi.fn(async (path: string) => (blobs.has(path) ? { statusCode: 200, stream: new Response(blobs.get(path)).body } : null)),
  list: vi.fn(async () => ({ blobs: [...blobs.keys()].map((pathname) => ({ pathname })), hasMore: false, cursor: undefined })),
}));
const sendNotification = vi.fn();
vi.mock('web-push', () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } };
const SECRET = 'tick-secret-for-tests';
const KEY = `push/${crypto.createHash('sha256').update(SUB.endpoint).digest('hex').slice(0, 40)}.json`;

const json = (method: string, url: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const patch = (body: unknown) => json('PATCH', '/api/push/subscribe', body);
const tickReq = () => json('POST', '/api/push/tick', {}, { authorization: `Bearer ${SECRET}` });

async function subscribed() {
  vi.resetModules();
  const sub = await import('@/app/api/push/subscribe/route');
  const tick = await import('@/app/api/push/tick/route');
  await sub.POST(json('POST', '/api/push/subscribe', { subscription: SUB, tz: 'UTC' }));
  blobs.set(KEY, JSON.stringify({ ...JSON.parse(blobs.get(KEY)!), sent: { day: '2000-01-01', slots: [] } })); // nothing sent yet today
  sendNotification.mockClear();
  return { sub, tick };
}

beforeEach(async () => {
  blobs.clear();
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  process.env.BLOB_READ_WRITE_TOKEN = 'test-blob';
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.PUSH_TICK_SECRET = SECRET;
  (await import('@/lib/security/apiGuard')).resetSecurityStateForTests();
});

describe('windows the person wants', () => {
  const none = { day: '2000-01-01', slots: [] as ('morning' | 'evening')[] };
  const morning = new Date('2026-11-05T09:30:00Z');
  const evening = new Date('2026-11-05T19:00:00Z');

  it('skips a window that is switched off and still sends the other', () => {
    expect(dueSlot(morning, 'UTC', none, { morning: false, evening: true })).toBeNull();
    expect(dueSlot(evening, 'UTC', none, { morning: false, evening: true })).toBe('evening');
    expect(dueSlot(morning, 'UTC', none, { morning: true, evening: false })).toBe('morning');
    expect(dueSlot(evening, 'UTC', none, { morning: true, evening: false })).toBeNull();
  });

  it('needs two booleans with at least one on, and whole hours of pause up to 72', () => {
    expect(parsePrefs({ morning: true, evening: false })).toEqual({ morning: true, evening: false });
    expect(parsePrefs({ morning: false, evening: false })).toBeNull();
    expect(parsePrefs({ morning: 'yes', evening: true })).toBeNull();
    expect(parsePrefs(null)).toBeNull();
    expect(parseSnoozeHours(0)).toBe(0);
    expect(parseSnoozeHours(24)).toBe(24);
    for (const bad of [-1, 73, 1.5, '24', NaN, null]) expect(parseSnoozeHours(bad)).toBeNull();
  });
});

describe('PATCH /api/push/subscribe', () => {
  it('stores the windows wanted and a pause, and nothing else changes', async () => {
    const { sub } = await subscribed();
    const res = await sub.PATCH(patch({ endpoint: SUB.endpoint, prefs: { morning: false, evening: true }, snoozeHours: 24 }));
    expect(res.status).toBe(200);
    const stored = JSON.parse(blobs.get(KEY)!);
    expect(stored.prefs).toEqual({ morning: false, evening: true });
    expect(stored.snoozeUntil).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(stored.sub.endpoint).toBe(SUB.endpoint);
    expect(stored.tz).toBe('UTC');
  });

  it('resumes when asked for zero hours', async () => {
    const { sub } = await subscribed();
    await sub.PATCH(patch({ endpoint: SUB.endpoint, snoozeHours: 24 }));
    await sub.PATCH(patch({ endpoint: SUB.endpoint, snoozeHours: 0 }));
    expect(JSON.parse(blobs.get(KEY)!).snoozeUntil).toBeUndefined();
  });

  it('refuses nonsense, an address that is not a push service, and a browser that never switched on', async () => {
    const { sub } = await subscribed();
    expect((await sub.PATCH(patch({ endpoint: SUB.endpoint }))).status).toBe(400);
    expect((await sub.PATCH(patch({ endpoint: SUB.endpoint, prefs: { morning: false, evening: false } }))).status).toBe(400);
    expect((await sub.PATCH(patch({ endpoint: SUB.endpoint, snoozeHours: 500 }))).status).toBe(400);
    expect((await sub.PATCH(patch({ endpoint: 'https://evil.example/x', snoozeHours: 1 }))).status).toBe(400);
    expect((await sub.PATCH(patch({ endpoint: 'https://fcm.googleapis.com/fcm/send/never-subscribed', snoozeHours: 1 }))).status).toBe(404);
  });
});

describe('the scheduler honours the choices', () => {
  it('sends nothing while paused, and sends again once the pause is over and a window is open', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T09:30:00Z'));
    try {
      const { sub, tick } = await subscribed();
      await sub.PATCH(patch({ endpoint: SUB.endpoint, snoozeHours: 2 }));
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 0, idle: 1 });
      vi.setSystemTime(new Date('2026-11-05T10:00:00Z')); // still paused, window still open
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 0 });
      vi.setSystemTime(new Date('2026-11-05T11:30:00Z')); // pause over, morning window closed
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 0 });
      vi.setSystemTime(new Date('2026-11-05T19:00:00Z'));
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 1 });
      expect(sendNotification).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('only sends the window that is wanted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T09:30:00Z'));
    try {
      const { sub, tick } = await subscribed();
      await sub.PATCH(patch({ endpoint: SUB.endpoint, prefs: { morning: false, evening: true } }));
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 0 }); // morning is off
      vi.setSystemTime(new Date('2026-11-05T19:00:00Z'));
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 1 });
    } finally {
      vi.useRealTimers();
    }
  });
});
