import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_USER_MEMORY,
  loadUserMemory,
  saveUserMemory,
  extractMemoriesFromUtterance,
  recordSessionMemory,
  addUserMemoryFact,
  removeUserMemoryFact,
  clearAllUserMemories,
  buildMemorySystemPrompt,
} from '@/lib/coach/userMemory';

const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, String(val)),
  clear: () => storageMap.clear(),
  removeItem: (key: string) => storageMap.delete(key),
};

// Polyfill for Node test environment
// @ts-expect-error test mock
globalThis.localStorage = localStorageMock;
// @ts-expect-error test mock
globalThis.window = { localStorage: localStorageMock };

describe('Persistent Cognitive User Memory Engine', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('starts a new user with an empty memory: nothing is "known" until they say it', () => {
    const memory = loadUserMemory();
    expect(memory.name).toBeNull();
    expect(memory.coreTriggers).toEqual([]);
    expect(memory.knownStrengths).toEqual([]);
    expect(memory.facts).toEqual([]);
  });

  it('automatically extracts user name from utterance', () => {
    const res = extractMemoriesFromUtterance('Hello there, my name is Alex and I need help starting');
    expect(res.profile.name).toBe('Alex');
    expect(res.extractedFact).toContain('Alex');
  });

  it('automatically extracts role or work context', () => {
    const res = extractMemoriesFromUtterance("I work as a software engineer and I'm buried in PRs");
    expect(res.profile.roleOrField).toBe('software engineer');
  });

  it('extracts avoidance triggers into profile', () => {
    const res = extractMemoriesFromUtterance("I hate doing expense reports and invoicing");
    expect(res.profile.coreTriggers).toContain('expense reports and invoicing');
  });

  it('extracts strengths and preferences', () => {
    const res = extractMemoriesFromUtterance('What helps is music and silent body doubling');
    expect(res.profile.knownStrengths).toContain('music and silent body doubling');
  });

  it('records episodic task session history', () => {
    const updated = recordSessionMemory({
      task: 'File tax return',
      outcome: 'started',
      minutes: 20,
    });

    expect(updated.recentSessionsSummary.length).toBe(1);
    expect(updated.recentSessionsSummary[0].task).toBe('File tax return');
    expect(updated.recentSessionsSummary[0].outcome).toBe('started');
    expect(updated.recentSessionsSummary[0].minutes).toBe(20);
  });

  it('adds and removes explicit user memory facts', () => {
    const withFact = addUserMemoryFact('Prefers working with dim lighting and noise-cancelling headphones');
    expect(withFact.facts).toContain('Prefers working with dim lighting and noise-cancelling headphones');

    const withoutFact = removeUserMemoryFact(0);
    expect(withoutFact.facts).not.toContain('Prefers working with dim lighting and noise-cancelling headphones');
  });

  it('clears all user memories and restores defaults', () => {
    addUserMemoryFact('Custom temporary fact');
    const reset = clearAllUserMemories();
    expect(reset.name).toBeNull();
    expect(reset.facts).toEqual(DEFAULT_USER_MEMORY.facts);
  });

  it('constructs rich system prompt for LLM and voice sessions', () => {
    const profile = loadUserMemory();
    profile.name = 'Jordan';
    profile.roleOrField = 'Product Designer';
    profile.recentSessionsSummary = [
      { task: 'Clean apartment desk', outcome: 'started', minutes: 20, timestamp: new Date().toISOString() },
    ];

    const prompt = buildMemorySystemPrompt(profile);
    expect(prompt).toContain('Jordan');
    expect(prompt).toContain('Product Designer');
    expect(prompt).toContain('Clean apartment desk');
    expect(prompt).toContain('STAY PERSISTENT USER MEMORY & AGI KNOWLEDGE GRAPH');
  });
});
