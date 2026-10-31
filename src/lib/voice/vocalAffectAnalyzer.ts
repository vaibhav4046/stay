/**
 * Vocal Affect & Acoustic State Analyzer
 * Extracts acoustic features (energy, zero-crossing rate, pitch variance, speech rate)
 * from PCM / time-domain audio buffers to classify user emotional affect (overwhelmed, hesitant, calm, energized)
 * and adapt coach pacing, micro-step sizing, and grounding interventions.
 */

export type AffectCategory = 'calm' | 'hesitant' | 'overwhelmed' | 'energized' | 'fatigued';

export interface AcousticFeatures {
  rmsEnergy: number;       // Root Mean Square amplitude [0..1]
  zeroCrossingRate: number;// High-frequency noise / fricative ratio [0..1]
  pitchEstimateHz: number; // Fundamental frequency F0 [Hz]
  pitchVariance: number;   // Pitch standard deviation / emotional jitter
  cadenceSyllablesPerSec: number; // Estimated speaking rate
}

export interface AffectAnalysisResult {
  category: AffectCategory;
  confidence: number;
  features: AcousticFeatures;
  recommendedCoachAction: 'hold_space' | 'shorten_step' | 'grounding_nudge' | 'maintain_pace';
  coachPacingModifier: number; // 0.8 = slower, 1.0 = normal, 1.2 = brisk
}

/**
 * Autocorrelation F0 pitch estimator on 16kHz audio chunk.
 */
function estimatePitchAutocorrelation(samples: Float32Array, sampleRate = 16000): number {
  const minFreq = 75; // Lowest human speech fundamental ~75Hz
  const maxFreq = 500;// Highest human speech fundamental ~500Hz
  const minPeriod = Math.floor(sampleRate / maxFreq);
  const maxPeriod = Math.floor(sampleRate / minFreq);

  let bestPeriod = 0;
  let maxCorr = -1;

  for (let period = minPeriod; period <= maxPeriod; period++) {
    let sum = 0;
    for (let i = 0; i < samples.length - period; i++) {
      sum += samples[i] * samples[i + period];
    }
    if (sum > maxCorr) {
      maxCorr = sum;
      bestPeriod = period;
    }
  }

  return bestPeriod > 0 ? sampleRate / bestPeriod : 0;
}

/**
 * Extracts acoustic features from PCM audio samples (Float32Array, normalized [-1..1]).
 */
export function extractAcousticFeatures(samples: Float32Array, sampleRate = 16000): AcousticFeatures {
  if (samples.length === 0) {
    return {
      rmsEnergy: 0,
      zeroCrossingRate: 0,
      pitchEstimateHz: 0,
      pitchVariance: 0,
      cadenceSyllablesPerSec: 0,
    };
  }

  // 1. RMS Energy
  let sumSq = 0;
  let zeroCrossings = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
    if (i > 0 && ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0))) {
      zeroCrossings++;
    }
  }
  const rmsEnergy = Math.min(1, Math.sqrt(sumSq / samples.length));
  const zeroCrossingRate = zeroCrossings / samples.length;

  // 2. Fundamental Frequency (F0)
  const pitchEstimateHz = estimatePitchAutocorrelation(samples, sampleRate);

  // 3. Cadence and energy bursts estimation
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const energyWindows: number[] = [];
  for (let i = 0; i < samples.length - windowSize; i += windowSize) {
    let winSum = 0;
    for (let j = 0; j < windowSize; j++) {
      winSum += samples[i + j] * samples[i + j];
    }
    energyWindows.push(Math.sqrt(winSum / windowSize));
  }

  // Syllable peaks: energy rises followed by drops
  let syllables = 0;
  for (let i = 1; i < energyWindows.length - 1; i++) {
    if (energyWindows[i] > 0.04 && energyWindows[i] > energyWindows[i - 1] && energyWindows[i] > energyWindows[i + 1]) {
      syllables++;
    }
  }
  const durationSec = Math.max(0.1, samples.length / sampleRate);
  const cadenceSyllablesPerSec = syllables / durationSec;

  // Pitch jitter / variance approximation
  const pitchVariance = Math.abs(pitchEstimateHz - 180) / 180;

  return {
    rmsEnergy,
    zeroCrossingRate,
    pitchEstimateHz,
    pitchVariance,
    cadenceSyllablesPerSec,
  };
}

/**
 * Classifies vocal affect and selects the optimal coaching adaptation.
 */
export function classifyVocalAffect(features: AcousticFeatures): AffectAnalysisResult {
  const { rmsEnergy, pitchEstimateHz, pitchVariance, cadenceSyllablesPerSec, zeroCrossingRate } = features;

  // Silence / empty audio baseline
  if (rmsEnergy === 0 && zeroCrossingRate === 0) {
    return {
      category: 'calm',
      confidence: 0.95,
      features,
      recommendedCoachAction: 'maintain_pace',
      coachPacingModifier: 1.0,
    };
  }

  // High pitch variance + high energy + rapid/erratic cadence -> Overwhelmed
  if (rmsEnergy > 0.15 && pitchVariance > 0.45 && (cadenceSyllablesPerSec > 4.5 || cadenceSyllablesPerSec < 1.0)) {
    return {
      category: 'overwhelmed',
      confidence: 0.88,
      features,
      recommendedCoachAction: 'shorten_step',
      coachPacingModifier: 0.82,
    };
  }

  // Very low energy + low cadence -> Fatigued / Shutdown
  if (rmsEnergy < 0.04 && cadenceSyllablesPerSec < 1.8) {
    return {
      category: 'fatigued',
      confidence: 0.84,
      features,
      recommendedCoachAction: 'grounding_nudge',
      coachPacingModifier: 0.85,
    };
  }

  // Low energy + moderate pitch variance + long pauses -> Hesitant / Avoidant
  if (rmsEnergy < 0.08 && cadenceSyllablesPerSec < 2.5) {
    return {
      category: 'hesitant',
      confidence: 0.81,
      features,
      recommendedCoachAction: 'hold_space',
      coachPacingModifier: 0.9,
    };
  }

  // High cadence + moderate energy -> Energized
  if (cadenceSyllablesPerSec >= 3.8 && rmsEnergy >= 0.08) {
    return {
      category: 'energized',
      confidence: 0.86,
      features,
      recommendedCoachAction: 'maintain_pace',
      coachPacingModifier: 1.1,
    };
  }

  // Baseline steady state
  return {
    category: 'calm',
    confidence: 0.92,
    features,
    recommendedCoachAction: 'maintain_pace',
    coachPacingModifier: 1.0,
  };
}
