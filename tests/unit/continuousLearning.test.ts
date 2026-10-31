import { describe, it, expect, beforeEach } from 'vitest';
import {
  sampleBeta,
  loadBanditState,
  selectStrategyViaBandit,
  updateBanditOutcome,
} from '@/lib/coach/continuousLearning';

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
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = {
    localStorage: new MemStorage(),
  };
});

describe('continuousLearning (Thompson Sampling Bandit)', () => {
  it('samples valid probabilities from Beta distribution', () => {
    for (let i = 0; i < 20; i++) {
      const s = sampleBeta(3, 2);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    }
  });

  it('selects strategy from initialized state', () => {
    const state = loadBanditState();
    expect(state.arms.task_shrinking).toBeDefined();
    const { selected, samples } = selectStrategyViaBandit(state);
    expect(['task_shrinking', 'implementation_intention', 'timeboxing', 'reframing']).toContain(selected);
    expect(Object.keys(samples)).toHaveLength(4);
  });

  it('updates posterior weights upon positive outcome', () => {
    const initial = loadBanditState();
    const preAlpha = initial.arms.task_shrinking.alpha;
    const updated = updateBanditOutcome('task_shrinking', 'started', 5);
    expect(updated.arms.task_shrinking.alpha).toBeGreaterThan(preAlpha);
    expect(updated.arms.task_shrinking.totalPulls).toBe(1);
  });

  it('updates failure posterior upon not_started outcome', () => {
    const initial = loadBanditState();
    const preBeta = initial.arms.reframing.beta;
    const updated = updateBanditOutcome('reframing', 'not_started', null);
    expect(updated.arms.reframing.beta).toBeGreaterThan(preBeta);
  });
});
