import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

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

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

async function routes() {
  vi.resetModules();
  return { sub: await import('@/app/api/push/subscribe/route'), tick: await import('@/app/api/push/tick/route') };
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

describe('POST /api/push/subscribe', () => {
  it('sends a welcome message, then stores only the address, keys and zone', async () => {
    const { sub } = await routes();
    const res = await sub.POST(post('/api/push/subscribe', { subscription: SUB, tz: 'Asia/Kolkata' }));
    expect(res.status).toBe(200);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sendNotification.mock.calls[0][1] as string).body).toMatch(/^Stay is on/);
    expect(blobs.size).toBe(1);
    const stored = JSON.parse([...blobs.values()][0]);
    expect(Object.keys(stored).sort()).toEqual(['created', 'sent', 'sub', 'tz']);
    expect(Object.keys(stored.sub).sort()).toEqual(['endpoint', 'keys']);
  });

  it('keeps nothing when the push service refuses the welcome message', async () => {
    sendNotification.mockRejectedValue({ statusCode: 410 });
    const { sub } = await routes();
    const res = await sub.POST(post('/api/push/subscribe', { subscription: SUB, tz: 'UTC' }));
    expect(res.status).toBe(502);
    expect(blobs.size).toBe(0);
  });

  it('rejects other hosts and bad zones without sending anything', async () => {
    const { sub } = await routes();
    const evil = await sub.POST(post('/api/push/subscribe', { subscription: { ...SUB, endpoint: 'https://169.254.169.254/x' }, tz: 'UTC' }));
    const badZone = await sub.POST(post('/api/push/subscribe', { subscription: SUB, tz: 'Mars/Base' }));
    expect(evil.status).toBe(400);
    expect(badZone.status).toBe(400);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('refuses cross-origin calls and oversized bodies', async () => {
    const { sub } = await routes();
    const cross = await sub.POST(post('/api/push/subscribe', { subscription: SUB, tz: 'UTC' }, { origin: 'https://evil.example' }));
    const big = await sub.POST(post('/api/push/subscribe', { subscription: SUB, tz: 'UTC' }, { 'content-length': '99999' }));
    expect(cross.status).toBe(403);
    expect(big.status).toBe(413);
  });

  it('says it is not set up, rather than pretending, when the store or keys are missing', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const { sub } = await routes();
    expect(await (await sub.GET()).json()).toEqual({ enabled: false });
    expect((await sub.POST(post('/api/push/subscribe', { subscription: SUB, tz: 'UTC' }))).status).toBe(503);
  });

  it('DELETE removes the stored address', async () => {
    const { sub } = await routes();
    await sub.POST(post('/api/push/subscribe', { subscription: SUB, tz: 'UTC' }));
    expect(blobs.size).toBe(1);
    const del = await sub.DELETE(new NextRequest('http://localhost/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: SUB.endpoint }) }));
    expect(del.status).toBe(200);
    expect(blobs.size).toBe(0);
  });
});

describe('POST /api/push/tick', () => {
  const stored = (over: object) => blobs.set(KEY, JSON.stringify({ sub: SUB, tz: 'UTC', created: 1, sent: { day: '2000-01-01', slots: [] }, ...over }));
  const tick = (secret?: string) => post('/api/push/tick', {}, secret ? { authorization: `Bearer ${secret}` } : {});

  it('refuses without the shared secret', async () => {
    const { tick: t } = await routes();
    expect((await t.POST(tick())).status).toBe(401);
    expect((await t.POST(tick('wrong'))).status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('is closed when no secret is configured', async () => {
    delete process.env.PUSH_TICK_SECRET;
    const { tick: t } = await routes();
    expect((await t.POST(tick('anything'))).status).toBe(503);
  });

  it('sends a due message once and records it, so the next tick stays quiet', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T09:30:00Z'));
    try {
      stored({});
      const { tick: t } = await routes();
      expect(await (await t.POST(tick(SECRET))).json()).toMatchObject({ subscribers: 1, sent: 1, idle: 0 });
      const body = JSON.parse(sendNotification.mock.calls[0][1] as string);
      expect(body.title).toBe('Stay');
      expect(sendNotification.mock.calls[0][2]).toMatchObject({ topic: 'morning', urgency: 'low' });
      expect(JSON.parse(blobs.get(KEY)!).sent).toEqual({ day: '2026-11-05', slots: ['morning'] });
      expect(await (await t.POST(tick(SECRET))).json()).toMatchObject({ sent: 0, idle: 1 });
      expect(sendNotification).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends nothing at night', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T02:00:00Z'));
    try {
      stored({});
      const { tick: t } = await routes();
      expect(await (await t.POST(tick(SECRET))).json()).toMatchObject({ sent: 0, idle: 1 });
      expect(sendNotification).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a subscription the push service says is gone, and retries a transient failure next tick', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-05T09:30:00Z'));
    try {
      stored({});
      const { tick: t } = await routes();
      sendNotification.mockRejectedValueOnce({ statusCode: 503 });
      expect(await (await t.POST(tick(SECRET))).json()).toMatchObject({ failed: 1, sent: 0 });
      expect(JSON.parse(blobs.get(KEY)!).sent.slots).toEqual([]); // not marked sent: tries again
      sendNotification.mockRejectedValueOnce({ statusCode: 410 });
      expect(await (await t.POST(tick(SECRET))).json()).toMatchObject({ removed: 1 });
      expect(blobs.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
