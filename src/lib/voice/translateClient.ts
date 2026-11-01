/**
 * Client for /api/voice/translate.
 *
 * The route only ever returns a real translation or an explicit "unavailable".
 * There is no echo fallback, so nothing here fabricates a translated string:
 * a failed attempt is carried through as `unavailable` and rendered as such.
 */

export type TranslationAttempt =
  | { status: 'ok'; text: string; source: string; targetLanguage: string }
  | { status: 'unavailable'; reason: string; targetLanguage: string };

export type TranslationEntry = { status: 'pending' } | TranslationAttempt;

interface TranslateResponse {
  translatedText?: unknown;
  targetLanguage?: unknown;
  source?: unknown;
  error?: unknown;
  reason?: unknown;
}

export async function translateText(
  text: string,
  targetLanguage: string,
  fetchImpl: typeof fetch = fetch
): Promise<TranslationAttempt> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: 'unavailable', reason: 'empty_input', targetLanguage };
  }

  let res: Response;
  try {
    res = await fetchImpl('/api/voice/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, targetLanguage }),
    });
  } catch {
    return { status: 'unavailable', reason: 'network', targetLanguage };
  }

  let data: TranslateResponse = {};
  try {
    data = (await res.json()) as TranslateResponse;
  } catch {
    data = {};
  }

  if (!res.ok) {
    const reason =
      typeof data.error === 'string'
        ? data.error
        : typeof data.reason === 'string'
          ? data.reason
          : `http_${res.status}`;
    return { status: 'unavailable', reason, targetLanguage };
  }

  if (typeof data.translatedText !== 'string' || !data.translatedText.trim()) {
    return { status: 'unavailable', reason: 'empty_translation', targetLanguage };
  }

  return {
    status: 'ok',
    text: data.translatedText.trim(),
    source: typeof data.source === 'string' ? data.source : 'llm',
    targetLanguage:
      typeof data.targetLanguage === 'string' ? data.targetLanguage : targetLanguage,
  };
}
