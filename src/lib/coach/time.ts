/** Local-clock helpers shared by the greeting, the day planner and the learnings (the person's day, not UTC's). */
export type PartOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD on the local clock. */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localDayOf(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : localDay(d);
}

export function yesterdayOf(now: Date): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12);
  return localDay(d);
}

export function partOfDay(hour: number): PartOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

export const daysBetween = (fromMs: number, toMs: number) => Math.max(0, (toMs - fromMs) / 86_400_000);
