import { describe, expect, it } from 'vitest';
import { buildEmailSummary, buildVault, mailtoLink, relevantNotes, type VaultInput } from '@/lib/export/vault';
import type { CoachSessionRecord } from '@/types/domain';

const now = new Date('2026-11-03T10:00:00Z');
const session = (id: string, task: string, outcome: CoachSessionRecord['outcome'], daysAgo = 1, extra: Partial<CoachSessionRecord> = {}): CoachSessionRecord => ({
  id, userId: 'u', createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(), completedAt: null, mode: 'voice', careContext: 'self_managing', taskText: task,
  barrierType: 'avoidance' as never, strategyKey: 'task_shrinking', firstStep: 'Open the email and type one word', plannedMinutes: 5, actualSeconds: null, outcome, helpfulRating: null, crisisTriggered: false, ...extra,
});
const input = (over: Partial<VaultInput> = {}): VaultInput => ({
  memory: { name: 'Sam', roleOrField: 'designer', coreTriggers: [], knownStrengths: ['short blocks'], facts: ['I focus best in the morning'], recentSessionsSummary: [], lastActive: now.toISOString() },
  learnings: { enabled: true, items: [], removed: [], stated: [], noticeSeen: true },
  sessions: [session('a', 'Reply to my landlord', 'started'), session('b', 'Taxes: the "W-2" folder / part 1', 'not_started', 2), session('s', 'Sample task', 'started', 1, { isSample: true })],
  list: [{ text: 'buy milk' }, { text: 'call the dentist', done: true }],
  now,
  ...over,
});

describe('the Obsidian vault', () => {
  it('has an index, memory, learnings, list, blocks and one note per real block, all linked', () => {
    const files = buildVault(input());
    const paths = files.map((f) => f.path);
    for (const p of ['Stay.md', 'Memory.md', 'What Stay learned.md', 'Your list.md', 'Blocks.md']) expect(paths).toContain(p);
    expect(paths.filter((p) => p.startsWith('Blocks/')).length).toBe(2); // the sample block is left out
    const index = files.find((f) => f.path === 'Stay.md')!.content;
    expect(index).toContain('[[Memory]]');
    expect(index).toContain('[[Blocks]]');
  });
  it('every [[link]] points at a note that exists', () => {
    const files = buildVault(input());
    const names = new Set(files.map((f) => f.path.replace(/\.md$/, '')));
    for (const f of files) for (const m of f.content.matchAll(/\[\[([^\]]+)\]\]/g)) expect(names.has(m[1]), `${f.path} -> ${m[1]}`).toBe(true);
  });
  it('file names are safe for any system (no slashes, colons or quotes in a title)', () => {
    const bad = buildVault(input()).map((f) => f.path).filter((p) => /[\:*?"<>|]/.test(p.replace(/^Blocks\//, '')));
    expect(bad).toEqual([]);
  });
  it('an empty device still exports something honest', () => {
    const files = buildVault(input({ memory: null, learnings: null, sessions: [], list: [] }));
    expect(files.find((f) => f.path === 'Memory.md')!.content).toContain('Nothing yet');
    expect(files.find((f) => f.path === 'Blocks.md')!.content).toContain('No blocks yet');
  });
  it('says it is not a diagnosis', () => {
    expect(buildVault(input()).find((f) => f.path === 'Stay.md')!.content).toMatch(/not a doctor or therapist/);
  });
});

describe('Email this to me', () => {
  it('summarises this week from the device and says nothing was uploaded', () => {
    const s = buildEmailSummary(input());
    expect(s.body).toContain('This week: 1 of 2 blocks got started.');
    expect(s.body).toContain('buy milk');
    expect(s.body).not.toContain('call the dentist'); // done items are left out
    expect(s.body).toContain('Stay did not upload or store this');
  });
  it('builds a mailto link that fits a mail client', () => {
    const link = mailtoLink(buildEmailSummary(input()));
    expect(link.startsWith('mailto:?subject=')).toBe(true);
    expect(link.length).toBeLessThan(2400);
  });
});

describe('whole-vault retrieval', () => {
  it('finds the few lines about what was just said, by plain words', () => {
    const files = buildVault(input());
    const hits = relevantNotes('I need to answer my landlord again', files);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.join(' ').toLowerCase()).toContain('landlord');
  });
  it('returns nothing for words the vault never saw', () => {
    expect(relevantNotes('zebra quantum', buildVault(input()))).toEqual([]);
  });
});
