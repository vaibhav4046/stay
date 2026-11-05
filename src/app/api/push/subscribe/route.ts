import { NextRequest, NextResponse } from 'next/server';
import { attachGuardHeaders, guardPaidRoute } from '@/lib/security/apiGuard';
import { isPushEndpoint, parseSubscription, parseTimeZone } from '@/lib/push/validate';
import { startLog, WELCOME } from '@/lib/push/schedule';
import { pushStoreConfigured, removeRecord, saveRecord } from '@/lib/push/store';
import { pushSendConfigured, sendPush, vapidPublicKey } from '@/lib/push/send';

/** Opt in to Stay's own check-ins when the app is closed. Nothing is stored until the person taps "on" in Settings. */
export const dynamic = 'force-dynamic';

const enabled = () => pushStoreConfigured() && pushSendConfigured();

/** The page asks first, so it can hide the switch where the server has no push set up. */
export function GET() {
  return NextResponse.json(enabled() ? { enabled: true, publicKey: vapidPublicKey() } : { enabled: false }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const guard = guardPaidRoute(req, 'push', { maxBytes: 4096 });
  if (!guard.ok && guard.response) return guard.response;
  const reply = (body: object, status = 200) => attachGuardHeaders(NextResponse.json(body, { status }), guard);
  if (!enabled()) return reply({ error: 'Check-ins are not set up on this server.' }, 503);

  const body = (await req.json().catch(() => null)) as { subscription?: unknown; tz?: unknown } | null;
  const sub = parseSubscription(body?.subscription);
  const tz = parseTimeZone(body?.tz);
  if (!sub || !tz) return reply({ error: 'That subscription was not valid.' }, 400);

  // The welcome message proves the whole path works before anything is promised; a dead address is not kept.
  const sent = await sendPush(sub, WELCOME, 'welcome');
  if (sent !== 'ok') return reply({ error: 'The push service did not accept the message.' }, 502);
  try {
    await saveRecord({ sub, tz, created: Date.now(), sent: startLog(new Date(), tz) });
  } catch {
    return reply({ error: 'Could not save your choice. Try again.' }, 503);
  }
  return reply({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const guard = guardPaidRoute(req, 'push', { maxBytes: 2048 });
  if (!guard.ok && guard.response) return guard.response;
  const reply = (body: object, status = 200) => attachGuardHeaders(NextResponse.json(body, { status }), guard);
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  if (!isPushEndpoint(body?.endpoint)) return reply({ error: 'That endpoint was not valid.' }, 400);
  try {
    if (enabled()) await removeRecord(body.endpoint);
  } catch {
    return reply({ error: 'Could not remove it. Try again.' }, 503);
  }
  return reply({ ok: true });
}
