import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { authorised } from '@/lib/push/auth';
import { dueSlot, messageFor, RING_MESSAGE, RING_STALE_MS } from '@/lib/push/schedule';
import { listRecords, pushStoreConfigured, removeRecord, saveRecord, type PushRecord } from '@/lib/push/store';
import { pushSendConfigured, sendPush } from '@/lib/push/send';

/** Called once an hour by a scheduled GitHub Action (.github/workflows/push-tick.yml) with a shared secret. Sends whichever messages are due. */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CONCURRENCY = 8;

const seedOf = (endpoint: string) => crypto.createHash('sha256').update(endpoint).digest().readUInt16BE(0);

/** A timer ping the chain did not deliver (src/lib/push/ring.ts): sent late if it is still worth it, dropped if it is stale. Returns the record to carry on with. */
async function lateRing(rec: PushRecord, now: Date): Promise<{ rec: PushRecord; result?: 'sent' | 'removed' | 'failed' }> {
  if (!rec.ringAt || now.getTime() < rec.ringAt) return { rec };
  const cleared: PushRecord = { ...rec, ringAt: undefined };
  if (now.getTime() - rec.ringAt > RING_STALE_MS) {
    await saveRecord(cleared); // too late to be useful: forget it quietly
    return { rec: cleared };
  }
  const result = await sendPush(rec.sub, RING_MESSAGE, 'timer');
  if (result === 'gone') {
    await removeRecord(rec.sub.endpoint).catch(() => undefined);
    return { rec, result: 'removed' };
  }
  if (result !== 'ok') return { rec, result: 'failed' };
  await saveRecord(cleared);
  return { rec: cleared, result: 'sent' };
}

async function tickOne(original: PushRecord, now: Date): Promise<'sent' | 'idle' | 'removed' | 'failed'> {
  const late = await lateRing(original, now);
  if (late.result) return late.result;
  const rec = late.rec;
  if (rec.snoozeUntil && now.getTime() < rec.snoozeUntil) return 'idle'; // paused by the person
  const slot = dueSlot(now, rec.tz, rec.sent, rec.prefs);
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
