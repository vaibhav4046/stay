import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  ACTIVE_SESSION_STORAGE_KEY,
  ACTIVE_SESSION_MAX_AGE_MS,
  type ActiveSessionState,
} from '@/lib/coach/activeSession';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

let storage: MemStorage;

beforeEach(() => {
  storage = new MemStorage();
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = {
    localStorage: storage,
  };
  vi.restoreAllMocks();
});

describe('Active Session Persistence & Retention Rules', () => {
  it('saves and loads active conversation turns, plan, and timer state', () => {
    saveActiveSession({
      transcripts: [
        { id: 'u-1', role: 'user', text: 'Clean garage', timestamp: new Date().toISOString() },
        { id: 'a-1', role: 'agent', text: 'Let us pick up one box.', timestamp: new Date().toISOString() },
      ],
      plan: {
        taskText: 'Clean garage',
        barrierType: 'overwhelm',
        strategyKey: 'task_shrinking',
        strategyLabel: 'Task Shrinking',
        firstStep: 'Pick up one cardboard box',
        whyThisFits: 'Shrinks large tasks into a first step',
        timerMinutes: 5,
        checkinPrompt: 'How did that feel?',
        safetyFlag: 'none',
        spokenResponse: 'Let us pick up one box.',
      },
      step: 'plan',
      avoidedTask: 'Clean garage',
      smallestNextAction: 'Pick up one cardboard box',
      minutes: 5,
    });

    const loaded = loadActiveSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.transcripts.length).toBe(2);
    expect(loaded?.transcripts[0].text).toBe('Clean garage');
    expect(loaded?.plan?.firstStep).toBe('Pick up one cardboard box');
    expect(loaded?.step).toBe('plan');
    expect(loaded?.avoidedTask).toBe('Clean garage');
  });

  it('expires sessions older than 12 hours according to retention policy', () => {
    const thirteenHoursAgo = Date.now() - (ACTIVE_SESSION_MAX_AGE_MS + 60_000);
    const staleSession: ActiveSessionState = {
      id: 'stale-1',
      date: new Date().toISOString().slice(0, 10),
      timestamp: thirteenHoursAgo,
      transcripts: [{ id: 'u-1', role: 'user', text: 'Old task', timestamp: new Date(thirteenHoursAgo).toISOString() }],
      plan: null,
      avoidedTask: 'Old task',
      smallestNextAction: null,
      step: 'input',
      minutes: 5,
      endsAt: null,
    };

    storage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(staleSession));

    const loaded = loadActiveSession();
    expect(loaded).toBeNull();
    expect(storage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('starts a clean active session on a new day', () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const yesterdaySession: ActiveSessionState = {
      id: 'yesterday-1',
      date: yesterday,
      timestamp: Date.now() - 3600 * 1000,
      transcripts: [{ id: 'u-1', role: 'user', text: 'Yesterday task', timestamp: new Date().toISOString() }],
      plan: null,
      avoidedTask: 'Yesterday task',
      smallestNextAction: null,
      step: 'input',
      minutes: 5,
      endsAt: null,
    };

    storage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(yesterdaySession));

    const loaded = loadActiveSession();
    expect(loaded).toBeNull();
    expect(storage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('clearActiveSession purges the session data completely', () => {
    saveActiveSession({
      transcripts: [{ id: 'u-1', role: 'user', text: 'Test', timestamp: new Date().toISOString() }],
      step: 'input',
    });
    expect(loadActiveSession()).not.toBeNull();

    clearActiveSession();
    expect(loadActiveSession()).toBeNull();
    expect(storage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('handles corrupt JSON gracefully by returning null and clearing storage', () => {
    storage.setItem(ACTIVE_SESSION_STORAGE_KEY, '{ invalid JSON }');
    const loaded = loadActiveSession();
    expect(loaded).toBeNull();
    expect(storage.getItem(ACTIVE_SESSION_STORAGE_KEY)).toBeNull();
  });
});
