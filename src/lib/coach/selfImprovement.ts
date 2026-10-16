/**
 * Stay Self-Improving Intelligence & Adaptation Engine (RLUF - Reinforcement Learning from User Feedback).
 * Autonomously learns optimal focus duration, effective CBT strategies, tone calibration,
 * and incorporates direct user training instructions into live prompts.
 */

import type { SessionOutcome, StrategyKey } from '@/types/domain';

export interface UserCalibrationProfile {
  preferredMinutes: number;
  personaTone: 'warm_body_double' | 'direct_structured' | 'gentle_somatic';
  stepGranularity: 'ultra_micro' | 'standard';
  strategyWeights: Record<StrategyKey, number>; // Weights from 0.1 to 2.0 (1.0 default)
  userTrainingNotes: string[];
  totalSessionsAnalyzed: number;
  positiveRatingCount: number;
  negativeRatingCount: number;
  lastTrainedAt: string;
}

const STORAGE_KEY = 'stay_user_calibration_v1';

export const DEFAULT_CALIBRATION_PROFILE: UserCalibrationProfile = {
  preferredMinutes: 20, // Default to 20 min per user preference
  personaTone: 'warm_body_double',
  stepGranularity: 'ultra_micro',
  strategyWeights: {
    task_shrinking: 1.2,
    implementation_intention: 1.0,
    reframing: 1.1,
    timeboxing: 1.2,
  },
  userTrainingNotes: [
    'User prefers 20-minute focus sprints over 5-minute blocks.',
    'Speak like a warm, supportive peer sitting right next to the user (body-double mode).',
    'Keep first steps under 90 seconds and completely un-intimidating.',
  ],
  totalSessionsAnalyzed: 0,
  positiveRatingCount: 0,
  negativeRatingCount: 0,
  lastTrainedAt: new Date().toISOString(),
};

/**
 * Loads the active user calibration profile from local storage.
 */
export function loadUserCalibration(): UserCalibrationProfile {
  if (typeof window === 'undefined') {
    return DEFAULT_CALIBRATION_PROFILE;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CALIBRATION_PROFILE;
    const parsed = JSON.parse(raw) as UserCalibrationProfile;
    return {
      ...DEFAULT_CALIBRATION_PROFILE,
      ...parsed,
      strategyWeights: {
        ...DEFAULT_CALIBRATION_PROFILE.strategyWeights,
        ...(parsed.strategyWeights || {}),
      },
      userTrainingNotes: Array.isArray(parsed.userTrainingNotes)
        ? parsed.userTrainingNotes
        : DEFAULT_CALIBRATION_PROFILE.userTrainingNotes,
    };
  } catch {
    return DEFAULT_CALIBRATION_PROFILE;
  }
}

/**
 * Persists updated calibration profile.
 */
export function saveUserCalibration(profile: UserCalibrationProfile): void {
  if (typeof window === 'undefined') return;
  try {
    profile.lastTrainedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

/**
 * Self-improving update loop called after each session outcome and rating.
 * Autonomously adapts weights, step granularity, and duration preferences.
 */
export function recordSessionLearning(params: {
  strategyKey: StrategyKey;
  outcome: SessionOutcome;
  rating?: number | null;
  usedMinutes?: number;
}): UserCalibrationProfile {
  const profile = loadUserCalibration();
  profile.totalSessionsAnalyzed += 1;

  // Learn duration preference if user explicitly selected or finished a duration
  if (params.usedMinutes && params.usedMinutes >= 5 && params.usedMinutes <= 60) {
    // If the user used 20 min or other duration, update preferredMinutes
    profile.preferredMinutes = params.usedMinutes;
  }

  const currentWeight = profile.strategyWeights[params.strategyKey] || 1.0;

  // Reward successful initiation
  if (params.outcome === 'started' || params.outcome === 'partly_started') {
    profile.strategyWeights[params.strategyKey] = Math.min(2.0, currentWeight + 0.15);
    if (params.rating && params.rating >= 4) {
      profile.positiveRatingCount += 1;
      profile.strategyWeights[params.strategyKey] = Math.min(2.0, profile.strategyWeights[params.strategyKey] + 0.1);
    }
  } else if (params.outcome === 'not_started') {
    // If task was not started, down-weight slightly and tighten granularity to ultra-micro
    profile.strategyWeights[params.strategyKey] = Math.max(0.3, currentWeight - 0.2);
    profile.stepGranularity = 'ultra_micro';
    if (params.rating && params.rating <= 2) {
      profile.negativeRatingCount += 1;
    }
  }

  saveUserCalibration(profile);
  return profile;
}

/**
 * Adds an explicit user training instruction (e.g. "I like 20 min sprints", "Call me friend").
 */
export function addUserTrainingInstruction(instruction: string): UserCalibrationProfile {
  const trimmed = instruction.trim();
  if (!trimmed) return loadUserCalibration();

  const profile = loadUserCalibration();
  if (!profile.userTrainingNotes.includes(trimmed)) {
    profile.userTrainingNotes.push(trimmed);
  }

  // Parse duration if stated in instruction (e.g. "20 min", "20 minutes")
  const match = trimmed.match(/\b(\d{1,2})\s*(?:min|minute|minutes)\b/i);
  if (match && match[1]) {
    const mins = parseInt(match[1], 10);
    if (mins >= 5 && mins <= 60) {
      profile.preferredMinutes = mins;
    }
  }

  saveUserCalibration(profile);
  return profile;
}

/**
 * Removes a user training note.
 */
export function removeUserTrainingInstruction(index: number): UserCalibrationProfile {
  const profile = loadUserCalibration();
  profile.userTrainingNotes.splice(index, 1);
  saveUserCalibration(profile);
  return profile;
}

/**
 * Compiles the active user calibration into a rich system prompt injection.
 * Injected into both Voice Agent and LLM Coaching Plan routes.
 */
export function buildAdaptiveSystemPrompt(profile: UserCalibrationProfile): string {
  const sortedStrategies = (Object.keys(profile.strategyWeights) as StrategyKey[]).sort(
    (a, b) => profile.strategyWeights[b] - profile.strategyWeights[a]
  );
  const topStrategy = sortedStrategies[0] || 'task_shrinking';

  const notes = profile.userTrainingNotes.map((n) => `• "${n}"`).join('\n');

  return `
[LEARNED USER PROFILE & ADAPTIVE MODEL CALIBRATION]
• Preferred focus duration: ${profile.preferredMinutes} minutes (respect this whenever user asks to focus).
• Highest-performing strategy for this user: ${topStrategy} (weight: ${profile.strategyWeights[topStrategy].toFixed(2)}).
• Step sizing sensitivity: ${profile.stepGranularity === 'ultra_micro' ? 'Ultra-micro (<60s entry, zero cognitive friction)' : 'Standard (<2 min setup move)'}.
• Conversational tone: Warm, authentic human companion. Talk like an encouraging peer sitting next to them at a table, not a clinical therapist or robot. Use natural spoken conversational cadence, contractions, and warm casual validation.
• Explicit user training instructions:
${notes || '• None yet.'}
`.trim();
}
