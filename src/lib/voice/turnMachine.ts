/**
 * §6.1 & §6.2 — Pure Duplex Turn State Machine & Unified Turn Ledger (`src/lib/voice/turnMachine.ts`)
 *
 * Exact 12 canonical states:
 * IDLE, CONSENT_NEEDED, CONNECTING, LISTENING, TRANSCRIBING, THINKING,
 * SPEAKING, INTERRUPTED, RECONNECTING, PAUSED, TEXT_ONLY, ERROR
 */

export const TURN_MACHINE_STATES = [
  'IDLE',
  'CONSENT_NEEDED',
  'CONNECTING',
  'LISTENING',
  'TRANSCRIBING',
  'THINKING',
  'SPEAKING',
  'INTERRUPTED',
  'RECONNECTING',
  'PAUSED',
  'TEXT_ONLY',
  'ERROR',
] as const;

export type TurnMachineState = (typeof TURN_MACHINE_STATES)[number];

export type TurnMachineEvent =
  | { type: 'REQUEST_MIC'; hasConsent: boolean }
  | { type: 'GRANT_CONSENT' }
  | { type: 'DECLINE_CONSENT_TEXT_ONLY' }
  | { type: 'SOCKETS_READY' }
  | { type: 'SPEECH_STARTED' }
  | { type: 'PARTIAL_TRANSCRIPT' }
  | { type: 'FINAL_TRANSCRIPT' }
  | { type: 'EMPTY_OR_HESITATION_TURN' }
  | { type: 'REPLY_AUDIO_STARTED' }
  | { type: 'REPLY_FINISHED' }
  | { type: 'BARGE_IN_COMMIT' }
  | { type: 'CANCELLED_OR_TIMEOUT' }
  | { type: 'SOCKET_DROPPED' }
  | { type: 'RECONNECTED' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SWITCH_TEXT_ONLY' }
  | { type: 'FATAL_ERROR'; message?: string }
  | { type: 'STOP' };

export const LEGAL_STATE_TRANSITIONS: Readonly<
  Record<TurnMachineState, readonly TurnMachineState[]>
> = {
  IDLE: ['CONSENT_NEEDED', 'CONNECTING', 'TEXT_ONLY', 'THINKING', 'ERROR'],
  CONSENT_NEEDED: ['CONNECTING', 'TEXT_ONLY', 'IDLE', 'ERROR'],
  CONNECTING: ['LISTENING', 'RECONNECTING', 'TEXT_ONLY', 'IDLE', 'ERROR'],
  LISTENING: [
    'TRANSCRIBING',
    'THINKING',
    'SPEAKING',
    'PAUSED',
    'RECONNECTING',
    'TEXT_ONLY',
    'IDLE',
    'ERROR',
  ],
  TRANSCRIBING: [
    'LISTENING',
    'THINKING',
    'PAUSED',
    'RECONNECTING',
    'TEXT_ONLY',
    'IDLE',
    'ERROR',
  ],
  THINKING: [
    'SPEAKING',
    'INTERRUPTED',
    'LISTENING',
    'PAUSED',
    'RECONNECTING',
    'TEXT_ONLY',
    'IDLE',
    'ERROR',
  ],
  SPEAKING: [
    'INTERRUPTED',
    'LISTENING',
    'PAUSED',
    'RECONNECTING',
    'TEXT_ONLY',
    'IDLE',
    'ERROR',
  ],
  INTERRUPTED: [
    'LISTENING',
    'TRANSCRIBING',
    'PAUSED',
    'RECONNECTING',
    'TEXT_ONLY',
    'IDLE',
    'ERROR',
  ],
  RECONNECTING: ['LISTENING', 'CONNECTING', 'TEXT_ONLY', 'IDLE', 'ERROR'],
  PAUSED: ['LISTENING', 'CONNECTING', 'TEXT_ONLY', 'IDLE', 'ERROR'],
  TEXT_ONLY: ['CONSENT_NEEDED', 'CONNECTING', 'THINKING', 'IDLE', 'ERROR'],
  ERROR: ['IDLE', 'CONNECTING', 'CONSENT_NEEDED', 'TEXT_ONLY'],
};

export interface TransitionResult {
  state: TurnMachineState;
  changed: boolean;
  rejected: boolean;
  reason?: string;
}

export function canTransition(from: TurnMachineState, to: TurnMachineState): boolean {
  if (from === to) return true;
  return LEGAL_STATE_TRANSITIONS[from].includes(to);
}

export function transitionToState(
  current: TurnMachineState,
  target: TurnMachineState
): TransitionResult {
  if (current === target) {
    return { state: current, changed: false, rejected: false };
  }
  if (!canTransition(current, target)) {
    return {
      state: current,
      changed: false,
      rejected: true,
      reason: `Illegal transition from ${current} to ${target}`,
    };
  }
  return { state: target, changed: true, rejected: false };
}

export function turnMachineReducer(
  current: TurnMachineState,
  event: TurnMachineEvent
): TransitionResult {
  switch (event.type) {
    case 'REQUEST_MIC': {
      const next: TurnMachineState = event.hasConsent ? 'CONNECTING' : 'CONSENT_NEEDED';
      return transitionToState(current, next);
    }
    case 'GRANT_CONSENT': {
      if (current !== 'CONSENT_NEEDED') {
        return {
          state: current,
          changed: false,
          rejected: true,
          reason: `GRANT_CONSENT only valid in CONSENT_NEEDED (was ${current})`,
        };
      }
      return transitionToState(current, 'CONNECTING');
    }
    case 'DECLINE_CONSENT_TEXT_ONLY':
    case 'SWITCH_TEXT_ONLY':
      return transitionToState(current, 'TEXT_ONLY');

    case 'SOCKETS_READY': {
      if (current !== 'CONNECTING' && current !== 'RECONNECTING' && current !== 'PAUSED') {
        return {
          state: current,
          changed: false,
          rejected: true,
          reason: `SOCKETS_READY not allowed from ${current}`,
        };
      }
      return transitionToState(current, 'LISTENING');
    }
    case 'SPEECH_STARTED':
    case 'PARTIAL_TRANSCRIPT': {
      if (current === 'LISTENING' || current === 'INTERRUPTED') {
        return transitionToState(current, 'TRANSCRIBING');
      }
      if (current === 'TRANSCRIBING') {
        return { state: current, changed: false, rejected: false };
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `${event.type} not allowed in ${current}`,
      };
    }
    case 'EMPTY_OR_HESITATION_TURN': {
      if (current === 'TRANSCRIBING' || current === 'INTERRUPTED') {
        return transitionToState(current, 'LISTENING');
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `EMPTY_OR_HESITATION_TURN not allowed in ${current}`,
      };
    }
    case 'FINAL_TRANSCRIPT': {
      if (
        current === 'TRANSCRIBING' ||
        current === 'LISTENING' ||
        current === 'IDLE' ||
        current === 'TEXT_ONLY'
      ) {
        return transitionToState(current, 'THINKING');
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `FINAL_TRANSCRIPT not allowed in ${current}`,
      };
    }
    case 'REPLY_AUDIO_STARTED': {
      if (current === 'THINKING' || current === 'LISTENING') {
        return transitionToState(current, 'SPEAKING');
      }
      if (current === 'SPEAKING') {
        return { state: current, changed: false, rejected: false };
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `REPLY_AUDIO_STARTED not allowed in ${current}`,
      };
    }
    case 'REPLY_FINISHED': {
      if (current === 'SPEAKING' || current === 'THINKING') {
        return transitionToState(current, 'LISTENING');
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `REPLY_FINISHED not allowed in ${current}`,
      };
    }
    case 'BARGE_IN_COMMIT': {
      if (current === 'SPEAKING' || current === 'THINKING') {
        return transitionToState(current, 'INTERRUPTED');
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `BARGE_IN_COMMIT only allowed in SPEAKING or THINKING (was ${current})`,
      };
    }
    case 'CANCELLED_OR_TIMEOUT': {
      if (current === 'INTERRUPTED') {
        return transitionToState(current, 'LISTENING');
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `CANCELLED_OR_TIMEOUT only allowed in INTERRUPTED (was ${current})`,
      };
    }
    case 'SOCKET_DROPPED': {
      if (
        current === 'CONNECTING' ||
        current === 'LISTENING' ||
        current === 'TRANSCRIBING' ||
        current === 'THINKING' ||
        current === 'SPEAKING' ||
        current === 'INTERRUPTED'
      ) {
        return transitionToState(current, 'RECONNECTING');
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `SOCKET_DROPPED not allowed in ${current}`,
      };
    }
    case 'RECONNECTED': {
      if (current === 'RECONNECTING') {
        return transitionToState(current, 'LISTENING');
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `RECONNECTED only allowed in RECONNECTING (was ${current})`,
      };
    }
    case 'PAUSE': {
      return transitionToState(current, 'PAUSED');
    }
    case 'RESUME': {
      if (current === 'PAUSED') {
        return transitionToState(current, 'LISTENING');
      }
      return {
        state: current,
        changed: false,
        rejected: true,
        reason: `RESUME only allowed in PAUSED (was ${current})`,
      };
    }
    case 'FATAL_ERROR': {
      return transitionToState(current, 'ERROR');
    }
    case 'STOP': {
      return transitionToState(current, 'IDLE');
    }
  }
}

// ============================================================================
// §6.2 — Unified Turn Object & Single-Bubble Deduplication
// ============================================================================

export interface TurnWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TurnCorrection {
  at: number;
  from: string;
  to: string;
  kind: 'scratch' | 'replace' | 'NumberFormat' | 'filler' | 'manual';
}

export type TurnEngine = 'assemblyai' | 'managed-agent' | 'device' | 'azure' | 'text';

export interface TurnObject {
  id: string;
  sessionEpoch: number;
  replyEpoch: number;
  turnOrder?: number;
  speaker: 'user' | 'stay';
  status: 'partial' | 'final' | 'interrupted' | 'cancelled' | 'error';
  verbatimText: string;
  cleanText: string;
  translatedText?: string;
  sourceLanguage: string;
  targetLanguage?: string;
  words?: TurnWord[];
  heardText?: string;
  unheardText?: string;
  engine: TurnEngine;
  corrections: TurnCorrection[];
  startedAt: number;
  finalizedAt?: number;
  audioStartAt?: number;
  audioEndAt?: number;
}

export function turnKey(sessionEpoch: number, turnOrder: number): string {
  return `u-${sessionEpoch}-${turnOrder}`;
}

/**
 * Upserts a partial or final user turn in the ledger:
 * - Drops any frame belonging to an older sessionEpoch.
 * - A partial updates the same bubble in-place (keyed by sessionEpoch + turn_order).
 * - A final replaces that partial bubble once and never creates a second bubble for the same turn_order.
 */
export function upsertUserTurn(
  turns: TurnObject[],
  activeSessionEpoch: number,
  incoming: {
    sessionEpoch: number;
    replyEpoch: number;
    turnOrder: number;
    status: 'partial' | 'final';
    verbatimText: string;
    cleanText?: string;
    sourceLanguage?: string;
    words?: TurnWord[];
    engine?: TurnEngine;
    now?: number;
  }
): TurnObject[] {
  if (incoming.sessionEpoch < activeSessionEpoch) {
    return turns; // drop stale session epoch
  }
  const trimmed = incoming.verbatimText.trim();
  if (!trimmed) return turns;

  const id = turnKey(incoming.sessionEpoch, incoming.turnOrder);
  const now = incoming.now ?? Date.now();
  const idx = turns.findIndex((t) => t.id === id);

  if (idx !== -1) {
    const existing = turns[idx];
    // Once finalized, ignore late partials or duplicate finals for the same turnOrder
    if (existing.status === 'final' && incoming.status === 'partial') {
      return turns;
    }
    const updated: TurnObject = {
      ...existing,
      status: incoming.status,
      verbatimText: trimmed,
      cleanText: (incoming.cleanText ?? trimmed).trim(),
      words: incoming.words ?? existing.words,
      ...(incoming.status === 'final' && !existing.finalizedAt ? { finalizedAt: now } : {}),
    };
    const next = [...turns];
    next[idx] = updated;
    return next;
  }

  const created: TurnObject = {
    id,
    sessionEpoch: incoming.sessionEpoch,
    replyEpoch: incoming.replyEpoch,
    turnOrder: incoming.turnOrder,
    speaker: 'user',
    status: incoming.status,
    verbatimText: trimmed,
    cleanText: (incoming.cleanText ?? trimmed).trim(),
    sourceLanguage: incoming.sourceLanguage ?? 'en',
    words: incoming.words,
    engine: incoming.engine ?? 'assemblyai',
    corrections: [],
    startedAt: now,
    ...(incoming.status === 'final' ? { finalizedAt: now } : {}),
  };
  return [...turns, created];
}

// ============================================================================
// §6.3 — Two-Stage Barge-In, Echo Guard, Backchannel Filter & Heard/Unheard Split
// ============================================================================

/**
 * §6.3.4 Backchannels ("yeah", "mm-hm", "uh-huh", "okay", "right") never interrupt.
 * Note: "sure" is explicitly excluded per §6.3.4.
 */
const ALLOWED_BACKCHANNELS = new Set([
  'yeah',
  'yep',
  'mm-hm',
  'mm-hmm',
  'mm hm',
  'mm hmm',
  'mmhm',
  'mhm',
  'uh-huh',
  'uh huh',
  'uhhuh',
  'okay',
  'ok',
  'right',
]);

const EXPLICIT_STOP_RE =
  /\b(stop|wait|pause|hold on|actually|no|hang on|cancel|quiet|enough)\b/i;

const HESITATION_ONLY_RE = /^(?:um+|uh+|er+|ah+|hmm+|mm+|\.+|\s+)+$/i;

export function isHesitationOrEmpty(text: string): boolean {
  const clean = text.trim();
  if (!clean) return true;
  return HESITATION_ONLY_RE.test(clean);
}

export function isAllowedBackchannel(text: string): boolean {
  const clean = text
    .toLowerCase()
    .replace(/[.,!?…—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return true;
  if (clean === 'sure') return false; // Explicitly removed per §6.3.4
  return ALLOWED_BACKCHANNELS.has(clean);
}

export function shouldCommitBargeIn(partialText: string): boolean {
  const clean = partialText.trim();
  if (!clean || isHesitationOrEmpty(clean)) return false;
  if (EXPLICIT_STOP_RE.test(clean)) return true;
  if (isAllowedBackchannel(clean)) return false;
  // First partial with >= 1 non-backchannel word commits the barge-in
  const words = clean
    .toLowerCase()
    .replace(/[.,!?…—-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.some((w) => !ALLOWED_BACKCHANNELS.has(w) && !HESITATION_ONLY_RE.test(w));
}

/**
 * §6.3.5 Echo guard: ignore a SpeechStarted that arrives within 250 ms of TTS audio starting,
 * unless the mic RMS is clearly above the playback-correlated level.
 */
export function shouldIgnoreEchoSpeechStarted(params: {
  msSinceTtsStart: number;
  micRms: number;
  playbackRms: number;
}): boolean {
  if (params.msSinceTtsStart < 0 || params.msSinceTtsStart > 250) {
    return false;
  }
  const threshold = Math.max(0.12, params.playbackRms * 1.8);
  return params.micRms < threshold;
}

/**
 * §6.3.2 Computes heardText vs unheardText from actually rendered samples and WordBoundaries.
 */
export function splitHeardAndUnheard(
  fullText: string,
  words: ReadonlyArray<{ word: string; start: number; end: number }> | undefined,
  renderedSamples: number,
  sampleRate = 24000
): { heardText: string; unheardText: string; renderedMs: number } {
  const renderedMs = Math.max(0, Math.round((renderedSamples / sampleRate) * 1000));
  const cleanFull = fullText.trim();
  if (!cleanFull) {
    return { heardText: '', unheardText: '', renderedMs };
  }
  if (renderedSamples <= 0) {
    return { heardText: '', unheardText: cleanFull, renderedMs: 0 };
  }

  if (words && words.length > 0) {
    const heardWords: string[] = [];
    const unheardWords: string[] = [];
    for (const w of words) {
      // A word is considered heard if playback reached at least its start + 30ms (or midpoint)
      const midpoint = w.start + Math.min(40, Math.max(10, (w.end - w.start) * 0.35));
      if (renderedMs >= midpoint) {
        heardWords.push(w.word);
      } else {
        unheardWords.push(w.word);
      }
    }
    return {
      heardText: heardWords.join(' ').trim(),
      unheardText: unheardWords.join(' ').trim(),
      renderedMs,
    };
  }

  // Fallback proportional estimation if WordBoundaries have not arrived yet (150 wpm ~ 400ms/word)
  const tokens = cleanFull.split(/\s+/);
  const estimatedWordsHeard = Math.min(tokens.length, Math.max(1, Math.floor(renderedMs / 320)));
  return {
    heardText: tokens.slice(0, estimatedWordsHeard).join(' '),
    unheardText: tokens.slice(estimatedWordsHeard).join(' '),
    renderedMs,
  };
}
