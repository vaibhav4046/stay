/**
 * Local-only Active Session Persistence
 *
 * Persists the in-flight conversation turns, current plan, avoided task,
 * and focus timer state across page reloads in the browser's localStorage.
 *
 * Privacy & Safety Guarantees:
 * - 100% client-side: never uploads transcripts or uncommitted thoughts to any server.
 * - Zero raw audio: never persists PCM or audio buffers.
 * - Auto-expiry: automatically expires sessions older than 12 hours or from previous days.
 * - Single-wipe: completely wiped when user clicks "Clear" or "Delete all my data".
 */

import type { CoachPlanProposal } from '@/types/domain';
import type { VoiceTranscriptEntry } from '@/lib/voice/useVoiceAgent';

export type ActiveSessionStep = 'idle' | 'input' | 'plan' | 'timer' | 'outcome' | 'done';

export interface ActiveSessionState {
  id: string;
  date: string; // YYYY-MM-DD
  timestamp: number; // Unix ms
  transcripts: VoiceTranscriptEntry[];
  plan: CoachPlanProposal | null;
  avoidedTask: string | null;
  smallestNextAction: string | null;
  step: ActiveSessionStep;
  minutes: number;
  endsAt: number | null;
  selectedVoice?: string;
}

export const ACTIVE_SESSION_STORAGE_KEY = 'stay_active_session_v1';
export const ACTIVE_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Loads the active session from localStorage, enforcing the retention and expiry rules.
 * Returns null if no session exists, if the session is older than 12 hours, or if from a previous day.
 */
export function loadActiveSession(): ActiveSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as ActiveSessionState;
    if (!session || typeof session !== 'object') {
      clearActiveSession();
      return null;
    }

    const now = Date.now();
    // Rule 1: Expiry rule - reject sessions older than 12 hours
    if (typeof session.timestamp !== 'number' || now - session.timestamp > ACTIVE_SESSION_MAX_AGE_MS) {
      clearActiveSession();
      return null;
    }

    // Rule 2: Daily boundary - a new day starts a clean active session
    if (session.date !== todayIso()) {
      clearActiveSession();
      return null;
    }

    return session;
  } catch {
    clearActiveSession();
    return null;
  }
}

/**
 * Persists partial or full active session state.
 */
export function saveActiveSession(patch: Partial<ActiveSessionState>): ActiveSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = loadActiveSession();
    const updated: ActiveSessionState = {
      id: existing?.id || `sess-${Date.now().toString(36)}`,
      date: todayIso(),
      timestamp: Date.now(),
      transcripts: patch.transcripts ?? existing?.transcripts ?? [],
      plan: patch.plan !== undefined ? patch.plan : (existing?.plan ?? null),
      avoidedTask: patch.avoidedTask !== undefined ? patch.avoidedTask : (existing?.avoidedTask ?? null),
      smallestNextAction: patch.smallestNextAction !== undefined ? patch.smallestNextAction : (existing?.smallestNextAction ?? null),
      step: patch.step ?? existing?.step ?? 'input',
      minutes: patch.minutes ?? existing?.minutes ?? 5,
      endsAt: patch.endsAt !== undefined ? patch.endsAt : (existing?.endsAt ?? null),
      selectedVoice: patch.selectedVoice ?? existing?.selectedVoice,
    };

    window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return null;
  }
}

/**
 * Completely clears the active session from localStorage.
 */
export function clearActiveSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
