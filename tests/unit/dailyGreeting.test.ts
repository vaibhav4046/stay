import { beforeEach, describe, expect, it } from 'vitest';
import type { CoachSessionRecord } from '@/types/domain';
import type { TodayItem } from '@/lib/coach/todayList';
import { BANNED_PHRASES, buildDailyGreeting, countWinsYesterday, greetingCardDue, greetingSpokenDue, isCalm, markGreetingDismissed, markGreetingSpoken, openFromBefore } from '@/lib/coach/dailyGreeting';

const store = new Map<string, string>();
// @ts-expect-error node test shim
globalThis.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } };
beforeEach(() => store.clear());

const at = (day: number, hour: number) => new Date(2026, 9, day, hour, 15);
const item = (o: Partial<TodayItem>): TodayItem => ({ id: 'i', text: 'x', bucket: 'today', done: false, createdAt: at(17, 10).toISOString(), ...o });

describe('content rules: calm, no guilt', () => {
  it('bans the guilt words', () => {
    for (const w of ['overdue', 'behind', 'failed', 'lazy', 'streak lost', 'should have']) expect(BANNED_PHRASES).toContain(w);
    expect(isCalm('You are behind on this')).toBe(false);
    expect(isCalm('Your streak lost its glow')).toBe(false);
    expect(isCalm('Glad you are here')).toBe(true);
  });

  it('no generated greeting, over 60 days x names x data x hours, contains a banned phrase', () => {
    for (let day = 0; day < 60; day++) {
      for (const hour of [6, 10, 14, 19, 23, 3]) {
        for (const name of [null, 'Sam', 'Alexandria-Marie']) {
          for (const wins of [0, 1, 4]) {
            for (const open of [[], ['Reply to the landlord'], ['Fix the report and email Dan about the long overdue invoice']]) {
              const now = new Date(2026, 8, 1 + day, hour, 5);
              for (const quiet of [false, true]) {
                const g = buildDailyGreeting({ now, name, winsYesterday: wins, openFromBefore: open, quiet });
                expect(isCalm(g.text), g.text).toBe(true);
                expect(isCalm(g.spoken), g.spoken).toBe(true);
                expect(g.options.every((o) => isCalm(o.label))).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('offers two to three soft options and ends in a question', () => {
    const g = buildDailyGreeting({ now: at(19, 9), name: 'Sam', winsYesterday: 2, openFromBefore: [], quiet: false });
    expect(g.options.length).toBeGreaterThanOrEqual(2);
    expect(g.options.length).toBeLessThanOrEqual(3);
    expect(g.text).toMatch(/\?$/);
    expect(g.spoken).toMatch(/\?$/);
    expect(g.spoken.split(/\s+/).length).toBeLessThanOrEqual(40);
  });
});

describe('uses only what is real', () => {
  it('names the person, yesterday\'s real win count and one open item', () => {
    const g = buildDailyGreeting({ now: at(19, 9), name: 'Sam', winsYesterday: 3, openFromBefore: ['Reply to the landlord', 'Second thing'], quiet: false });
    expect(g.text).toContain('Sam');
    expect(g.text).toMatch(/\b3\b|three/);
    expect(g.text).toContain('Reply to the landlord');
    expect(g.text).not.toContain('Second thing'); // one item, never a pile
    expect(g.options.some((o) => o.id === 'resume' && o.label.includes('Reply to the'))).toBe(true);
  });

  it('says nothing about wins or open items when there are none (no invented praise, no "you did nothing")', () => {
    const g = buildDailyGreeting({ now: at(19, 9), name: null, winsYesterday: 0, openFromBefore: [], quiet: false });
    expect(g.text).not.toMatch(/yesterday|win|finished|still here|waiting/i);
    expect(g.options.some((o) => o.id === 'resume')).toBe(false);
  });

  it('changes tone and options with the time of day', () => {
    const base = { name: null, winsYesterday: 0, openFromBefore: [], quiet: false };
    expect(buildDailyGreeting({ ...base, now: at(19, 8) }).text).toMatch(/morning/i);
    expect(buildDailyGreeting({ ...base, now: at(19, 14) }).text).toMatch(/afternoon|Hello|Hi|Glad/);
    expect(buildDailyGreeting({ ...base, now: at(19, 18) }).options.map((o) => o.id)).toContain('wrap');
    const night = buildDailyGreeting({ ...base, now: at(19, 23) });
    expect(night.text).toMatch(/late|quiet hour|this hour/i);
    expect(night.options.map((o) => o.id)).not.toContain('plan_day');
  });

  it('varies from day to day', () => {
    const texts = new Set(Array.from({ length: 14 }, (_, d) => buildDailyGreeting({ now: at(1 + d, 9), name: 'Sam', winsYesterday: 2, openFromBefore: ['Taxes'], quiet: false }).text));
    expect(texts.size).toBeGreaterThanOrEqual(4);
  });

  it('is stable within a day (a reload does not reshuffle)', () => {
    const a = buildDailyGreeting({ now: at(19, 9), name: 'Sam', winsYesterday: 2, openFromBefore: [], quiet: false });
    const b = buildDailyGreeting({ now: at(19, 11), name: 'Sam', winsYesterday: 2, openFromBefore: [], quiet: false });
    expect(a.text).toBe(b.text);
  });
});

describe('quiet mode', () => {
  it('shows text but never speaks', () => {
    const g = buildDailyGreeting({ now: at(19, 9), name: 'Sam', winsYesterday: 1, openFromBefore: [], quiet: true });
    expect(g.text.length).toBeGreaterThan(10);
    expect(g.spoken).toBe('');
  });
});

describe('inputs from the real list and blocks', () => {
  const now = at(19, 9);
  it('counts yesterday\'s finished items plus yesterday\'s started blocks, local day', () => {
    const items = [item({ done: true, doneAt: at(18, 15).toISOString() }), item({ done: true, doneAt: at(18, 23).toISOString() }), item({ done: true, doneAt: at(17, 15).toISOString() }), item({ done: true, doneAt: at(19, 8).toISOString() })];
    const s = [{ createdAt: at(18, 10).toISOString(), outcome: 'started' }, { createdAt: at(18, 11).toISOString(), outcome: 'not_started' }, { createdAt: at(18, 12).toISOString(), outcome: 'partly_started', isSample: true }] as CoachSessionRecord[];
    expect(countWinsYesterday(items, s, now)).toBe(3);
  });
  it('lists open items from before today, newest first', () => {
    const items = [item({ text: 'old', createdAt: at(15, 9).toISOString() }), item({ text: 'yesterday', createdAt: at(18, 9).toISOString() }), item({ text: 'now', createdAt: at(19, 7).toISOString() }), item({ text: 'done', done: true, createdAt: at(18, 9).toISOString() })];
    expect(openFromBefore(items, now)).toEqual(['yesterday', 'old']);
  });
});

describe('once a day', () => {
  it('card and speech are due until marked, then not again the same day, but due tomorrow', () => {
    expect(greetingCardDue(at(19, 9))).toBe(true);
    expect(greetingSpokenDue(at(19, 9))).toBe(true);
    markGreetingSpoken(at(19, 9));
    expect(greetingSpokenDue(at(19, 20))).toBe(false);
    expect(greetingCardDue(at(19, 20))).toBe(true); // speaking is separate from dismissing the card
    markGreetingDismissed(at(19, 9));
    expect(greetingCardDue(at(19, 20))).toBe(false);
    expect(greetingCardDue(at(20, 8))).toBe(true);
    expect(greetingSpokenDue(at(20, 8))).toBe(true);
  });
});
