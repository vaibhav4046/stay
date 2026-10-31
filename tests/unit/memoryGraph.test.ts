import { describe, it, expect, beforeEach } from 'vitest';
import {
  createInitialGraph,
  loadMemoryGraph,
  recordGraphEvent,
  synthesizeMemoryContext,
} from '@/lib/storage/memoryGraph';

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

describe('memoryGraph (3-Tier Stateful Memory Graph)', () => {
  it('initializes default graph nodes and edges', () => {
    const graph = createInitialGraph();
    expect(graph.nodes['strat-task_shrinking']).toBeDefined();
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.episodic).toHaveLength(0);
  });

  it('records episodic event and reinforces semantic edge weight on success', () => {
    const graph = recordGraphEvent('Clean garage', 'task_shrinking', 'started');
    expect(graph.episodic).toHaveLength(1);
    expect(graph.episodic[0].task).toBe('Clean garage');
    const edge = graph.edges.find((e) => e.to === 'strat-task_shrinking');
    expect(edge).toBeDefined();
    expect(edge!.weight).toBeGreaterThan(0.85);
  });

  it('synthesizes memory context prompt string', () => {
    recordGraphEvent('File taxes', 'task_shrinking', 'started');
    const loaded = loadMemoryGraph();
    const prompt = synthesizeMemoryContext(loaded);
    expect(prompt).toContain('Validated user affinities');
    expect(prompt).toContain('File taxes');
  });
});
