import { beforeEach, describe, expect, it } from 'vitest';
import type { CoachSessionRecord } from '@/types/domain';
import { addToday, loadToday, TODAY_KEY, type TodayItem } from '@/lib/coach/todayList';
import { captureItems, classifyDumpUtterance, dropFromCapture, readBackLine } from '@/lib/coach/dumpSession';
import { applyListEdit, matchItem, parseListEdit } from '@/lib/coach/listEdit';
import { advanceSteps, breakDown, parseEnergyMinutes, parseWhen, pickResume, planDay, wrapUp } from '@/lib/coach/agentPlanner';
import { truthfulLine, verifySpoken } from '@/lib/voice/toolSelfCheck';
import { isCalm } from '@/lib/coach/dailyGreeting';

const store = new Map<string, string>();
// @ts-expect-error node test shim
globalThis.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } };
beforeEach(() => store.clear());

const NOW = new Date(2026, 9, 19, 10, 0);
const item = (text: string, o: Partial<TodayItem> = {}): TodayItem => ({ id: text, text, bucket: 'today', done: false, createdAt: NOW.toISOString(), ...o });

describe('dump capture controls', () => {
  it('recognises the end of a dump, with the last words kept', () => {
    expect(classifyDumpUtterance("That's it.")).toEqual({ kind: 'end', rest: '' });
    expect(classifyDumpUtterance('and the bins, okay that is all')).toEqual({ kind: 'end', rest: 'and the bins' });
    expect(classifyDumpUtterance("I'm done")).toMatchObject({ kind: 'end' });
    expect(classifyDumpUtterance('sort it out please')).toMatchObject({ kind: 'end' });
  });
  it('does not end on ordinary talk that merely contains those words', () => {
    expect(classifyDumpUtterance('I need to get the taxes done by Friday').kind).toBe('chunk');
    expect(classifyDumpUtterance('the report is almost finished but needs a chart').kind).toBe('chunk');
  });
  it('cancel, scratch that and drop X', () => {
    expect(classifyDumpUtterance('never mind').kind).toBe('cancel');
    expect(classifyDumpUtterance('scratch that').kind).toBe('scratch');
    expect(classifyDumpUtterance('remove the dentist')).toEqual({ kind: 'drop', target: 'the dentist'.replace('the ', '') });
  });
  it('strips filler from rambling and keeps the content', () => {
    expect(classifyDumpUtterance('um so like I need to uh call mum you know')).toEqual({ kind: 'chunk', text: expect.not.stringMatching(/\b(?:um|uh|you know)\b/i) });
  });
  it('builds the live item list the triage will see, and drops one by its words', () => {
    const parts = ['I need to call mum', 'email the landlord, and take out the bins', 'book the dentist'];
    expect(captureItems(parts).length).toBeGreaterThanOrEqual(3);
    const r = dropFromCapture(parts, 'dentist');
    expect(r.removed).toBe('book the dentist');
    expect(r.parts).toHaveLength(2);
    expect(dropFromCapture(parts, 'holiday').removed).toBeNull();
  });
});

describe('read back: one thing to start, a few for today, calm and short', () => {
  const items = [
    { text: 'Email the landlord', bucket: 'now' as const, firstStep: 'open a blank email', minutes: 5 },
    { text: 'Call mum', bucket: 'today' as const }, { text: 'Bins', bucket: 'today' as const },
    { text: 'Taxes', bucket: 'later' as const }, { text: 'Garden', bucket: 'later' as const },
  ];
  it('names exactly one start, the first step, today items and the count parked', () => {
    const l = readBackLine(items);
    expect(l).toContain('Start with Email the landlord, about 5 minutes.');
    expect(l).toContain('First: open a blank email.');
    expect(l).toContain('Call mum, Bins');
    expect(l).toContain('2 more are parked for later.');
    expect(l.split(/\s+/).length).toBeLessThan(55);
    expect(isCalm(l)).toBe(true);
  });
  it('is honest about an empty dump', () => expect(readBackLine([])).toMatch(/did not catch anything/));
});

describe('spoken list corrections', () => {
  beforeEach(() => {
    addToday([{ text: 'Take out the bins', bucket: 'now' }, { text: 'Email the landlord', bucket: 'today' }, { text: 'Book dentist', bucket: 'today' }], NOW);
  });
  it('parses the common phrasings', () => {
    expect(parseListEdit('move the bins to later')).toEqual({ kind: 'move', target: 'bins', bucket: 'later' });
    expect(parseListEdit('push the dentist till tomorrow')).toEqual({ kind: 'move', target: 'dentist', bucket: 'later' });
    expect(parseListEdit('that one is done')).toEqual({ kind: 'done', target: '' });
    expect(parseListEdit('I finished the landlord email')).toEqual({ kind: 'done', target: 'landlord email' });
    expect(parseListEdit('drop the dentist')).toEqual({ kind: 'remove', target: 'dentist' });
    expect(parseListEdit('take the bins off the list')).toEqual({ kind: 'remove', target: 'bins' });
    expect(parseListEdit('start with the landlord')).toEqual({ kind: 'move', target: 'landlord', bucket: 'now' });
    expect(parseListEdit('take out the bins')).toBeNull(); // an ordinary task is never mistaken for a command
  });
  it('moves the matching item and says exactly that', () => {
    const r = applyListEdit('move the bins to later', NOW);
    expect(r).toMatchObject({ ok: true, say: 'Moved Take out the bins to later.', changed: { action: 'move', bucket: 'later' } });
    expect(loadToday(NOW).find((i) => i.text.includes('bins'))?.bucket).toBe('later');
  });
  it('"that one is done" completes the one we are on', () => {
    const r = applyListEdit('that one is done', NOW);
    expect(r.ok).toBe(true);
    expect(loadToday(NOW).find((i) => i.text.includes('bins'))?.done).toBe(true);
    expect(r.say).toMatch(/win/);
  });
  it('making something the start demotes the old one: only one "now"', () => {
    applyListEdit('start with the landlord', NOW);
    const now = loadToday(NOW).filter((i) => i.bucket === 'now' && !i.done);
    expect(now.map((i) => i.text)).toEqual(['Email the landlord']);
  });
  it('removes, and says so', () => {
    expect(applyListEdit('drop the dentist', NOW).say).toBe('Removed Book dentist.');
    expect(loadToday(NOW)).toHaveLength(2);
  });
  it('does not guess: unknown item and ambiguous item both come back as ok:false with a question', () => {
    expect(applyListEdit('move the holiday to later', NOW)).toMatchObject({ ok: false, say: expect.stringContaining('could not find') });
    addToday([{ text: 'Email Dan', bucket: 'today' }], NOW);
    const amb = applyListEdit('move the email to later', NOW);
    expect(amb.ok).toBe(false);
    expect(amb.say).toMatch(/^Which one/);
    expect(JSON.parse(store.get(TODAY_KEY)!).filter((i: TodayItem) => i.bucket === 'later')).toHaveLength(0);
    expect(applyListEdit('hello there', NOW).ok).toBe(false);
  });
  it('matchItem is forgiving about plurals', () => {
    expect('item' in matchItem(loadToday(NOW), 'bin')).toBe(true);
  });
});

describe('plan the day from energy and time (no calendar)', () => {
  const items = [item('Taxes', { bucket: 'later' }), item('Reply to landlord', { bucket: 'now', minutes: 10 }), item('Call mum'), item('Bins'), item('Dentist')];
  it('parses energy and available time', () => {
    expect(parseEnergyMinutes('low energy, about two hours')).toEqual({ energy: 'low', minutes: 120 });
    expect(parseEnergyMinutes('I am wired and have 45 minutes')).toEqual({ energy: 'high', minutes: 45 });
    expect(parseEnergyMinutes('an hour and 15 minutes')).toEqual({ energy: null, minutes: 75 });
    expect(parseEnergyMinutes('half an hour')).toEqual({ energy: null, minutes: 30 });
    expect(parseEnergyMinutes('whatever')).toEqual({ energy: null, minutes: null });
  });
  it('puts the "now" item first, fits the time, and says what it assumed', () => {
    const p = planDay({ items });
    expect(p.picked[0].text).toBe('Reply to landlord');
    expect(p.assumed).toEqual(['medium energy', 'about 90 minutes']);
    expect(p.say).toContain('I assumed medium energy and about 90 minutes');
    const used = p.picked.reduce((a, x) => a + x.minutes, 0) + 5 * (p.picked.length - 1);
    expect(used).toBeLessThanOrEqual(90);
  });
  it('low energy: fewer, shorter blocks', () => {
    const p = planDay({ items, energy: 'low', minutes: 120 });
    expect(p.picked.length).toBeLessThanOrEqual(2);
    expect(p.picked.every((x) => x.minutes <= 16)).toBe(true);
    expect(p.leftover).toBe(items.length - p.picked.length);
    expect(p.assumed).toEqual([]);
  });
  it('little time still gives one gentle item', () => {
    const p = planDay({ items, energy: 'high', minutes: 10 });
    expect(p.picked).toHaveLength(1);
    expect(p.picked[0].minutes).toBeLessThanOrEqual(10);
  });
  it('uses the learned block length, and is honest when the list is empty', () => {
    expect(planDay({ items, energy: 'high', minutes: 120, preferredBlock: 10 }).picked.every((x) => x.minutes <= 20)).toBe(true);
    expect(planDay({ items: [] }).empty).toBe(true);
    expect(isCalm(planDay({ items }).say)).toBe(true);
  });
});

describe('break a task into steps with timers', () => {
  it('makes four steps with minutes and walks through them', () => {
    let plan = breakDown('write the cover letter', 12, NOW);
    expect(plan.steps).toHaveLength(4);
    expect(plan.steps.every((s) => s.minutes >= 2)).toBe(true);
    expect(plan.steps[2].minutes).toBe(12);
    const a = advanceSteps(plan);
    expect(a.finished?.minutes).toBe(2);
    expect(a.next).toBe(a.plan.steps[1]);
    plan = a.plan;
    for (let i = 0; i < 2; i++) plan = advanceSteps(plan).plan;
    const last = advanceSteps(plan);
    expect(last.next).toBeNull();
    expect(advanceSteps(last.plan).finished).toBeNull();
  });
  it('clamps the working block to 5-25 minutes', () => {
    expect(breakDown('x task', 90, NOW).steps[2].minutes).toBe(25);
    expect(breakDown('x task', 1, NOW).steps[2].minutes).toBe(5);
  });
});

describe('end-of-day wrap-up reads back real wins', () => {
  const sess = (o: Partial<CoachSessionRecord>) => ({ createdAt: NOW.toISOString(), outcome: 'started', taskText: 'Write intro', ...o }) as CoachSessionRecord;
  it('lists finished items and started blocks from today only, calmly', () => {
    const items = [item('Bins', { done: true, doneAt: NOW.toISOString() }), item('Old', { done: true, doneAt: new Date(2026, 9, 18, 9).toISOString() }), item('Taxes')];
    const w = wrapUp(items, [sess({}), sess({ outcome: 'not_started', taskText: 'Nope' }), sess({ isSample: true, taskText: 'Sample' })], NOW);
    expect(w.wins).toEqual(['Bins', 'Write intro']);
    expect(w.say).toContain('2 things');
    expect(w.say).toContain('safe on your list for tomorrow');
    expect(isCalm(w.say)).toBe(true);
  });
  it('a day with no wins is met without judgment and without invention', () => {
    const w = wrapUp([item('Taxes')], [], NOW);
    expect(w.wins).toEqual([]);
    expect(w.say).toMatch(/okay/);
    expect(isCalm(w.say)).toBe(true);
    expect(w.say).not.toMatch(/got \d|things going/);
  });
});

describe('resume yesterday', () => {
  it('prefers the newest open item from before today, else the top of today', () => {
    const y = new Date(2026, 9, 18, 15).toISOString();
    const items = [item('Today thing'), item('Left yesterday', { createdAt: y }), item('Older', { createdAt: new Date(2026, 9, 15).toISOString() }), item('Finished', { createdAt: y, done: true })];
    expect(pickResume(items, NOW)?.text).toBe('Left yesterday');
    expect(pickResume([item('Today thing')], NOW)?.text).toBe('Today thing');
    expect(pickResume([], NOW)).toBeNull();
  });
});

describe('soft reminders by clock time', () => {
  it('relative and absolute times, rolling to tomorrow when the time has passed', () => {
    expect(parseWhen('in 20 minutes to stretch', NOW)).toEqual({ minutes: 20, text: 'stretch' });
    expect(parseWhen('call mum at 11:30', NOW)).toMatchObject({ minutes: 90, text: 'call mum' });
    expect(parseWhen('at 9am take a walk', NOW).minutes).toBe(23 * 60);
    expect(parseWhen('at 12pm lunch', NOW).minutes).toBe(120);
    expect(parseWhen('sometime', NOW).minutes).toBeNull();
    expect(parseWhen('2 hours', NOW).minutes).toBe(120);
  });
});

describe('self-check: spoken confirmation must match what happened', () => {
  const ok = { action: 'timer_start', result: { ok: true, minutes: 10, say: 'Timer set for 10 minutes.' } };
  const bad = { action: 'list_edit', result: { ok: false, say: 'I could not find "holiday" on your list.' } };
  it('accepts a truthful confirmation', () => {
    expect(verifySpoken(ok, 'Okay, ten minutes starts now. Timer set for 10 minutes.').ok).toBe(true);
    expect(verifySpoken(bad, 'I could not find that one.').ok).toBe(true);
  });
  it('catches success claimed after a failure and speaks the true line', () => {
    const v = verifySpoken(bad, 'Done! I moved it to later.');
    expect(v).toMatchObject({ ok: false, issue: 'claimed_success_after_failure', correction: 'I could not find "holiday" on your list.' });
  });
  it('catches failure reported after a success', () => {
    const v = verifySpoken(ok, "Sorry, I couldn't start that timer.");
    expect(v).toMatchObject({ ok: false, issue: 'reported_failure_after_success', correction: 'Timer set for 10 minutes.' });
  });
  it('catches the wrong number of minutes', () => {
    const v = verifySpoken(ok, 'Started a 25 minute timer.');
    expect(v).toMatchObject({ ok: false, issue: 'wrong_minutes' });
  });
  it('builds the true line from the result alone', () => {
    expect(truthfulLine({ action: 'x', result: { ok: false, error: 'no such routine.' } })).toBe('That did not work: no such routine.');
    expect(truthfulLine({ action: 'x', result: { ok: true } })).toBe('Done.');
  });
});
