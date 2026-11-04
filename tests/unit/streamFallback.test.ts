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

  it('tries the next model when one answers with an error (real-model hour: 2 of 189 turns got HTTP 400 and said "could not reach my thinking service")', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-1234567890');
    const models: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      const model = JSON.parse(init.body).model as string;
      models.push(model);
      return model === 'openai/gpt-oss-120b' ? new Response('{"error":{"code":"tool_use_failed"}}', { status: 400 }) : new Response('data: [DONE]\n\n', { status: 200 });
    }));
    const r = await openLlmStream(req(), call);
    expect(r.res).not.toBeNull();
    expect(models).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b']);
  });

  it('when every Groq bucket refuses, a configured second provider takes the turn', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-1234567890');
    vi.stubEnv('STAY_FALLBACK_LLM_BASE', 'https://fallback.example.com/v1');
    vi.stubEnv('STAY_FALLBACK_LLM_KEY', 'fallback-key-1234567890');
    vi.stubEnv('STAY_FALLBACK_LLM_MODEL', 'some-model');
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url);
      return url.includes('fallback.example.com') ? new Response('data: [DONE]\n\n', { status: 200 }) : new Response('{}', { status: 429 });
    }));
    const r = await openLlmStream(req(), call);
    expect(r.res).not.toBeNull();
    expect(urls.at(-1)).toContain('fallback.example.com');
    vi.unstubAllEnvs();
  });

  it('a second provider at a private address is never used', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-key-1234567890');
    vi.stubEnv('STAY_FALLBACK_LLM_BASE', 'http://127.0.0.1:9999/v1');
    vi.stubEnv('STAY_FALLBACK_LLM_KEY', 'fallback-key-1234567890');
    vi.stubEnv('STAY_FALLBACK_LLM_MODEL', 'some-model');
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return new Response('{}', { status: 429 }); }));
    const r = await openLlmStream(req(), call);
    expect(r.res).toBeNull();
    expect(urls.some((u) => u.includes('127.0.0.1'))).toBe(false);
    vi.unstubAllEnvs();
  });

  it('with two keys, a spare model is tried on the second key too (gate run: 37% of turns refused while the second key had room)', async () => {
    vi.resetModules();
    vi.stubEnv('GROQ_API_KEYS', 'keyAAAA-1234567890,keyBBBB-1234567890');
    const { openLlmStream: open } = await import('@/lib/llm/stream');
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string; headers: Record<string, string> }) => {
      const model = JSON.parse(init.body).model as string;
      const key = init.headers.Authorization.includes('keyAAAA') ? 'A' : 'B';
      calls.push(`${model.split('/').pop()}@${key}`);
      // key A is spent on everything; key B is spent on the main model only
      return key === 'B' && model !== 'openai/gpt-oss-120b' ? new Response('data: [DONE]\n\n', { status: 200 }) : new Response('{}', { status: 429 });
    }));
    const r = await open(req(), call);
    expect(r.res).not.toBeNull();
    expect(calls.at(-1)).toMatch(/gpt-oss-20b@B|qwen3.8-27b@B/);
    expect(calls.filter((c) => c.endsWith('@A')).length).toBeGreaterThan(0);
    vi.unstubAllEnvs();
    vi.resetModules();
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
