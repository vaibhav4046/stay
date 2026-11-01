import type { VoiceVisualState } from '@/types/domain';

/**
 * The STAY Signal: one mapping from the real voice state and real audio levels to how the orb and wave move.
 * Pure functions, no DOM, so the rules (what drives the wave in which state) are unit-tested.
 */
export type SignalState = VoiceVisualState | 'complete';

/** Where the energy comes from. The microphone only drives the wave while listening; rendered output only while speaking. */
export type SignalSource = 'input' | 'output' | 'none';

export interface SignalLevels {
  /** microphone level 0..1 (0 when capture is off or stale) */
  input: number;
  /** level of the assistant audio being heard right now, 0..1 (0 after a cancel) */
  output: number;
}

export interface SignalLook {
  source: SignalSource;
  /** what the wave means in words, for tests and screen readers */
  meaning: 'resting' | 'pending' | 'capturing' | 'processing' | 'speaking' | 'stopped' | 'failed';
  tint: 'accent' | 'warm' | 'danger' | 'muted';
  /** a slow highlight travels along the wave (processing / connecting) */
  travel: boolean;
  /** only idle-like states breathe */
  breathe: boolean;
}

export function lookFor(state: SignalState): SignalLook {
  switch (state) {
    case 'listening':
    case 'transcribing':
      return { source: 'input', meaning: 'capturing', tint: 'accent', travel: false, breathe: false };
    case 'speaking':
    case 'backchannel':
      return { source: 'output', meaning: 'speaking', tint: 'accent', travel: false, breathe: false };
    case 'thinking':
      return { source: 'none', meaning: 'processing', tint: 'warm', travel: true, breathe: false };
    case 'connecting':
    case 'reconnecting':
      return { source: 'none', meaning: 'pending', tint: 'accent', travel: true, breathe: false };
    case 'interrupted':
      return { source: 'none', meaning: 'stopped', tint: 'accent', travel: false, breathe: false };
    case 'paused':
    case 'text_only_fallback':
      return { source: 'none', meaning: 'stopped', tint: 'muted', travel: false, breathe: false };
    case 'error':
      return { source: 'none', meaning: 'failed', tint: 'danger', travel: false, breathe: false };
    case 'complete':
      return { source: 'none', meaning: 'resting', tint: 'accent', travel: false, breathe: true };
    case 'idle':
    default:
      return { source: 'none', meaning: 'resting', tint: 'accent', travel: false, breathe: true };
  }
}

/** Below this the wave stays flat: room noise and a quiet pause must not look like speech. */
export const NOISE_FLOOR = 0.02;
export const ATTACK_MS = 60;
export const RELEASE_INPUT_MS = 220;
/** the assistant stops being audible the instant playback stops, so the output wave lets go faster */
export const RELEASE_OUTPUT_MS = 110;
export const BREATH_PERIOD_S = 3.6;

/** The level that should drive the wave right now, from the real levels. */
export function targetDrive(state: SignalState, levels: SignalLevels): number {
  const { source } = lookFor(state);
  const raw = source === 'input' ? levels.input : source === 'output' ? levels.output : 0;
  if (raw <= NOISE_FLOOR) return 0;
  // gentle expansion so ordinary speech fills the wave without ever clipping it
  return Math.min(1, Math.pow((raw - NOISE_FLOOR) / (1 - NOISE_FLOOR), 0.7) * 1.25);
}

/** Asymmetric smoothing: quick attack, softer release. States that mean "stopped" drop to zero at once (no ghost animation). */
export function smoothDrive(prev: number, target: number, dtMs: number, state: SignalState): number {
  const look = lookFor(state);
  if (look.meaning === 'stopped' || look.meaning === 'failed' || look.meaning === 'pending' || look.meaning === 'processing') return 0;
  const tau = target > prev ? ATTACK_MS : look.source === 'output' ? RELEASE_OUTPUT_MS : RELEASE_INPUT_MS;
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tau);
  const next = prev + (target - prev) * k;
  return next < 0.004 ? 0 : next;
}

/** A slow, low ambient swell for resting states only (period ~3.6 s). 0..1 */
export function breath(tSeconds: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * tSeconds) / BREATH_PERIOD_S);
}
