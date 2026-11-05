import { beforeEach, describe, expect, it } from 'vitest';
import {
  addStyleEvent,
  describeStyle,
  emptyStyle,
  loadStyle,
  recentCounts,
  recordCutIn,
  recordReply,
  resetStyle,
  STYLE_LINE,
  styleLine,
  wantsShortReplies,
  type StyleEvent,
} from '@/lib/voice/replyStyle';
import { setPatienceEnabled } from '@/lib/voice/patience';

const seq = (s: string): StyleEvent[] => s.split('') as StyleEvent[];
const fold = (s: string) => seq(s).reduce(addStyleEvent, emptyStyle());

describe('how long Stay keeps its replies', () => {
  it('says nothing until it has seen a few replies', () => {
    expect(wantsShortReplies(seq('rcrcr'))).toBe(false);
  });

  it('keeps replies short for someone who often cuts in', () => {
    expect(wantsShortReplies(seq('rcrcrcrrcr'))).toBe(true); // 4 cut-ins in 6 replies
  });

  it('leaves replies alone for someone who lets it finish, or cuts in rarely', () => {
    expect(wantsShortReplies(seq('rrrrrrrrrr'))).toBe(false);
    expect(wantsShortReplies(seq('rrrrrrrrrrrrrrrrrrcr'))).toBe(false); // one in twenty
  });

  it('follows the last twenty replies, so it relaxes when the person stops cutting in', () => {
    const early = 'rc'.repeat(8);
    const later = 'r'.repeat(20);
    expect(wantsShortReplies(seq(early))).toBe(true);
    expect(wantsShortReplies(seq(early + later))).toBe(false);
  });

  it('counts two cut-ins in a row, or one with no reply before it, as nothing extra', () => {
    expect(fold('rcc').events).toEqual(['r', 'c']);
    expect(fold('c').events).toEqual([]);
  });

  it('keeps only the most recent events', () => {
    expect(fold('r'.repeat(100)).events).toHaveLength(40);
  });

  it('counts replies and cut-ins inside the window', () => {
    expect(recentCounts(seq('rcrcr'))).toEqual({ replies: 3, cuts: 2 });
  });

  it('describes itself in one plain sentence', () => {
    expect(describeStyle(emptyStyle())).toMatch(/starts after a few replies/);
    expect(describeStyle(fold('rc'.repeat(6)))).toMatch(/often cut in.*short/);
    expect(describeStyle(fold('r'.repeat(8)))).toMatch(/usual length/);
    expect(describeStyle(emptyStyle(), false)).toMatch(/Learning is off/);
  });
});

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

describe('kept on this device', () => {
  beforeEach(() => {
    (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: new MemStorage() };
  });

  it('adds one line to what the model is told once cut-ins are common, and not before', () => {
    expect(styleLine()).toBe('');
    for (let i = 0; i < 8; i++) {
      recordReply();
      recordCutIn();
    }
    expect(styleLine()).toBe(STYLE_LINE);
    expect(STYLE_LINE.length).toBeLessThan(120);
  });

  it('records nothing and says nothing while learning is off', () => {
    setPatienceEnabled(false);
    for (let i = 0; i < 8; i++) {
      recordReply();
      recordCutIn();
    }
    expect(loadStyle().events).toEqual([]);
    expect(styleLine()).toBe('');
  });

  it('can be reset, and survives unreadable data', () => {
    for (let i = 0; i < 8; i++) {
      recordReply();
      recordCutIn();
    }
    resetStyle();
    expect(styleLine()).toBe('');
    window.localStorage.setItem('stay_reply_style_v1', '{broken');
    expect(loadStyle().events).toEqual([]);
    window.localStorage.setItem('stay_reply_style_v1', JSON.stringify({ v: 1, events: ['r', 'x', 'c'] }));
    expect(loadStyle().events).toEqual(['r', 'c']);
  });
});
