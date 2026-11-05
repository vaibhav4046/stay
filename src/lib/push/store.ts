/**
 * Push subscriptions in a private Vercel Blob store: one small JSON per browser, named by a hash of its endpoint. What is kept:
 * the push address and keys the browser gave us, its time zone, when it joined and which windows were already sent today.
 * No name, no tasks, no voice, no text of any kind.
 */
import crypto from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';
import type { PushSubscriptionJson } from './validate';
import type { SentLog, SlotPrefs } from './schedule';

export interface PushRecord {
  sub: PushSubscriptionJson;
  tz: string;
  created: number;
  sent: SentLog;
  /** Which windows are wanted (both when absent) and when a pause ends (none when absent). */
  prefs?: SlotPrefs;
  snoozeUntil?: number;
  /** When the focus block the person started ends (ms since 1970); the ring is sent then, and cleared. */
  ringAt?: number;
}

const PREFIX = 'push/';
const MAX_PAGES = 5; // ponytail: 5000 subscriptions per tick; shard by time zone if Stay ever outgrows that
const pathFor = (endpoint: string) => `${PREFIX}${crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 40)}.json`;

export const pushStoreConfigured = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function saveRecord(rec: PushRecord): Promise<void> {
  await put(pathFor(rec.sub.endpoint), JSON.stringify(rec), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
}

export async function removeRecord(endpoint: string): Promise<void> {
  await del(pathFor(endpoint));
}

async function read(pathname: string): Promise<PushRecord | null> {
  const res = await get(pathname, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200 || !res.stream) return null;
  try {
    return JSON.parse(await new Response(res.stream).text()) as PushRecord;
  } catch {
    return null;
  }
}

export const readRecord = (endpoint: string) => read(pathFor(endpoint));

export async function listRecords(): Promise<PushRecord[]> {
  const out: PushRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await list({ prefix: PREFIX, limit: 1000, cursor });
    const recs = await Promise.all(res.blobs.map((b) => read(b.pathname).catch(() => null)));
    out.push(...recs.filter((r): r is PushRecord => r !== null));
    if (!res.hasMore) break;
    cursor = res.cursor;
  }
  return out;
}
