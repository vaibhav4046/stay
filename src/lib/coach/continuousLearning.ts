/**
 * Continuous Learning Engine (Thompson Sampling Multi-Armed Bandit)
 * Models each coaching strategy as a Beta(alpha, beta) distribution.
 * Periodically samples from posterior distributions to select the highest-ROI
 * strategy for a user's barrier, balancing exploration and personalization.
 */

import type { StrategyKey, SessionOutcome } from '@/types/domain';

export interface BanditArm {
  strategy: StrategyKey;
  alpha: number; // Successes + prior
  beta: number;  // Failures + prior
  totalPulls: number;
  lastUpdated: string;
}

export interface ContinuousLearningState {
  arms: Record<StrategyKey, BanditArm>;
  explorationRate: number; // Temperature parameter
}

const STORAGE_KEY = 'stay_continuous_learning_bandit';

const DEFAULT_PRIORS: Record<StrategyKey, { alpha: number; beta: number }> = {
  task_shrinking: { alpha: 4.5, beta: 1.5 },         // Strongest baseline for ADHD paralysis
  implementation_intention: { alpha: 3.5, beta: 2.0 },// Strong for planning/forgetting
  timeboxing: { alpha: 3.0, beta: 2.5 },               // Good for time blindness
  reframing: { alpha: 2.5, beta: 2.5 },                // Good for shame / emotional block
};

/**
 * Standard Box-Muller normal sample approximation.
 */
function sampleNormal(mean = 0, stdDev = 1): number {
  const u1 = Math.max(1e-6, Math.random());
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

/**
 * Samples from a Gamma distribution using Marsaglia and Tsang method.
 */
function sampleGamma(shape: number, scale = 1.0): number {
  if (shape < 1) {
    return sampleGamma(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    const z = sampleNormal(0, 1);
    const v = 1 + c * z;
    if (v <= 0) continue;
    const v3 = v * v * v;
    const u = Math.random();
    if (u < 1 - 0.0331 * z * z * z * z) return d * v3 * scale;
    if (Math.log(u) < 0.5 * z * z + d * (1 - v3 + Math.log(v3))) return d * v3 * scale;
  }
}

/**
 * Samples from Beta(alpha, beta) using ratio of Gamma random variables.
 */
export function sampleBeta(alpha: number, beta: number): number {
  const ga = sampleGamma(Math.max(0.1, alpha), 1.0);
  const gb = sampleGamma(Math.max(0.1, beta), 1.0);
  if (ga + gb === 0) return 0.5;
  return ga / (ga + gb);
}

/**
 * Loads or initializes the Thompson Sampling bandit state from storage.
 */
export function loadBanditState(): ContinuousLearningState {
  if (typeof window === 'undefined') {
    return buildDefaultBanditState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultBanditState();
    const parsed = JSON.parse(raw) as ContinuousLearningState;
    if (!parsed?.arms) return buildDefaultBanditState();
    return parsed;
  } catch {
    return buildDefaultBanditState();
  }
}

function buildDefaultBanditState(): ContinuousLearningState {
  const keys: StrategyKey[] = ['task_shrinking', 'implementation_intention', 'timeboxing', 'reframing'];
  const arms = {} as Record<StrategyKey, BanditArm>;
  for (const k of keys) {
    arms[k] = {
      strategy: k,
      alpha: DEFAULT_PRIORS[k]?.alpha ?? 2.0,
      beta: DEFAULT_PRIORS[k]?.beta ?? 2.0,
      totalPulls: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
  return { arms, explorationRate: 0.15 };
}

export function saveBanditState(state: ContinuousLearningState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

/**
 * Selects the optimal strategy arm using Thompson Sampling.
 */
export function selectStrategyViaBandit(
  state: ContinuousLearningState,
  allowedStrategies: StrategyKey[] = ['task_shrinking', 'implementation_intention', 'timeboxing', 'reframing']
): { selected: StrategyKey; samples: Record<StrategyKey, number> } {
  const samples = {} as Record<StrategyKey, number>;
  let bestStrategy: StrategyKey = allowedStrategies[0];
  let maxSample = -Infinity;

  for (const strategy of allowedStrategies) {
    const arm = state.arms[strategy] || {
      strategy,
      alpha: 2,
      beta: 2,
      totalPulls: 0,
      lastUpdated: new Date().toISOString(),
    };
    const s = sampleBeta(arm.alpha, arm.beta);
    samples[strategy] = Math.round(s * 1000) / 1000;
    if (s > maxSample) {
      maxSample = s;
      bestStrategy = strategy;
    }
  }

  return { selected: bestStrategy, samples };
}

/**
 * Updates bandit arm posterior based on user session outcome and rating.
 */
export function updateBanditOutcome(
  strategy: StrategyKey,
  outcome: SessionOutcome,
  rating: number | null = null
): ContinuousLearningState {
  const state = loadBanditState();
  const arm = state.arms[strategy] || {
    strategy,
    alpha: 2,
    beta: 2,
    totalPulls: 0,
    lastUpdated: new Date().toISOString(),
  };

  // Positive weight derivation
  let reward = 0;
  if (outcome === 'started') reward = 1.0;
  else if (outcome === 'partly_started') reward = 0.65;
  else if (outcome === 'paused_or_stopped') reward = 0.25;
  else reward = 0.0; // not_started

  // If user provided a 1-5 rating, incorporate it
  if (typeof rating === 'number' && rating >= 1 && rating <= 5) {
    const normRating = (rating - 1) / 4; // 0..1
    reward = reward * 0.6 + normRating * 0.4;
  }

  // Update Posterior
  arm.alpha += reward;
  arm.beta += (1.0 - reward);
  arm.totalPulls += 1;
  arm.lastUpdated = new Date().toISOString();

  state.arms[strategy] = arm;
  saveBanditState(state);
  return state;
}
