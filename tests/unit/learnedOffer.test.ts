import { describe, expect, it } from 'vitest';
import { learnedOffer, type Learning, type LearningsState } from '@/lib/coach/learnings';

const now = new Date('2026-11-02T12:00:00Z');
const item = (id: string, kind: Learning['kind'], strength = 0.7, extra: Partial<Learning> = {}): Learning => ({
  id, kind, text: id, evidence: [], strength, firstSeen: now.toISOString(), lastConfirmed: now.toISOString(), pinned: false, edited: false, ...extra,
});
const state = (items: Learning[], enabled = true): LearningsState => ({ enabled, items, removed: [], stated: [], noticeSeen: true });

describe('learnedOffer', () => {
  it('turns a block-length learning into an offer that says it worked before', () => {
    expect(learnedOffer(state([item('block_length:xs', 'block_length')]), now)).toBe('Short blocks have worked for you before. Want me to start a five-minute timer and stay with you?');
  });
  it('uses the strongest of strategy and length, a pinned one first', () => {
    const s = state([item('block_length:m', 'block_length', 0.9), item('start_strategy:task_shrinking', 'start_strategy', 0.5, { pinned: true })]);
    expect(learnedOffer(s, now)).toMatch(/^Making it smaller has worked for you before/);
  });
  it('says nothing when learning is off, the learning is stale or weak, or it is only a theme', () => {
    expect(learnedOffer(state([item('block_length:xs', 'block_length')], false), now)).toBe('');
    expect(learnedOffer(state([item('block_length:xs', 'block_length', 0.7, { stale: true })]), now)).toBe('');
    expect(learnedOffer(state([item('block_length:xs', 'block_length', 0.1)]), now)).toBe('');
    expect(learnedOffer(state([item('avoidance_theme:task:taxes', 'avoidance_theme')]), now)).toBe('');
  });
});
