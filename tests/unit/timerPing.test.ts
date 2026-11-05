import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { isCalm } from '@/lib/coach/dailyGreeting';
import { allMessagesCalm, RING_MESSAGE } from '@/lib/push/schedule';
import { parseRingAt } from '@/lib/push/validate';

const blobs = new Map<string, string>();
vi.mock('@vercel/blob', () => ({
  put: vi.fn(async (path: string, body: string) => void blobs.set(path, body)),
  del: vi.fn(async (path: string) => void blobs.delete(path)),
  get: vi.fn(async (path: string) => (blobs.has(path) ? { statusCode: 200, stream: new Response(blobs.get(path)).body } : null)),
  list: vi.fn(async () => ({ blobs: [...blobs.keys()].map((pathname) => ({ pathname })), hasMore: false, cursor: undefined })),
}));
const sendNotification = vi.fn();
vi.mock('web-push', () => ({ default: { sendNotification: (...a: unknown[]) => sendNotification(...a) } }));
// after() only exists inside a real request: collect what each route asked to run afterwards
const afterQueue: Array<() => unknown> = [];
vi.mock('next/server', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/server')>()), after: (fn: () => unknown) => void afterQueue.push(fn) }));

const SUB = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } };
const SECRET = 'tick-secret-for-tests';
const KEY = `push/${crypto.createHash('sha256').update(SUB.endpoint).digest('hex').slice(0, 40)}.json`;
const record = () => JSON.parse(blobs.get(KEY)!);
const json = (method: string, url: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

async function modules() {
  vi.resetModules();
  return {
    sub: await import('@/app/api/push/subscribe/route'),
    tick: await import('@/app/api/push/tick/route'),
    ringRoute: await import('@/app/api/push/ring/route'),
    ring: await import('@/lib/push/ring'),
  };
}

async function subscribed() {
  const m = await modules();
  await m.sub.POST(json('POST', '/api/push/subscribe', { subscription: SUB, tz: 'UTC' }));
  blobs.set(KEY, JSON.stringify({ ...record(), sent: { day: '2000-01-01', slots: [] } }));
  sendNotification.mockClear();
  afterQueue.length = 0;
  return m;
}

beforeEach(async () => {
  blobs.clear();
  afterQueue.length = 0;
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
  process.env.BLOB_READ_WRITE_TOKEN = 'test-blob';
  process.env.VAPID_PUBLIC_KEY = 'pub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
  process.env.PUSH_TICK_SECRET = SECRET;
  (await import('@/lib/security/apiGuard')).resetSecurityStateForTests();
});

describe('when a block may end', () => {
  const now = 1_800_000_000_000;
  it('accepts a moment from five seconds to four hours ahead, and 0 to cancel', () => {
    expect(parseRingAt(0, now)).toBe(0);
    expect(parseRingAt(now + 5_000, now)).toBe(now + 5_000);
    expect(parseRingAt(now + 25 * 60_000, now)).toBe(now + 25 * 60_000);
    expect(parseRingAt(now + 4 * 3_600_000, now)).toBe(now + 4 * 3_600_000);
  });
  it('refuses the past, a moment too close or too far, and anything that is not a number', () => {
    for (const bad of [now - 1, now + 4_000, now + 4 * 3_600_000 + 1, NaN, Infinity, '1800000100000', null, undefined, {}]) expect(parseRingAt(bad, now)).toBeNull();
  });
  it('its general line is calm', () => {
    expect(allMessagesCalm()).toBe(true);
    expect(isCalm(RING_MESSAGE)).toBe(true);
  });
});

describe('the sentence written on the device', () => {
  const { composeNudge } = createRequire(import.meta.url)('../../public/sw-compose.js') as { composeNudge: (s: string, c: object | null, f: string, d?: number) => string };
  it('names the block, and the person', () => {
    const t = composeNudge('timer', { name: 'Asha', block: 'email the landlord', open: 'something else' }, RING_MESSAGE, 0);
    expect(t).toContain('email the landlord');
    expect(t).toContain('Asha');
    expect(t).not.toContain('something else');
  });
  it('falls back to the general line when it does not know the block', () => {
    expect(composeNudge('timer', { name: 'Asha', open: 'x' }, RING_MESSAGE)).toBe(RING_MESSAGE);
    expect(composeNudge('timer', null, RING_MESSAGE)).toBe(RING_MESSAGE);
  });
  it('is calm and short for every wording', () => {
    for (let d = 0; d < 4; d++) for (const name of ['', 'Asha']) {
      const t = composeNudge('timer', { name, block: 'file the tax return' }, RING_MESSAGE, d);
      expect(isCalm(t), t).toBe(true);
      expect(t.length).toBeLessThanOrEqual(200);
    }
  });
});

describe('PATCH ringAt', () => {
  const patch = (body: unknown) => json('PATCH', '/api/push/subscribe', body);
  it('stores the moment, queues the wait for after the answer, and cancels with zero', async () => {
    const { sub } = await subscribed();
    const at = Date.now() + 25 * 60_000;
    expect((await sub.PATCH(patch({ endpoint: SUB.endpoint, ringAt: at }))).status).toBe(200);
    expect(record().ringAt).toBe(at);
    expect(afterQueue).toHaveLength(1);
    afterQueue.length = 0;
    expect((await sub.PATCH(patch({ endpoint: SUB.endpoint, ringAt: 0 }))).status).toBe(200);
    expect(record().ringAt).toBeUndefined();
    expect(afterQueue).toHaveLength(0); // nothing to wait for
  });
  it('refuses a moment that is not allowed and changes nothing', async () => {
    const { sub } = await subscribed();
    expect((await sub.PATCH(patch({ endpoint: SUB.endpoint, ringAt: Date.now() + 5 * 3_600_000 }))).status).toBe(400);
    expect((await sub.PATCH(patch({ endpoint: SUB.endpoint, ringAt: Date.now() - 1000 }))).status).toBe(400);
    expect(record().ringAt).toBeUndefined();
    expect(afterQueue).toHaveLength(0);
  });
});

describe('the chain', () => {
  const fakeDeps = (start: number) => {
    let t = start;
    const sleeps: number[] = [];
    const hops: Array<[string, number]> = [];
    return {
      sleeps,
      hops,
      deps: { now: () => t, sleep: async (ms: number) => void (sleeps.push(ms), (t += ms)), hop: async (e: string, r: number) => void hops.push([e, r]) },
    };
  };

  it('keeps waiting in short runs, handing over each time, until it is time', async () => {
    const { ring } = await subscribed();
    const t0 = 1_800_000_000_000;
    const at = t0 + 100_000;
    blobs.set(KEY, JSON.stringify({ ...record(), ringAt: at }));
    const f = fakeDeps(t0);
    expect(await ring.runRing(SUB.endpoint, at, f.deps)).toBe('wait');
    expect(f.sleeps).toEqual([48_000]); // never longer than one run may last
    expect(f.hops).toEqual([[SUB.endpoint, at]]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends at the moment, once, and clears the ring', async () => {
    const { ring } = await subscribed();
    const t0 = 1_800_000_000_000;
    const at = t0 + 10_000;
    blobs.set(KEY, JSON.stringify({ ...record(), ringAt: at }));
    const f = fakeDeps(t0);
    expect(await ring.runRing(SUB.endpoint, at, f.deps)).toBe('sent');
    expect(f.sleeps).toEqual([10_250]); // wakes just after the moment, never before
    expect(f.hops).toEqual([]);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const sent = JSON.parse(sendNotification.mock.calls[0][1] as string);
    expect(sent).toMatchObject({ body: RING_MESSAGE, slot: 'timer', inbox: true });
    expect(sendNotification.mock.calls[0][2]).toMatchObject({ topic: 'timer' });
    expect(record().ringAt).toBeUndefined();
    // a second chain for the same moment (a block reopened) finds nothing left to do
    expect(await ring.runRing(SUB.endpoint, at, fakeDeps(t0 + 20_000).deps)).toBe('cancelled');
    expect(sendNotification).toHaveBeenCalledTimes(1);
  });

  it('stops when the block was stopped or a newer one replaced it', async () => {
    const { ring } = await subscribed();
    const t0 = 1_800_000_000_000;
    const at = t0 + 100_000;
    const f = fakeDeps(t0);
    blobs.set(KEY, JSON.stringify({ ...record(), ringAt: undefined })); // cancelled
    expect(await ring.runRing(SUB.endpoint, at, f.deps)).toBe('cancelled');
    blobs.set(KEY, JSON.stringify({ ...record(), ringAt: at + 600_000 })); // replaced
    expect(await ring.runRing(SUB.endpoint, at, fakeDeps(t0).deps)).toBe('cancelled');
    expect(f.hops).toEqual([]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('keeps the ring when the push service fails, so the hourly tick can still send it', async () => {
    const { ring } = await subscribed();
    const t0 = 1_800_000_000_000;
    const at = t0 + 5_000;
    blobs.set(KEY, JSON.stringify({ ...record(), ringAt: at }));
    sendNotification.mockRejectedValueOnce({ statusCode: 503 });
    expect(await ring.runRing(SUB.endpoint, at, fakeDeps(t0).deps)).toBe('failed');
    expect(record().ringAt).toBe(at);
  });

  it('forgets a browser the push service says is gone', async () => {
    const { ring } = await subscribed();
    const t0 = 1_800_000_000_000;
    const at = t0 + 5_000;
    blobs.set(KEY, JSON.stringify({ ...record(), ringAt: at }));
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    expect(await ring.runRing(SUB.endpoint, at, fakeDeps(t0).deps)).toBe('gone');
    expect(blobs.has(KEY)).toBe(false);
  });

  it('a failed hand-over does not throw: the hourly tick is the safety net', async () => {
    const { ring } = await subscribed();
    const t0 = 1_800_000_000_000;
    const at = t0 + 100_000;
    blobs.set(KEY, JSON.stringify({ ...record(), ringAt: at }));
    const f = fakeDeps(t0);
    f.deps.hop = async () => {
      throw new Error('network');
    };
    await expect(ring.runRing(SUB.endpoint, at, f.deps)).resolves.toBe('wait');
    expect(record().ringAt).toBe(at);
  });
});

describe('POST /api/push/ring', () => {
  const hop = (body: unknown, auth?: string) => json('POST', '/api/push/ring', body, auth ? { authorization: `Bearer ${auth}` } : {});
  it('answers only to this app’s own secret', async () => {
    const { ringRoute } = await subscribed();
    const at = Date.now() + 60_000;
    expect((await ringRoute.POST(hop({ endpoint: SUB.endpoint, ringAt: at }))).status).toBe(401);
    expect((await ringRoute.POST(hop({ endpoint: SUB.endpoint, ringAt: at }, 'wrong'))).status).toBe(401);
    expect(afterQueue).toHaveLength(0);
  });
  it('is closed when no secret is configured', async () => {
    delete process.env.PUSH_TICK_SECRET;
    const { ringRoute } = await modules();
    expect((await ringRoute.POST(hop({ endpoint: SUB.endpoint, ringAt: Date.now() + 60_000 }, 'anything'))).status).toBe(503);
  });
  it('answers at once with 202 and queues the wait; refuses bad bodies', async () => {
    const { ringRoute } = await subscribed();
    const at = Date.now() + 60_000;
    expect((await ringRoute.POST(hop({ endpoint: SUB.endpoint, ringAt: at }, SECRET))).status).toBe(202);
    expect(afterQueue).toHaveLength(1);
    afterQueue.length = 0;
    for (const bad of [{ endpoint: 'https://evil.example/x', ringAt: at }, { endpoint: SUB.endpoint, ringAt: Date.now() + 9 * 3_600_000 }, { endpoint: SUB.endpoint }, { ringAt: at }]) {
      expect((await ringRoute.POST(hop(bad, SECRET))).status).toBe(400);
    }
    expect(afterQueue).toHaveLength(0);
  });
});

describe('the hourly tick as the safety net', () => {
  const tickReq = () => json('POST', '/api/push/tick', {}, { authorization: `Bearer ${SECRET}` });
  const NOW = new Date('2026-11-05T14:00:00Z'); // between the two windows: nothing else is due

  it('sends a ring the chain missed, late, once', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try {
      const { tick } = await subscribed();
      blobs.set(KEY, JSON.stringify({ ...record(), ringAt: NOW.getTime() - 10 * 60_000 }));
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 1 });
      expect(JSON.parse(sendNotification.mock.calls[0][1] as string).body).toBe(RING_MESSAGE);
      expect(record().ringAt).toBeUndefined();
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 0 });
      expect(sendNotification).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops a ring that is too old to be useful, without sending', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try {
      const { tick } = await subscribed();
      blobs.set(KEY, JSON.stringify({ ...record(), ringAt: NOW.getTime() - 4 * 3_600_000 }));
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 0 });
      expect(sendNotification).not.toHaveBeenCalled();
      expect(record().ringAt).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it('leaves a ring that is still in the future for the chain', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    try {
      const { tick } = await subscribed();
      const at = NOW.getTime() + 20 * 60_000;
      blobs.set(KEY, JSON.stringify({ ...record(), ringAt: at }));
      expect(await (await tick.POST(tickReq())).json()).toMatchObject({ sent: 0 });
      expect(record().ringAt).toBe(at);
    } finally {
      vi.useRealTimers();
    }
  });
});
