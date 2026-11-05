/**
 * How long Stay's replies should be, learned from this person.
 *
 * Someone who keeps cutting in while Stay is talking is telling it, without words, that the replies are too long. The app counts replies
 * and cut-ins (on this device only) and, when cut-ins are common, adds one line to what the model is told: keep each reply to one short
 * sentence. It follows the last twenty replies, so it relaxes again when the person stops cutting in. It shares its switch and its reset
 * with the pause learning (patience.ts): one place in Settings, nothing leaves the browser.
 */
import { patienceEnabled } from './patience';

const KEY = 'stay_reply_style_v1';
const KEEP = 40; // events kept: replies ('r') and cut-ins ('c'), newest last
const WINDOW = 20; // the replies that count
export const MIN_REPLIES = 6; // fewer than this and it says nothing
export const CUT_RATE = 0.35; // this share of recent replies cut into, or more

export type StyleEvent = 'r' | 'c';
export interface ReplyStyleState {
  v: 1;
  events: StyleEvent[];
}

export const emptyStyle = (): ReplyStyleState => ({ v: 1, events: [] });

/** A cut-in belongs to the reply it cut into: two in a row count once. */
export function addStyleEvent(state: ReplyStyleState, e: StyleEvent): ReplyStyleState {
  const last = state.events[state.events.length - 1];
  if (e === 'c' && (last === undefined || last === 'c')) return state;
  return { v: 1, events: [...state.events, e].slice(-KEEP) };
}

/** Replies and cut-ins among the last `WINDOW` replies. */
export function recentCounts(events: readonly StyleEvent[]): { replies: number; cuts: number } {
  let replies = 0;
  let cuts = 0;
  for (let i = events.length - 1; i >= 0 && replies < WINDOW; i--) {
    if (events[i] === 'r') replies++;
    else cuts++;
  }
  return { replies, cuts };
}

export function wantsShortReplies(events: readonly StyleEvent[]): boolean {
  const { replies, cuts } = recentCounts(events);
  return replies >= MIN_REPLIES && cuts / replies >= CUT_RATE;
}

/** The line added to what the model is told, or nothing. */
export const STYLE_LINE = 'This person often cuts in while you talk, so keep each reply to one short sentence.';

/** One plain sentence for Settings. */
export function describeStyle(state: ReplyStyleState, enabled = true): string {
  if (!enabled) return 'Replies stay at their usual length. Learning is off.';
  const { replies } = recentCounts(state.events);
  if (replies < MIN_REPLIES) return 'Stay will keep replies shorter if you often cut in. It starts after a few replies.';
  return wantsShortReplies(state.events)
    ? 'You often cut in, so Stay is keeping its replies short.'
    : 'Stay is keeping replies at their usual length: you let it finish.';
}

// ---- this device -----------------------------------------------------------------------------------------------------------------------

export function loadStyle(): ReplyStyleState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || 'null') as ReplyStyleState | null;
    if (raw && raw.v === 1 && Array.isArray(raw.events)) return { v: 1, events: raw.events.filter((e): e is StyleEvent => e === 'r' || e === 'c').slice(-KEEP) };
  } catch {
    // unreadable: start again
  }
  return emptyStyle();
}

function record(e: StyleEvent): void {
  if (!patienceEnabled()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(addStyleEvent(loadStyle(), e)));
  } catch {
    // private mode: not remembered
  }
}

export const recordReply = () => record('r');
export const recordCutIn = () => record('c');

export function resetStyle(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to forget
  }
}

/** What to add to the model's notes about this person right now: empty unless learning is on and cut-ins are common. */
export function styleLine(): string {
  try {
    return patienceEnabled() && wantsShortReplies(loadStyle().events) ? STYLE_LINE : '';
  } catch {
    return '';
  }
}
