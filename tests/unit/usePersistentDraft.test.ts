import { describe, it, expect, beforeEach } from 'vitest';
import {
  getPersistentDraft,
  setPersistentDraft,
  clearPersistentDraft,
} from '@/lib/storage/usePersistentDraft';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { window: { sessionStorage: MemStorage } }).window = {
    sessionStorage: new MemStorage(),
  };
});

describe('usePersistentDraft storage operations', () => {
  const KEY = 'stay_draft_test_key';

  it('reads default value when storage has no draft', () => {
    expect(getPersistentDraft(KEY, 'default thought')).toBe('default thought');
  });

  it('persists and retrieves unsubmitted draft thoughts', () => {
    setPersistentDraft(KEY, 'Filing my 2024 taxes');
    expect(getPersistentDraft(KEY)).toBe('Filing my 2024 taxes');
  });

  it('cleans up storage when empty or blank draft is passed', () => {
    setPersistentDraft(KEY, 'Some thought');
    expect(getPersistentDraft(KEY)).toBe('Some thought');
    setPersistentDraft(KEY, '   ');
    expect(getPersistentDraft(KEY, '')).toBe('');
  });

  it('explicitly removes draft upon submission', () => {
    setPersistentDraft(KEY, 'Brain dump notes');
    expect(getPersistentDraft(KEY)).toBe('Brain dump notes');
    clearPersistentDraft(KEY);
    expect(getPersistentDraft(KEY, '')).toBe('');
  });
});
