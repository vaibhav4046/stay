import { NextRequest, NextResponse } from 'next/server';
import { assemblyKeyRefused, assemblyRestMs, getNextAssemblyAiKey, reportAssemblyAiKeyRateLimit } from '@/lib/voice/tokenOptimizer';
import { attachGuardHeaders, guardPaidRoute } from '@/lib/security/apiGuard';

/**
 * Fast voice: two short-lived AssemblyAI tokens, one for streaming speech-to-text and one for streaming text-to-speech.
 * The browser connects to AssemblyAI directly with them; the account key never leaves the server (or the person's own key
 * arrives in a header and is used once).
 */
export async function POST(req: NextRequest) {
  const guard = guardPaidRoute(req, 'token');
  if (!guard.ok && guard.response) return guard.response;

  const userKey = req.headers.get('x-stay-aai-key')?.trim() || '';
  const hasUserKey = /^[\w-]{16,200}$/.test(userKey);
  const key = hasUserKey ? userKey : getNextAssemblyAiKey() || process.env.ASSEMBLYAI_API_KEY;
  if (!key) {
    return attachGuardHeaders(
      NextResponse.json(
        {
          code: 'quota',
          error:
            'Server voice credentials are not configured. Add your own AssemblyAI key in Settings, or use Quiet Text Mode.',
        },
        { status: 503 }
      ),
      guard
    );
  }

  // three-hour sessions only on the person's own allowance; default max_session_duration_seconds is 3600
  const long = req.nextUrl.searchParams.get('long') === '1' && hasUserKey;
  const sttUrl = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=${long ? 10800 : 3600}`;
  const ttsUrl = `https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=3600`;
  try {
    const mint = async (apiKey: string, targetUrl: string) => {
      const r = await fetch(targetUrl, { headers: { Authorization: apiKey }, cache: 'no-store' });
      if (!r.ok) throw Object.assign(new Error('mint'), { status: r.status });
      return ((await r.json()) as { token?: string }).token;
    };
    // a shared key that AssemblyAI refuses (credit spent, rate limit) rests, and the next key in the list takes over
    let apiKey = key;
    let tokens: [string | undefined, string | undefined] | null = null;
    for (let attempt = 0; attempt < 3 && !tokens; attempt++) {
      try {
        tokens = await Promise.all([mint(apiKey, sttUrl), mint(apiKey, ttsUrl)]);
      } catch (e) {
        const status = (e as { status?: number }).status ?? 0;
        if (hasUserKey || !assemblyKeyRefused(status)) throw e;
        reportAssemblyAiKeyRateLimit(apiKey, assemblyRestMs(status));
        const next = getNextAssemblyAiKey();
        if (!next || next === apiKey) throw e;
        apiKey = next;
      }
    }
    if (!tokens) throw Object.assign(new Error('mint'), { status: 429 });
    const [sttToken, ttsToken] = tokens;
    if (!sttToken || !ttsToken) {
      return attachGuardHeaders(
        NextResponse.json({ error: 'Invalid token response from voice provider.' }, { status: 502 }),
        guard
      );
    }
    return attachGuardHeaders(
      NextResponse.json(
        { sttToken, ttsToken, keySource: hasUserKey ? 'user' : 'server' },
        { headers: { 'Cache-Control': 'no-store' } }
      ),
      guard
    );
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status && [401, 402, 403, 429].includes(status)) {
      return attachGuardHeaders(
        NextResponse.json(
          {
            code: hasUserKey ? 'invalid_user_key' : 'quota',
            error: hasUserKey
              ? 'AssemblyAI rejected your key. Check it in Settings.'
              : 'The shared voice allowance is used up for now. Add your own AssemblyAI key in Settings, or use Quiet Text Mode.',
          },
          { status: 429, headers: { 'Retry-After': '60' } }
        ),
        guard
      );
    }
    return attachGuardHeaders(
      NextResponse.json(
        { error: 'Could not reach the voice provider. Quiet Text Mode remains available.' },
        { status: 502 }
      ),
      guard
    );
  }
}
