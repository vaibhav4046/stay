/**
 * When does the orb become a person? Pure state machine (no React, no clock of its own) so the rules are testable.
 *
 *  - Stay starts speaking            -> the figure forms and stays while she speaks, then lingers a moment
 *  - the user taps the face button   -> the figure forms and stays ("pinned") until tapped again
 *  - the user starts talking         -> back to the topical shape (and any pin is released)
 *  - a keyword shape fires           -> back to the topical shape, even mid-reply (the new shape wins)
 */
export const HOLD_AFTER_SPEECH_MS = 2600;

export interface PresenceState {
  on: boolean;
  pinned: boolean;
  /** When the figure may leave after speech ended (ms on the caller's clock). */
  leaveAt: number;
  speaking: boolean;
  topicKey: string;
}

export interface PresenceInputs {
  speaking: boolean;
  userTalking: boolean;
  /** Key of the topical shape (keyword/emoji/library); 'orb' = resting sphere. */
  topicKey: string;
  now: number;
}

export const INITIAL_PRESENCE: PresenceState = { on: false, pinned: false, leaveAt: 0, speaking: false, topicKey: 'orb' };

export function nextPresence(prev: PresenceState, inp: PresenceInputs): PresenceState {
  let { on, pinned, leaveAt } = prev;
  const topicChanged = inp.topicKey !== prev.topicKey && inp.topicKey !== 'orb'; // resting back to the orb is not a keyword
  const speechStarted = inp.speaking && !prev.speaking;
  const speechEnded = !inp.speaking && prev.speaking;

  if (topicChanged) {
    on = false;
    pinned = false;
  }
  if (inp.userTalking) {
    on = false;
    pinned = false;
  } else if (speechStarted && !topicChanged) {
    on = true;
    leaveAt = Infinity;
  }
  if (speechEnded && on) leaveAt = inp.now + HOLD_AFTER_SPEECH_MS;
  if (on && !pinned && !inp.speaking && inp.now >= leaveAt) on = false;
  return { on, pinned, leaveAt, speaking: inp.speaking, topicKey: inp.topicKey };
}

/** The face button: pin the figure, or release it (it then leaves when she is not speaking). */
export function togglePin(prev: PresenceState, now: number): PresenceState {
  if (!prev.pinned) return { ...prev, pinned: true, on: true, leaveAt: Infinity };
  return { ...prev, pinned: false, on: prev.speaking, leaveAt: now };
}
