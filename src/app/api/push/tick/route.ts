import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dueSlot, messageFor } from '@/lib/push/schedule';
import { listRecords, pushStoreConfigured, removeRecord, saveRecord, type PushRecord } from '@/lib/push/store';
import { pushSendConfigured, sendPush } from '@/lib/push/send';

/** Called every 15 minutes by a scheduled GitHub Action (.github/workflows/push-tick.yml) with a shared secret. Sends whichever messages are due. */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONCURRENCY = 8;

function authorised(req: NextRequest): boolean {
  const secret = process.env.PUSH_TICK_SECRET;
  if (!secret) return false;
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

const seedOf = (endpoint: string) => crypto.createHash('sha256').update(endpoint).digest().readUInt16BE(0);

async function tickOne(rec: PushRecord, now: Date): Promise<'sent' | 'idle' | 'removed' | 'failed'> {
  const slot = dueSlot(now, rec.tz, rec.sent);
  if (!slot) return 'idle';
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: rec.tz }).format(now);
  const result = await sendPush(rec.sub, messageFor(slot, day, seedOf(rec.sub.endpoint)), slot);
  if (result === 'gone') {
    await removeRecord(rec.sub.endpoint).catch(() => undefined);
    return 'removed';
  }
  if (result !== 'ok') return 'failed'; // not marked sent: the next tick inside the window tries again
  await saveRecord({ ...rec, sent: { day, slots: [...(rec.sent.day === day ? rec.sent.slots : []), slot] } });
  return 'sent';
}

export async function POST(req: NextRequest) {
  if (!process.env.PUSH_TICK_SECRET) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!pushStoreConfigured() || !pushSendConfigured()) return NextResponse.json({ error: 'Not configured.' }, { status: 503 });

  const now = new Date();
  const records = await listRecords();
  const tally = { subscribers: records.length, sent: 0, idle: 0, removed: 0, failed: 0 };
  for (let i = 0; i < records.length; i += CONCURRENCY) {
    const results = await Promise.all(records.slice(i, i + CONCURRENCY).map((r) => tickOne(r, now).catch(() => 'failed' as const)));
    for (const r of results) tally[r] += 1;
  }
  return NextResponse.json(tally, { headers: { 'Cache-Control': 'no-store' } });
}
