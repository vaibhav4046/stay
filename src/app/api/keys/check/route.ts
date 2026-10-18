import { NextRequest, NextResponse } from 'next/server';
import { checkUserLlm, clientIp } from '@/lib/llm/provider';

const hits = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 12) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

/** Checks a person's own key with one tiny call. The key arrives in headers, is used once, and is never stored or logged. */
export async function POST(req: NextRequest) {
  if (!allow(clientIp(req))) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { target?: string } | null;

  if (body?.target === 'assembly') {
    const key = req.headers.get('x-stay-aai-key')?.trim() || '';
    if (!/^[\w-]{16,200}$/.test(key)) return NextResponse.json({ ok: false, error: 'invalid_key' });
    try {
      const r = await fetch('https://agents.assemblyai.com/v1/token?expires_in_seconds=60&max_session_duration_seconds=60', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
      if (r.ok) return NextResponse.json({ ok: true });
      return NextResponse.json({ ok: false, error: r.status === 429 || r.status === 402 ? 'quota' : r.status === 401 || r.status === 403 ? 'invalid_key' : 'other' });
    } catch {
      return NextResponse.json({ ok: false, error: 'unreachable' });
    }
  }

  return NextResponse.json(await checkUserLlm(req));
}
