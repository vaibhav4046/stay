import { NextRequest, NextResponse } from 'next/server';
import { getNextAssemblyAiKey } from '@/lib/voice/tokenOptimizer';
import { clientIp } from '@/lib/llm/provider';

const hits = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 25) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

/**
 * Fast voice: two short-lived AssemblyAI tokens, one for streaming speech-to-text and one for streaming text-to-speech.
 * The browser connects to AssemblyAI directly with them; the account key never leaves the server (or the person's own key
 * arrives in a header and is used once).
 */
export async function POST(req: NextRequest) {
  const userKey = req.headers.get('x-stay-aai-key')?.trim() || '';
  const hasUserKey = /^[\w-]{16,200}$/.test(userKey);
  if (!hasUserKey && !allow(clientIp(req))) {
    return NextResponse.json({ code: 'rate_limited', error: 'Too many voice sessions. Wait a few minutes or use Quiet Text Mode.' }, { status: 429 });
  }
  const key = hasUserKey ? userKey : getNextAssemblyAiKey() || process.env.ASSEMBLYAI_API_KEY;
  if (!key) return NextResponse.json({ code: 'quota', error: 'Server voice credentials are not configured. Add your own AssemblyAI key in Settings, or use Quiet Text Mode.' }, { status: 503 });

  // three-hour sessions only on the person's own allowance; default max_session_duration_seconds is 3600
  const long = req.nextUrl.searchParams.get('long') === '1' && hasUserKey;
  const sttUrl = `https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=${long ? 10800 : 3600}`;
  const ttsUrl = `https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=3600`;
  try {
    const mint = async (targetUrl: string) => {
      const r = await fetch(targetUrl, { headers: { Authorization: key }, cache: 'no-store' });
      if (!r.ok) throw Object.assign(new Error('mint'), { status: r.status });
      return ((await r.json()) as { token?: string }).token;
    };
    const [sttToken, ttsToken] = await Promise.all([mint(sttUrl), mint(ttsUrl)]);
    if (!sttToken || !ttsToken) return NextResponse.json({ error: 'Invalid token response from voice provider.' }, { status: 502 });
    return NextResponse.json({ sttToken, ttsToken, keySource: hasUserKey ? 'user' : 'server' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status && [401, 402, 403, 429].includes(status)) {
      return NextResponse.json(
        { code: hasUserKey ? 'invalid_user_key' : 'quota', error: hasUserKey ? 'AssemblyAI rejected your key. Check it in Settings.' : 'The shared voice allowance is used up for now. Add your own AssemblyAI key in Settings, or use Quiet Text Mode.' },
        { status: 429 },
      );
    }
    return NextResponse.json({ error: 'Could not reach the voice provider. Quiet Text Mode remains available.' }, { status: 502 });
  }
}
