/**
 * Call mode: a phone-call-style session in the browser (AssemblyAI streaming STT + TTS, same pipeline as Talk).
 * Pure decisions live here so they are unit-tested; the overlay only renders and wires them.
 * Not a phone call: Stay can only ring you while this page is open.
 */

export const CALL_MAX_MS = 10 * 60_000;
/** Quiet this long while Stay is listening before it checks in. */
export const NUDGE_AFTER_MS = 25_000;
export const MAX_NUDGES = 2;
/** After the last nudge, this much more quiet ends the call kindly. */
export const GIVE_UP_AFTER_MS = 30_000;

export type CallAction = 'none' | 'nudge' | 'wrap';

export interface CallClock {
  /** ms since the call connected */
  elapsedMs: number;
  /** ms since anyone last spoke (user speech, or Stay finishing a reply) */
  silentMs: number;
  nudgesSent: number;
  /** true only while Stay is idle-listening; never nudge over speech, thinking or reconnects */
  listening: boolean;
}

export function nextCallAction({ elapsedMs, silentMs, nudgesSent, listening }: CallClock): CallAction {
  if (elapsedMs >= CALL_MAX_MS) return 'wrap';
  if (!listening) return 'none';
  if (nudgesSent >= MAX_NUDGES) return silentMs >= GIVE_UP_AFTER_MS ? 'wrap' : 'none';
  return silentMs >= NUDGE_AFTER_MS ? 'nudge' : 'none';
}

/** Instructions (start with 'Say ') so the model words them; each is one short, pressure-free line. */
export const NUDGE_INSTRUCTIONS: readonly string[] = [
  'Say one short, warm line, under ten words, checking they are still there. Ask nothing else.',
  'Say one short line, under twelve words, offering a much smaller first step if this feels like too much.',
];

export const WRAP_INSTRUCTION =
  'Say one warm sentence, under fifteen words, closing the call and saying you are here whenever they want to talk.';

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// ---- "Call me later": Stay rings in-page at a chosen time (tab must be open) ----
const KEY = 'stay:scheduled-call:v1';
export const CALL_ME_CHOICES = [5, 15, 30] as const;

export function scheduleCall(minutes: number, now = Date.now()): number | null {
  if (!CALL_ME_CHOICES.includes(minutes as (typeof CALL_ME_CHOICES)[number])) return null;
  const at = now + minutes * 60_000;
  try {
    window.localStorage.setItem(KEY, String(at));
  } catch {
    return null; // storage blocked: do not pretend a call is booked
  }
  return at;
}

export function scheduledCallAt(): number | null {
  try {
    const n = Number(window.localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function cancelScheduledCall(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

/** True once, then clears. A call missed by more than 30 min is dropped, not replayed. */
export function takeDueCall(now = Date.now()): boolean {
  const at = scheduledCallAt();
  if (at === null || at > now) return false;
  cancelScheduledCall();
  return now - at <= 30 * 60_000;
}
