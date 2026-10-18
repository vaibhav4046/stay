/** The parking lot: where "oh, and I also need to..." goes so it stops competing with the one thing you are starting. Local only. */
export interface ParkedItem {
  id: string;
  text: string;
  at: string;
}

export const PARKING_KEY = 'stay_parking_lot';
const MAX_ITEMS = 50;
const MAX_LEN = 140;

export function loadParked(): ParkedItem[] {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(PARKING_KEY);
    const list = raw ? (JSON.parse(raw) as ParkedItem[]) : [];
    return Array.isArray(list) ? list.filter((i) => i && typeof i.text === 'string' && typeof i.id === 'string') : [];
  } catch {
    return [];
  }
}

function save(list: ParkedItem[]): ParkedItem[] {
  try {
    window.localStorage.setItem(PARKING_KEY, JSON.stringify(list));
  } catch {
    // private mode: kept for this page only
  }
  return list;
}

/** Adds a thought (newest first). Exact duplicates are ignored so repeating yourself does not pile up. */
export function parkThought(text: string, now = new Date()): ParkedItem[] {
  const t = text.replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  const list = loadParked();
  if (!t || list.some((i) => i.text.toLowerCase() === t.toLowerCase())) return list;
  return save([{ id: `p-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`, text: t, at: now.toISOString() }, ...list].slice(0, MAX_ITEMS));
}

export function unparkThought(id: string): ParkedItem[] {
  return save(loadParked().filter((i) => i.id !== id));
}
