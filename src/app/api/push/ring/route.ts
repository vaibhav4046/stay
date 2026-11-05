import { after, NextRequest, NextResponse } from 'next/server';
import { authorised } from '@/lib/push/auth';
import { liveDeps, runRing } from '@/lib/push/ring';
import { RING_MAX_AHEAD_MS } from '@/lib/push/schedule';
import { isPushEndpoint } from '@/lib/push/validate';

/**
 * One run of the timer-ping chain (src/lib/push/ring.ts). It answers at once and does its waiting after the answer, so the run that called it
 * can finish; the next run is started by this one when it is not yet time. Only this app's own runs hold the secret.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!process.env.PUSH_TICK_SECRET) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown; ringAt?: unknown } | null;
  const ringAt = body?.ringAt;
  if (!isPushEndpoint(body?.endpoint) || typeof ringAt !== 'number' || !Number.isFinite(ringAt) || ringAt > Date.now() + RING_MAX_AHEAD_MS) {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  }
  const endpoint = body.endpoint;
  const origin = req.nextUrl.origin;
  after(() => runRing(endpoint, ringAt, liveDeps(origin)));
  return NextResponse.json({ ok: true }, { status: 202 });
}
