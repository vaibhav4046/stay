import { describe, expect, it } from 'vitest';
import { translateText } from '@/lib/voice/translateClient';

function fakeFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return ((url: string, init?: RequestInit) => handler(String(url), init)) as unknown as typeof fetch;
}

describe('translateText (§8.3 honesty)', () => {
  it('posts the text and returns the real translation', async () => {
    let seen: { text?: unknown; targetLanguage?: unknown } = {};
    const fetchImpl = fakeFetch(async (_url, init) => {
      seen = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({ translatedText: 'Me siento abrumado', targetLanguage: 'es', source: 'server' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const result = await translateText('I feel overwhelmed', 'es', fetchImpl);

    expect(seen).toEqual({ text: 'I feel overwhelmed', targetLanguage: 'es' });
    expect(result).toEqual({
      status: 'ok',
      text: 'Me siento abrumado',
      source: 'server',
      targetLanguage: 'es',
    });
  });

  it('reports an unavailable provider instead of inventing a translation', async () => {
    const fetchImpl = fakeFetch(async () =>
      new Response(
        JSON.stringify({ error: 'translation_unavailable', reason: 'quota', source: 'unavailable' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const result = await translateText('I feel overwhelmed', 'es', fetchImpl);

    expect(result).toEqual({
      status: 'unavailable',
      reason: 'translation_unavailable',
      targetLanguage: 'es',
    });
    // The input must never come back looking translated.
    expect(JSON.stringify(result)).not.toContain('I feel overwhelmed');
  });

  it('treats a 200 with no translated text as unavailable', async () => {
    const fetchImpl = fakeFetch(async () =>
      new Response(JSON.stringify({ translatedText: '   ', source: 'server' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await translateText('hello', 'fr', fetchImpl);

    expect(result).toEqual({ status: 'unavailable', reason: 'empty_translation', targetLanguage: 'fr' });
  });

  it('treats a network failure as unavailable', async () => {
    const fetchImpl = fakeFetch(async () => {
      throw new Error('offline');
    });

    const result = await translateText('hello', 'de', fetchImpl);

    expect(result).toEqual({ status: 'unavailable', reason: 'network', targetLanguage: 'de' });
  });
});
