import { afterEach, describe, expect, it, vi } from 'vitest';
import { openLlmStream } from '@/lib/llm/stream';

const call = { messages: [{ role: 'user', content: 'hi' }], maxTokens: 20, temperature: 0.5, serverModel: 'openai/gpt-oss-120b', timeoutMs: 3000 };
const req = () => new Request('http://localhost/api/voice/chat', { method: 'POST', headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 200)}` } });

describe('openLlmStream model fallback', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tries a sibling model when the main one is out of tokens for the minute', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-1234567890');
    const models: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      const model = JSON.parse(init.body).model as string;
      models.push(model);
      return model === 'openai/gpt-oss-120b' ? new Response('{}', { status: 429 }) : new Response('data: [DONE]\n\n', { status: 200 });
    }));
    const r = await openLlmStream(req(), call);
    expect(r.res).not.toBeNull();
    expect(models).toContain('openai/gpt-oss-120b');
    expect(models.at(-1)).toBe('openai/gpt-oss-20b');
  });

  it('reports quota when every model is spent', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-1234567890');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));
    const r = await openLlmStream(req(), call);
    expect(r.res).toBeNull();
    expect(r.error).toBe('quota');
  });

  it('then a third model, which has its own per-minute bucket', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-1234567890');
    const models: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      const model = JSON.parse(init.body).model as string;
      models.push(model);
      return model === 'qwen/qwen3.8-27b' ? new Response('data: [DONE]\n\n', { status: 200 }) : new Response('{}', { status: 429 });
    }));
    const r = await openLlmStream(req(), call);
    expect(r.res).not.toBeNull();
    expect(models).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b']);
  });

  it('when every bucket is spent but one refills within a moment, it waits that moment and answers instead of failing', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-1234567890');
    let spent = 3; // the first three attempts are refused, the fourth (after the wait) goes through
    const t0 = Date.now();
    vi.stubGlobal('fetch', vi.fn(async () => (spent-- > 0 ? new Response('{}', { status: 429, headers: { 'retry-after': '0.2' } }) : new Response('data: [DONE]\n\n', { status: 200 }))));
    const r = await openLlmStream(req(), call);
    expect(r.res).not.toBeNull();
    expect(Date.now() - t0).toBeGreaterThanOrEqual(190);
  });

  it('does not make the person wait when the bucket is spent for a long time', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-1234567890');
    const fetchMock = vi.fn(async () => new Response('{}', { status: 429, headers: { 'retry-after': '40' } }));
    vi.stubGlobal('fetch', fetchMock);
    const t0 = Date.now();
    const r = await openLlmStream(req(), call);
    expect(r.res).toBeNull();
    expect(r.error).toBe('quota');
    expect(Date.now() - t0).toBeLessThan(1500);
    expect(fetchMock).toHaveBeenCalledTimes(3); // the three models, no extra try
  });
});
