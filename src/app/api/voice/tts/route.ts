import { NextRequest, NextResponse } from 'next/server';
import { AZURE_OUTPUT_FORMAT, AZURE_REGION_RE, MAX_TTS_CHARS, azureEndpoint, buildSsml } from '@/lib/voice/tts/ssml';
import { attachGuardHeaders, guardPaidRoute, readBoundedJson } from '@/lib/security/apiGuard';

/**
 * Bring-your-own-key speech: Azure AI Speech. The person's key arrives in a header, is used for this one request and
 * is never stored or logged. Stay's server only relays (the key is not meant to sit in browser code and Azure's REST
 * endpoint is not a browser API). The reply is raw 24 kHz 16-bit mono PCM, streamed as Azure produces it.
 *
 * NOT yet exercised against a live Azure key (none was available when this was written): the request shape follows
 * Microsoft's documented REST API for text to speech.
 */
export async function POST(req: NextRequest) {
  const guard = guardPaidRoute(req, 'tts');
  if (!guard.ok && guard.response) return guard.response;

  const key = req.headers.get('x-stay-tts-key')?.trim() || '';
  const region = (req.headers.get('x-stay-tts-region')?.trim() || '').toLowerCase();
  if (!/^[\w-]{16,200}$/.test(key) || !AZURE_REGION_RE.test(region)) {
    return attachGuardHeaders(
      NextResponse.json(
        { code: 'invalid_tts_key', error: 'Add your Azure Speech key and region in Settings, voice.' },
        { status: 400 }
      ),
      guard
    );
  }

  const parsed = await readBoundedJson<{ text?: unknown; voice?: unknown; locale?: unknown }>(req, 32_768);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > MAX_TTS_CHARS) {
    return attachGuardHeaders(
      NextResponse.json({ error: 'text must be 1 to 800 characters' }, { status: 400 }),
      guard
    );
  }

  let ssml: string;
  try {
    ssml = buildSsml({ text, voice: String(body.voice ?? ''), locale: String(body.locale ?? '') });
  } catch {
    return NextResponse.json({ error: 'bad voice or locale' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(azureEndpoint(region), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': AZURE_OUTPUT_FORMAT,
        'User-Agent': 'Stay',
      },
      body: ssml,
      signal: AbortSignal.timeout(15_000),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ code: 'unreachable', error: 'Could not reach Azure Speech. Check the region.' }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const bad = [401, 403].includes(upstream.status);
    return NextResponse.json(
      { code: bad ? 'invalid_tts_key' : upstream.status === 429 ? 'rate_limited' : 'upstream', error: bad ? 'Azure rejected your key or region. Check them in Settings.' : 'Azure Speech could not speak that.' },
      { status: bad ? 401 : upstream.status === 429 ? 429 : 502 },
    );
  }
  return new Response(upstream.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store, max-age=0', 'X-Stay-Pcm': '24000-s16le-mono' } });
}
