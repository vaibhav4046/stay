/**
 * How long Stay waits through a pause, learned from this person.
 *
 * A turn that trails off ("I need to, um, send that and,") is held open so Stay does not talk into the pause. How long to hold is a guess
 * (2.2 s). Two things tell us if the guess suits this person: when they pick the sentence up again during the hold (and how long it took),
 * and when the hold runs out with nothing more said (the wait was wasted). The wait follows those, within safe limits. It is kept on this
 * device, shown in Settings in one plain sentence, and can be switched off or reset: nothing leaves the browser.
 */
export const DEFAULT_HOLD_MS = 2200;
export const MIN_HOLD_MS = 1400;
export const MAX_HOLD_MS = 3800;
const KEEP = 30; // the last thirty pauses are the evidence; older ones age out
const MIN_RESUMES = 5; // fewer than this and the default stands
const STORE_KEY = 'stay_patience_v1';
const ENABLED_KEY = 'stay_patience_enabled_v1';

export type HoldEvent = { k: 'r' | 'e'; ms: number }; // r: picked up again after `ms`; e: the hold ran out after `ms` with nothing more
export interface PatienceState {
  v: 1;
  events: HoldEvent[];
}

export const emptyPatience = (): PatienceState => ({ v: 1, events: [] });

const clamp = (n: number) => Math.round(Math.max(MIN_HOLD_MS, Math.min(MAX_HOLD_MS, n)));

/** The nearest-rank percentile of a list (0 to 1). */
const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))];
};

/**
 * The wait for this person. Someone who often resumes late gets a longer wait (a little past their usual late resume, so most
 * pauses fit); someone whose holds nearly always run out unused gets a shorter one, so replies feel quicker.
 */
export function holdFromEvents(events: readonly HoldEvent[]): number {
  const resumes = events.filter((e) => e.k === 'r').map((e) => e.ms);
  const expired = events.length - resumes.length;
  let wait = DEFAULT_HOLD_MS;
  if (resumes.length >= MIN_RESUMES) wait = percentile(resumes, 0.85) * 1.3 + 150;
  if (events.length >= 8 && expired / events.length >= 0.75) wait = Math.min(wait, DEFAULT_HOLD_MS) * 0.8;
  return clamp(wait);
}

export function addEvent(state: PatienceState, e: HoldEvent): PatienceState {
  if (!Number.isFinite(e.ms) || e.ms < 0 || e.ms > 20_000) return state; // a stale timer or a clock jump is not a pause
  return { v: 1, events: [...state.events, { k: e.k, ms: Math.round(e.ms) }].slice(-KEEP) };
}

/** One plain sentence for Settings. */
export function describePatience(state: PatienceState, enabled = true): string {
  if (!enabled) return `Stay waits ${(DEFAULT_HOLD_MS / 1000).toFixed(1)} seconds when you trail off. Learning is off.`;
  const resumes = state.events.filter((e) => e.k === 'r').length;
  if (resumes < MIN_RESUMES) return `Stay waits ${(DEFAULT_HOLD_MS / 1000).toFixed(1)} seconds when you trail off. It starts learning your pace after a few pauses.`;
  return `Stay waits about ${(holdFromEvents(state.events) / 1000).toFixed(1)} seconds when you trail off, learned from your last ${state.events.length} pauses.`;
}

// ---- this device -----------------------------------------------------------------------------------------------------------------------

export function patienceEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setPatienceEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // private mode: this page only
  }
}

export function loadPatience(): PatienceState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORE_KEY) || 'null') as PatienceState | null;
    if (raw && raw.v === 1 && Array.isArray(raw.events)) {
      return { v: 1, events: raw.events.filter((e) => e && (e.k === 'r' || e.k === 'e') && Number.isFinite(e.ms)).slice(-KEEP) };
    }
  } catch {
    // unreadable: start again
  }
  return emptyPatience();
}

export function resetPatience(): void {
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {
    // nothing to forget
  }
}

/** What the voice uses right now. Falls back to the default whenever learning is off or there is no storage. */
export function currentHoldMs(): number {
  return patienceEnabled() ? holdFromEvents(loadPatience().events) : DEFAULT_HOLD_MS;
}

/** Called by the voice each time a hold ends. A no-op while learning is off. */
export function recordHold(kind: 'resumed' | 'expired', afterMs: number): void {
  if (!patienceEnabled()) return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(addEvent(loadPatience(), { k: kind === 'resumed' ? 'r' : 'e', ms: afterMs })));
  } catch {
    // private mode: not remembered
  }
}
