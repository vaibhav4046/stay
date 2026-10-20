import { beforeEach, describe, expect, it } from 'vitest';
import type { CoachSessionRecord, SessionOutcome, StrategyKey } from '@/types/domain';
import {
  currentStrength, deleteLearning, deriveFromSessions, deriveFromStated, detectStatedAvoidance, editLearning, emptyLearnings, learningsPromptLine,
  loadLearnings, mergeLearnings, noteStatedAvoidance, refreshLearnings, resetLearnings, setLearningsEnabled, togglePinLearning, whyLine,
  type Derived, type Learning, type LearningsState,
} from '@/lib/coach/learnings';

const store = new Map<string, string>();
// @ts-expect-error node test shim
globalThis.window = { localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) } };

const NOW = new Date(2026, 9, 19, 12, 0, 0); // local noon, 19 Oct 2026
const daysAgo = (d: number, hour = 9) => new Date(2026, 9, 19 - d, hour, 0, 0).toISOString();
let n = 0;
const block = (o: Partial<CoachSessionRecord> & { outcome: SessionOutcome | null }): CoachSessionRecord => ({
  id: `s${n++}`, userId: 'u', createdAt: daysAgo(1), completedAt: null, mode: 'voice', careContext: 'prefer_not_to_say', taskText: 'reply to email',
  barrierType: 'other', strategyKey: 'task_shrinking' as StrategyKey, firstStep: 'open it', plannedMinutes: 10, actualSeconds: null, helpfulRating: null, crisisTriggered: false, ...o,
} as CoachSessionRecord);

beforeEach(() => store.clear());

describe('deriveFromSessions: only claims the data supports', () => {
  it('makes no claim from too few blocks', () => {
    const two = [block({ outcome: 'started' }), block({ outcome: 'started' })];
    expect(deriveFromSessions(two, NOW)).toEqual([]);
  });

  it('names the strategy that really worked, with real counts', () => {
    const s = [
      ...[1, 2, 3, 4].map((d) => block({ outcome: 'started', strategyKey: 'task_shrinking', createdAt: daysAgo(d) })),
      block({ outcome: 'not_started', strategyKey: 'task_shrinking', createdAt: daysAgo(5) }),
      ...[1, 2, 3].map((d) => block({ outcome: 'not_started', strategyKey: 'reframing', createdAt: daysAgo(d) })),
    ];
    const d = deriveFromSessions(s, NOW).find((x) => x.kind === 'start_strategy');
    expect(d?.id).toBe('start_strategy:task_shrinking');
    expect(d?.text).toContain('4 of 5 blocks');
    expect(d?.evidence[0]).toMatchObject({ type: 'sessions', successes: 4, blocks: 5 });
  });

  it('does not claim a winner when another strategy did as well', () => {
    const s = [...[1, 2, 3].map((d) => block({ outcome: 'started', strategyKey: 'task_shrinking', createdAt: daysAgo(d) })), ...[1, 2, 3].map((d) => block({ outcome: 'started', strategyKey: 'timeboxing', createdAt: daysAgo(d) }))];
    expect(deriveFromSessions(s, NOW).find((x) => x.kind === 'start_strategy')).toBeUndefined();
  });

  it('finds the block length with the best real outcome rate', () => {
    const s = [
      ...[1, 2, 3, 4].map((d) => block({ outcome: 'started', plannedMinutes: 10, createdAt: daysAgo(d) })),
      ...[1, 2, 3].map((d) => block({ outcome: 'not_started', plannedMinutes: 25, createdAt: daysAgo(d) })),
    ];
    const d = deriveFromSessions(s, NOW).find((x) => x.kind === 'block_length');
    expect(d?.text).toBe('Blocks of 10 minutes or less got started 4 of 4 times.');
  });

  it('finds the best time of day only with at least four blocks in it', () => {
    const morning = [1, 2, 3, 4, 5].map((d) => block({ outcome: d === 5 ? 'not_started' : 'started', createdAt: daysAgo(d, 9) }));
    const evening = [1, 2, 3, 4].map((d) => block({ outcome: 'not_started', createdAt: daysAgo(d + 6, 19) }));
    const t = deriveFromSessions([...morning, ...evening], NOW).find((x) => x.kind === 'best_time');
    expect(t?.id).toBe('best_time:morning');
    expect(t?.text).toBe('Mornings have worked best: 4 of 5 blocks got started.');
    const three = deriveFromSessions(morning.slice(0, 3), NOW).find((x) => x.kind === 'best_time');
    expect(three).toBeUndefined();
  });

  it('ignores sample data, blocks with no outcome, blocks outside 60 days and the future', () => {
    const s = [
      ...[1, 2, 3, 4].map((d) => block({ outcome: 'started', isSample: true, createdAt: daysAgo(d) })),
      ...[1, 2, 3, 4].map((d) => block({ outcome: null, createdAt: daysAgo(d) })),
      ...[70, 71, 72, 73].map((d) => block({ outcome: 'started', createdAt: daysAgo(d) })),
      block({ outcome: 'started', createdAt: new Date(NOW.getTime() + 5 * 86_400_000).toISOString() }),
    ];
    expect(deriveFromSessions(s, NOW)).toEqual([]);
  });

  it('notices a recurring task word in blocks that were not started, citing the real task text', () => {
    const s = [
      block({ outcome: 'not_started', taskText: 'do my taxes', createdAt: daysAgo(8) }),
      block({ outcome: 'paused_or_stopped', taskText: 'finish the taxes form', createdAt: daysAgo(3) }),
      block({ outcome: 'started', taskText: 'wash dishes', createdAt: daysAgo(2) }),
    ];
    const d = deriveFromSessions(s, NOW).find((x) => x.kind === 'avoidance_theme');
    expect(d?.id).toBe('avoidance_theme:task:taxes');
    expect(d?.evidence.filter((e) => e.type === 'utterance').map((e) => (e as { quote: string }).quote)).toEqual(['do my taxes', 'finish the taxes form']);
    expect(d?.text).not.toMatch(/fail|lazy|behind|overdue/i);
  });
});

describe('stated avoidance comes only from the person\'s own words', () => {
  it('detects and quotes it', () => {
    expect(detectStatedAvoidance("I've been avoiding my tax return because it is scary")).toMatchObject({ theme: 'my tax return' });
    expect(detectStatedAvoidance('I keep putting off calling the dentist.')?.theme).toBe('calling the dentist');
    expect(detectStatedAvoidance('The weather is nice')).toBeNull();
    expect(detectStatedAvoidance('can you avoid that')).toBeNull();
  });

  it('is stored with the quote and the time, and shown by whyLine', () => {
    noteStatedAvoidance("I'm avoiding the landlord email", NOW);
    const s = loadLearnings();
    expect(s.items).toHaveLength(1);
    expect(s.items[0].text).toBe('You told me the landlord email is something you avoid.');
    expect(whyLine(s.items[0])).toContain('You said: "I\'m avoiding the landlord email"');
  });

  it('is not stored when learning is off', () => {
    setLearningsEnabled(false);
    noteStatedAvoidance("I'm avoiding the landlord email", NOW);
    expect(loadLearnings().items).toEqual([]);
    expect(loadLearnings().stated).toEqual([]);
  });
});

describe('mergeLearnings: dedupe, edits, pins, deletions, decay', () => {
  const d = (id: string, strength = 0.6, kind: Derived['kind'] = 'block_length'): Derived => ({ id, kind, text: `text ${id}`, evidence: [{ type: 'sessions', successes: 3, blocks: 4, label: 'x', from: '2026-10-01', to: '2026-10-10' }], strength });

  it('dedupes by id and keeps the first-seen time', () => {
    const t1 = new Date(2026, 9, 10);
    const a = mergeLearnings(emptyLearnings(), [d('block_length:xs'), d('block_length:xs')], t1);
    const b = mergeLearnings(a, [d('block_length:xs', 0.7)], NOW);
    expect(b.items).toHaveLength(1);
    expect(b.items[0].firstSeen).toBe(t1.toISOString());
    expect(b.items[0].lastConfirmed).toBe(NOW.toISOString());
    expect(b.items[0].strength).toBe(0.7);
  });

  it('keeps the person\'s own wording after an edit while the evidence keeps updating', () => {
    let s = mergeLearnings(emptyLearnings(), [d('block_length:xs')], NOW);
    s = { ...s, items: s.items.map((i) => ({ ...i, text: 'Short ones suit me', edited: true })) };
    const s2 = mergeLearnings(s, [{ ...d('block_length:xs'), evidence: [{ type: 'sessions', successes: 5, blocks: 5, label: 'x', from: 'a', to: 'b' }] }], NOW);
    expect(s2.items[0].text).toBe('Short ones suit me');
    expect(s2.items[0].evidence[0]).toMatchObject({ successes: 5 });
  });

  it('a deleted learning does not come back', () => {
    const s0 = mergeLearnings(emptyLearnings(), [d('block_length:xs')], NOW);
    const s1 = { ...s0, items: [], removed: ['block_length:xs'] };
    expect(mergeLearnings(s1, [d('block_length:xs')], NOW).items).toEqual([]);
  });

  it('drops a sessions-based learning when the data stops supporting it, but keeps a pinned one, marked stale', () => {
    const s0 = mergeLearnings(emptyLearnings(), [d('block_length:xs'), d('best_time:morning', 0.5, 'best_time')], NOW);
    const pinned = { ...s0, items: s0.items.map((i) => (i.id === 'best_time:morning' ? { ...i, pinned: true } : i)) };
    const s1 = mergeLearnings(pinned, [], NOW);
    expect(s1.items.map((i) => i.id)).toEqual(['best_time:morning']);
    expect(s1.items[0].stale).toBe(true);
    expect(whyLine(s1.items[0])).toContain('no longer show this');
    expect(learningsPromptLine(s1, NOW)).toBe('');
  });

  it('things the person said decay with a 45 day half-life and expire below 15%', () => {
    const said: Learning = { id: 'avoidance_theme:said:taxes', kind: 'avoidance_theme', text: 'You told me taxes is something you avoid.', evidence: [{ type: 'utterance', quote: 'q', at: daysAgo(0) }], strength: 0.6, firstSeen: daysAgo(0), lastConfirmed: daysAgo(0), pinned: false, edited: false };
    const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000);
    expect(currentStrength(said, NOW)).toBeCloseTo(0.6, 2);
    expect(currentStrength(said, at(45))).toBeCloseTo(0.3, 2);
    expect(currentStrength(said, at(90))).toBeCloseTo(0.15, 2);
    const state: LearningsState = { ...emptyLearnings(), items: [said] };
    expect(mergeLearnings(state, [], at(44)).items).toHaveLength(1);
    expect(mergeLearnings(state, [], at(100)).items).toHaveLength(0);
    // pinned never decays
    expect(mergeLearnings({ ...state, items: [{ ...said, pinned: true }] }, [], at(400)).items).toHaveLength(1);
    expect(currentStrength({ ...said, pinned: true }, at(400))).toBe(0.6);
  });

  it('is capped at 12, pinned first', () => {
    const many = Array.from({ length: 20 }, (_, i) => d(`best_time:t${i}`, 0.3 + i / 100, 'best_time'));
    const s = mergeLearnings(emptyLearnings(), many, NOW);
    expect(s.items).toHaveLength(12);
    expect(s.items[0].strength).toBeGreaterThan(s.items[11].strength);
  });

  it('stated avoidance repeated gains strength', () => {
    const once = deriveFromStated([{ theme: 'taxes', quote: 'a', at: daysAgo(3) }], NOW)[0];
    const twice = deriveFromStated([{ theme: 'taxes', quote: 'a', at: daysAgo(3) }, { theme: 'taxes', quote: 'b', at: daysAgo(1) }], NOW)[0];
    expect(twice.strength).toBeGreaterThan(once.strength);
    expect(twice.evidence).toHaveLength(2);
  });
});

describe('the person\'s controls', () => {
  const sessions = [1, 2, 3, 4].map((d) => block({ outcome: 'started', plannedMinutes: 10, createdAt: daysAgo(d) }));

  it('refresh stores learnings with evidence; the toggle stops further learning', () => {
    const s = refreshLearnings(sessions, NOW);
    expect(s.items.length).toBeGreaterThan(0);
    expect(whyLine(s.items.find((i) => i.kind === 'block_length')!)).toMatch(/4 of 4 blocks of 10 minutes or less got started, between/);
    setLearningsEnabled(false);
    const more = [...sessions, ...[1, 2, 3, 4].map((d) => block({ outcome: 'started', taskText: 'x', plannedMinutes: 25, createdAt: daysAgo(d) }))];
    expect(refreshLearnings(more, NOW).items.map((i) => i.id)).toEqual(s.items.map((i) => i.id));
    expect(learningsPromptLine(loadLearnings(), NOW)).toBe(''); // off means not used either
  });

  it('pin, edit and delete work, and deletion sticks across refreshes', () => {
    const id = refreshLearnings(sessions, NOW).items[0].id;
    expect(togglePinLearning(id).items.find((i) => i.id === id)?.pinned).toBe(true);
    expect(editLearning(id, '  Short blocks suit me  ').items.find((i) => i.id === id)?.text).toBe('Short blocks suit me');
    expect(editLearning(id, '   ').items.find((i) => i.id === id)?.text).toBe('Short blocks suit me');
    deleteLearning(id);
    expect(loadLearnings().items.find((i) => i.id === id)).toBeUndefined();
    expect(refreshLearnings(sessions, NOW).items.find((i) => i.id === id)).toBeUndefined();
    resetLearnings();
    expect(refreshLearnings(sessions, NOW).items.find((i) => i.id === id)).toBeDefined();
  });

  it('prompt line carries at most two real learnings in under 200 characters', () => {
    const line = learningsPromptLine(refreshLearnings(sessions, NOW), NOW);
    expect(line.startsWith('Learned: ')).toBe(true);
    expect(line.length).toBeLessThan(200);
  });
});
