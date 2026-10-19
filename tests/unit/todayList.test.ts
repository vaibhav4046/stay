import { beforeEach, describe, expect, it } from 'vitest';
import { addToday, loadToday, moveToday, openToday, removeToday, rollover, toggleToday, winsToday, type TodayItem } from '@/lib/coach/todayList';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: new MemStorage() };
});
const D = (s: string) => new Date(s);

describe('today list', () => {
  it('adds newest first, ignores blanks and open duplicates', () => {
    addToday([{ text: 'email landlord', bucket: 'now' }], D('2026-10-19T09:00:00Z'));
    addToday([{ text: 'Email Landlord', bucket: 'today' }, { text: '  ', bucket: 'today' }, { text: 'pay tax', bucket: 'today' }], D('2026-10-19T09:01:00Z'));
    expect(loadToday(D('2026-10-19T10:00:00Z')).map((i) => i.text)).toEqual(['pay tax', 'email landlord']);
  });
  it('toggles done, counts wins today, lists open items now-first', () => {
    const t = D('2026-10-19T09:00:00Z');
    addToday([{ text: 'a', bucket: 'today' }, { text: 'b', bucket: 'now' }, { text: 'c', bucket: 'later' }], t);
    const list = loadToday(t);
    const a = list.find((i) => i.text === 'a')!;
    const after = toggleToday(a.id, D('2026-10-19T11:00:00Z'));
    expect(winsToday(after, D('2026-10-19T12:00:00Z'))).toBe(1);
    expect(openToday(after).map((i) => i.text)).toEqual(['b']);
    expect(winsToday(toggleToday(a.id, D('2026-10-19T11:05:00Z')), D('2026-10-19T12:00:00Z'))).toBe(0); // untick
  });
  it('rolls yesterday\'s open items to later without shame, and drops old finished ones', () => {
    const mk = (over: Partial<TodayItem>): TodayItem => ({ id: String(Math.random()), text: 'x', bucket: 'today', done: false, createdAt: '2026-10-17T09:00:00Z', ...over });
    const out = rollover([mk({ text: 'open' }), mk({ text: 'later', bucket: 'later' }), mk({ text: 'old done', done: true, doneAt: '2026-10-16T09:00:00Z' }), mk({ text: 'fresh done', done: true, doneAt: '2026-10-18T20:00:00Z' })], D('2026-10-19T09:00:00Z'));
    expect(out.map((i) => i.text).sort()).toEqual(['fresh done', 'later', 'open']);
    expect(out.find((i) => i.text === 'open')?.bucket).toBe('later');
  });
  it('moves and removes, and survives corrupt storage', () => {
    const t = D('2026-10-19T09:00:00Z');
    const [only] = addToday([{ text: 'solo', bucket: 'today' }], t);
    expect(moveToday(only.id, 'later', t)[0].bucket).toBe('later');
    expect(removeToday(only.id, t)).toEqual([]);
    (globalThis as unknown as { window: { localStorage: MemStorage } }).window.localStorage.setItem('stay_today_list_v1', '{nope');
    expect(loadToday(t)).toEqual([]);
  });
});
