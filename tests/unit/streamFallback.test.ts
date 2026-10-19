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
});
