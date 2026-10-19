import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINES, addRoutine, findRoutine, loadRoutines, parseSteps, removeRoutine } from '@/lib/routines/routines';
import { addReminder, loadReminders, minutesUntil, removeReminder, takeDue } from '@/lib/reminders';

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: new MemStorage() };
});

describe('routines', () => {
  it('ships three built-in routines with real steps', () => {
    expect(DEFAULT_ROUTINES.map((r) => r.id)).toEqual(['morning', 'leaving', 'evening']);
    for (const r of DEFAULT_ROUTINES) expect(r.steps.length).toBeGreaterThanOrEqual(4);
  });
  it('parses typed steps with optional minutes, bullets and numbering', () => {
    expect(parseSteps('water and snack - 3\n2. phone in another room\n* open the notes (2)\nx')).toEqual([
      { text: 'water and snack', minutes: 3 },
      { text: 'phone in another room', minutes: 0 },
      { text: 'open the notes', minutes: 2 },
    ]);
    expect(parseSteps('')).toEqual([]);
  });
  it('finds a routine from natural speech', () => {
    expect(findRoutine('start my morning routine')?.id).toBe('morning');
    expect(findRoutine('help me get out of the door')?.id).toBe('leaving');
    expect(findRoutine('evening wind down')?.id).toBe('evening');
    expect(findRoutine('zzz nothing')).toBeNull();
  });
  it('saves and removes custom routines but never the built-ins', () => {
    const list = addRoutine('Study session', [{ text: 'open notes', minutes: 2 }], new Date('2026-10-19T10:00:00Z'));
    expect(list.map((r) => r.name)).toContain('Study session');
    expect(findRoutine('study session')?.name).toBe('Study session');
    const custom = list.find((r) => r.name === 'Study session')!;
    expect(removeRoutine(custom.id).some((r) => r.name === 'Study session')).toBe(false);
    expect(removeRoutine('morning').some((r) => r.id === 'morning')).toBe(true);
    expect(loadRoutines()).toHaveLength(3);
  });
  it('ignores a routine with no name or no steps', () => {
    expect(addRoutine('', [{ text: 'x', minutes: 1 }])).toHaveLength(3);
    expect(addRoutine('Empty', [])).toHaveLength(3);
  });
});

describe('reminders', () => {
  it('schedules, sorts by time, caps minutes, and removes', () => {
    const now = 1_000_000;
    addReminder(30, 'laundry', now);
    const { list } = addReminder(5, 'tea', now);
    expect(list.map((r) => r.text)).toEqual(['tea', 'laundry']);
    expect(addReminder(9999, 'x', now).reminder.dueAt - now).toBe(240 * 60_000);
    expect(removeReminder(list[0].id).map((r) => r.text)).not.toContain('tea');
  });
  it('takes only what is due, once, and drops anything more than an hour stale', () => {
    const now = 10_000_000;
    addReminder(5, 'soon', now - 6 * 60_000); // due a minute ago
    addReminder(1, 'ancient', now - 3 * 3_600_000);
    addReminder(60, 'later', now);
    const due = takeDue(now);
    expect(due.map((r) => r.text)).toEqual(['soon']);
    expect(takeDue(now)).toEqual([]);
    expect(loadReminders().map((r) => r.text)).toEqual(['later']);
  });
  it('reports minutes until due, never negative', () => {
    expect(minutesUntil({ id: 'a', text: 'x', dueAt: 61_000 }, 0)).toBe(2);
    expect(minutesUntil({ id: 'a', text: 'x', dueAt: 1 }, 100_000)).toBe(0);
  });
});
