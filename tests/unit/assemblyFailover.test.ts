import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const OLD = 'old-key-0000000000000000';
const NEW = 'new-key-1111111111111111';

/** Which key each mocked AssemblyAI call carried, and what each key gets back. */
const calls: string[] = [];
let answers: Record<string, number> = {};

beforeEach(() => {
  calls.length = 0;
  answers = { [OLD]: 200, [NEW]: 200 };
  process.env.ASSEMBLYAI_API_KEY = OLD;
  process.env.ASSEMBLYAI_API_KEYS = NEW;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init?: { headers?: Record<string, string> }) => {
      const auth = (init?.headers?.Authorization ?? '').replace(/^Bearer /, '');
      calls.push(auth);
      const status = answers[auth] ?? 401;
      return new Response(JSON.stringify({ token: `tok-for-${auth}` }), { status });
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

async function fastToken() {
  vi.resetModules();
  (await import('@/lib/security/apiGuard')).resetSecurityStateForTests();
  const route = await import('@/app/api/voice/fast-token/route');
  return (n = 1) => Promise.all(Array.from({ length: n }, () => route.POST(new NextRequest('http://localhost/api/voice/fast-token', { method: 'POST' }))));
}

describe('AssemblyAI keys: the first is used until its credit is spent, then the next takes over', () => {
  it('uses the first key while it works, and never touches the second', async () => {
    const call = await fastToken();
    const [res] = await call();
    expect(res.status).toBe(200);
    expect(new Set(calls)).toEqual(new Set([OLD]));
  });

  it('moves to the second key when the first is refused for credit (402), in the same request', async () => {
    answers[OLD] = 402;
    const call = await fastToken();
    const [res] = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sttToken).toBe(`tok-for-${NEW}`);
    expect(body.ttsToken).toBe(`tok-for-${NEW}`);
  });

  it.each([401, 403, 404, 429])('also fails over on %i', async (status) => {
    answers[OLD] = status;
    const call = await fastToken();
    const [res] = await call();
    expect(res.status).toBe(200);
    expect((await res.json()).sttToken).toBe(`tok-for-${NEW}`);
  });

  it('lets the spent key rest: the next requests go straight to the second key', async () => {
    answers[OLD] = 402;
    const call = await fastToken();
    await call();
    calls.length = 0;
    const [res] = await call();
    expect(res.status).toBe(200);
    expect(calls.includes(OLD)).toBe(false);
  });

  it('says the shared allowance is used up when every key is refused', async () => {
    answers[OLD] = 402;
    answers[NEW] = 402;
    const call = await fastToken();
    const [res] = await call();
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('quota');
  });

  it('does not retry on a server error: that is not a spent key', async () => {
    answers[OLD] = 500;
    const call = await fastToken();
    const [res] = await call();
    expect(res.status).toBe(502);
    expect(calls.includes(NEW)).toBe(false);
  });

  it('the voice-agent token route fails over the same way', async () => {
    answers[OLD] = 402;
    vi.resetModules();
    (await import('@/lib/security/apiGuard')).resetSecurityStateForTests();
    const route = await import('@/app/api/voice/token/route');
    const res = await route.GET(new NextRequest('http://localhost/api/voice/token'));
    expect(res.status).toBe(200);
    expect(calls).toContain(NEW);
  });
});
