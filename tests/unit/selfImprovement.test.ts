import { describe, expect, it, beforeEach } from 'vitest';
import {
  DEFAULT_CALIBRATION_PROFILE,
  loadUserCalibration,
  recordSessionLearning,
  addUserTrainingInstruction,
  removeUserTrainingInstruction,
  buildAdaptiveSystemPrompt,
} from '@/lib/coach/selfImprovement';

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

describe('Self-Improving Adaptation Engine (RLUF)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('loads default calibration with short 10-minute focus duration and warm body-double tone', () => {
    const profile = loadUserCalibration();
    expect(profile.preferredMinutes).toBe(10);
    expect(profile.personaTone).toBe('warm_body_double');
    expect(profile.strategyWeights.task_shrinking).toBeGreaterThan(1.0);
  });

  it('autonomously reinforces strategy weight when outcome is started', () => {
    const initial = loadUserCalibration();
    const initialWeight = initial.strategyWeights.reframing;

    const updated = recordSessionLearning({
      strategyKey: 'reframing',
      outcome: 'started',
      rating: 5,
      usedMinutes: 20,
    });

    expect(updated.strategyWeights.reframing).toBeGreaterThan(initialWeight);
    expect(updated.preferredMinutes).toBe(20);
    expect(updated.positiveRatingCount).toBe(1);
    expect(updated.totalSessionsAnalyzed).toBe(1);
  });

  it('downweights and triggers ultra-micro decomposition when not started', () => {
    const initial = loadUserCalibration();
    const initialWeight = initial.strategyWeights.task_shrinking;

    const updated = recordSessionLearning({
      strategyKey: 'task_shrinking',
      outcome: 'not_started',
      rating: 1,
    });

    expect(updated.strategyWeights.task_shrinking).toBeLessThan(initialWeight);
    expect(updated.stepGranularity).toBe('ultra_micro');
    expect(updated.negativeRatingCount).toBe(1);
  });

  it('accepts and parses explicit user training instructions like 20 minute blocks', () => {
    const updated = addUserTrainingInstruction('I work best with 20 minute focus blocks');
    expect(updated.preferredMinutes).toBe(20);
    expect(updated.userTrainingNotes).toContain('I work best with 20 minute focus blocks');
  });

  it('allows removing training rules', () => {
    addUserTrainingInstruction('Temporary custom rule');
    const profile = loadUserCalibration();
    const idx = profile.userTrainingNotes.indexOf('Temporary custom rule');
    expect(idx).toBeGreaterThanOrEqual(0);

    const afterRemove = removeUserTrainingInstruction(idx);
    expect(afterRemove.userTrainingNotes).not.toContain('Temporary custom rule');
  });

  it('compiles rich adaptive prompt for LLM and voice agent injection', () => {
    const profile = loadUserCalibration();
    const prompt = buildAdaptiveSystemPrompt(profile);
    expect(prompt).toContain('Preferred focus duration: 20 minutes');
    expect(prompt).toContain('Warm, authentic human companion');
    expect(prompt).toContain('body-double mode');
  });
});
