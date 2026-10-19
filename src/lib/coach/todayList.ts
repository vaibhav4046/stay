/**
 * Today's list: what came out of a brain dump, plus anything added by voice. Local only.
 * No guilt: an unfinished item from yesterday quietly moves to "later" instead of piling up as "overdue".
 */
export type Bucket = 'now' | 'today' | 'later';

export interface TodayItem {
  id: string;
  text: string;
  bucket: Bucket;
  done: boolean;
  createdAt: string;
  doneAt?: string;
  firstStep?: string;
  minutes?: number;
}

export const TODAY_KEY = 'stay_today_list_v1';
const MAX_ITEMS = 60;
const dayOf = (iso: string) => iso.slice(0, 10);

export function loadToday(now = new Date()): TodayItem[] {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(TODAY_KEY);
    const list = raw ? (JSON.parse(raw) as TodayItem[]) : [];
    if (!Array.isArray(list)) return [];
    return rollover(list.filter((i) => i && typeof i.id === 'string' && typeof i.text === 'string'), now);
  } catch {
    return [];
  }
}

/** Yesterday's open "now" and "today" items become "later"; finished items older than two days are dropped. */
export function rollover(list: TodayItem[], now = new Date()): TodayItem[] {
  const today = dayOf(now.toISOString());
  const cutoff = now.getTime() - 2 * 86_400_000;
  return list
    .filter((i) => !i.done || new Date(i.doneAt || i.createdAt).getTime() >= cutoff)
    .map((i) => (!i.done && i.bucket !== 'later' && dayOf(i.createdAt) < today ? { ...i, bucket: 'later' as const } : i));
}

function save(list: TodayItem[]): TodayItem[] {
  const trimmed = list.slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(TODAY_KEY, JSON.stringify(trimmed));
  } catch {
    // private mode: kept for this page only
  }
  return trimmed;
}

let seq = 0;
const newId = (now: Date) => `t-${now.getTime()}-${seq++}-${Math.random().toString(36).slice(2, 5)}`;

/** Adds items (newest first). Case-insensitive duplicates of an open item are ignored. */
export function addToday(items: Array<Pick<TodayItem, 'text' | 'bucket'> & Partial<TodayItem>>, now = new Date()): TodayItem[] {
  const list = loadToday(now);
  const open = new Set(list.filter((i) => !i.done).map((i) => i.text.toLowerCase()));
  const fresh: TodayItem[] = [];
  for (const it of items) {
    const text = it.text.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!text || open.has(text.toLowerCase())) continue;
    open.add(text.toLowerCase());
    fresh.push({ id: newId(now), text, bucket: it.bucket, done: false, createdAt: now.toISOString(), firstStep: it.firstStep, minutes: it.minutes });
  }
  return save([...fresh, ...list]);
}

export function toggleToday(id: string, now = new Date()): TodayItem[] {
  return save(loadToday(now).map((i) => (i.id === id ? { ...i, done: !i.done, doneAt: i.done ? undefined : now.toISOString() } : i)));
}

export function removeToday(id: string, now = new Date()): TodayItem[] {
  return save(loadToday(now).filter((i) => i.id !== id));
}

export function moveToday(id: string, bucket: Bucket, now = new Date()): TodayItem[] {
  return save(loadToday(now).map((i) => (i.id === id ? { ...i, bucket } : i)));
}

export function winsToday(list: TodayItem[], now = new Date()): number {
  const today = dayOf(now.toISOString());
  return list.filter((i) => i.done && i.doneAt && dayOf(i.doneAt) === today).length;
}

/** The open items to show now: the "now" item first, then today's. */
export function openToday(list: TodayItem[]): TodayItem[] {
  const rank = { now: 0, today: 1, later: 2 } as const;
  return list.filter((i) => !i.done && i.bucket !== 'later').sort((a, b) => rank[a.bucket] - rank[b.bucket]);
}
