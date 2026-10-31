import { describe, it, expect } from 'vitest';
import {
  extractAcousticFeatures,
  classifyVocalAffect,
} from '@/lib/voice/vocalAffectAnalyzer';

describe('vocalAffectAnalyzer', () => {
  it('handles empty audio gracefully', () => {
    const empty = new Float32Array(0);
    const features = extractAcousticFeatures(empty);
    expect(features.rmsEnergy).toBe(0);
    expect(features.pitchEstimateHz).toBe(0);
    const result = classifyVocalAffect(features);
    expect(result.category).toBe('calm');
    expect(result.coachPacingModifier).toBe(1.0);
  });

  it('detects overwhelmed affect from high energy, jitter and high cadence', () => {
    const features = {
      rmsEnergy: 0.25,
      zeroCrossingRate: 0.3,
      pitchEstimateHz: 280,
      pitchVariance: 0.55,
      cadenceSyllablesPerSec: 5.2,
    };
    const result = classifyVocalAffect(features);
    expect(result.category).toBe('overwhelmed');
    expect(result.recommendedCoachAction).toBe('shorten_step');
    expect(result.coachPacingModifier).toBeLessThan(1.0);
  });

  it('detects fatigued / shutdown state from low energy and low cadence', () => {
    const features = {
      rmsEnergy: 0.02,
      zeroCrossingRate: 0.05,
      pitchEstimateHz: 120,
      pitchVariance: 0.1,
      cadenceSyllablesPerSec: 1.2,
    };
    const result = classifyVocalAffect(features);
    expect(result.category).toBe('fatigued');
    expect(result.recommendedCoachAction).toBe('grounding_nudge');
  });

  it('detects energized cadence and maintains brisk pace', () => {
    const features = {
      rmsEnergy: 0.12,
      zeroCrossingRate: 0.15,
      pitchEstimateHz: 200,
      pitchVariance: 0.2,
      cadenceSyllablesPerSec: 4.0,
    };
    const result = classifyVocalAffect(features);
    expect(result.category).toBe('energized');
    expect(result.coachPacingModifier).toBeGreaterThan(1.0);
  });
});
