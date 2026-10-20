/**
 * The first-open-of-the-day greeting: short, warm, never guilt. It uses only real data (name, yesterday's wins, what was left
 * open) and leaves anything it does not know out. No streaks, no overdue language, no counting what was not done.
 * Content rules are enforced by isCalm() and tested over many days and inputs.
 */
import type { CoachSessionRecord } from '@/types/domain';
import type { TodayItem } from '@/lib/coach/todayList';
import { localDay, localDayOf, partOfDay, yesterdayOf, type PartOfDay } from '@/lib/coach/time';

/** Words and phrases a greeting must never contain. */
export const BANNED_PHRASES = ['overdue', 'behind', 'failed', 'failure', 'lazy', 'streak lost', 'lost your streak', 'should have', 'should\'ve', 'missed', 'you didn\'t', 'no excuse', 'catch up', 'only '] as const;

export function isCalm(text: string): boolean {
  const t = text.toLowerCase();
  return !BANNED_PHRASES.some((p) => t.includes(p));
}

export type OptionId = 'start_small' | 'dump' | 'plan_day' | 'resume' | 'wrap' | 'sit_with_me';
export interface GreetingOption {
  id: OptionId;
  label: string;
}

export interface GreetingInput {
  now: Date;
  name: string | null;
  winsYesterday: number;
  /** Texts of items that were left open before today (the first is named). */
  openFromBefore: string[];
  quiet: boolean;
}

export interface DailyGreeting {
  text: string;
  /** What Stay says aloud on the first voice session of the day. Empty in quiet mode. */
  spoken: string;
  options: GreetingOption[];
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
/** Each slot hashes the day separately, so the openers, win lines and questions vary independently from day to day. */
const pick = <T,>(list: readonly T[], seed: number, slot: number): T => list[Math.abs(Math.imul(seed + 1, 2654435761) ^ Math.imul(slot + 1, 40503) ^ (seed >>> 3)) % list.length];
const dayNumber = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);

const OPENERS: Record<PartOfDay, ((n: string) => string)[]> = {
  morning: [(n) => `Good morning${n}.`, (n) => `Morning${n}. Glad you are here.`, (n) => `Hello${n}. A fresh morning.`],
  afternoon: [(n) => `Good afternoon${n}.`, (n) => `Hello${n}. Nice to see you.`, (n) => `Hi${n}. Glad you came by.`],
  evening: [(n) => `Good evening${n}.`, (n) => `Hi${n}. Settling in for the evening?`, (n) => `Hello${n}. Nice to see you.`],
  night: [(n) => `Hi${n}. It is late, so nothing big is needed.`, (n) => `Hello${n}. Quiet hour. No pressure at all.`, (n) => `Hi${n}. Glad you are here, even at this hour.`],
};

const WINS: Array<(w: number) => string> = [
  (w) => `Yesterday you got ${w === 1 ? 'one thing' : `${w} things`} done.`,
  (w) => `${w === 1 ? 'One win' : `${w} wins`} yesterday. That counts.`,
  (w) => `You finished ${w === 1 ? 'one thing' : `${w} things`} yesterday. Nice.`,
];

const OPEN_LINES: Array<(t: string) => string> = [
  (t) => `"${t}" is still here whenever you want it. No rush.`,
  (t) => `If you like, we can pick "${t}" back up. Or not.`,
  (t) => `"${t}" is waiting, gently.`,
];

const ASKS = ['What would help today?', 'What would feel kind to start with?', 'What would help most right now?'];

function chooseOptions(part: PartOfDay, openItem: string | undefined): GreetingOption[] {
  const A: Record<OptionId, GreetingOption> = {
    start_small: { id: 'start_small', label: 'One small start' },
    dump: { id: 'dump', label: 'Empty my head' },
    plan_day: { id: 'plan_day', label: 'Plan my day' },
    resume: { id: 'resume', label: openItem ? `Pick up ${clip(openItem, 20)}` : 'Pick something up' },
    wrap: { id: 'wrap', label: 'Wrap up the day' },
    sit_with_me: { id: 'sit_with_me', label: 'Just keep me company' },
  };
  const order: OptionId[] =
    part === 'night' ? ['sit_with_me', 'dump', 'start_small'] :
    part === 'evening' ? ['wrap', 'dump', 'start_small'] :
    ['start_small', 'dump', 'plan_day'];
  if (openItem) order.splice(1, 0, 'resume');
  return order.slice(0, 3).map((id) => A[id]);
}

export function buildDailyGreeting(input: GreetingInput): DailyGreeting {
  const { now, quiet } = input;
  const part = partOfDay(now.getHours());
  const name = input.name ? `, ${clip(input.name, 16)}` : '';
  const seed = dayNumber(now) + (input.name?.length ?? 0);
  // the person's own item text is quoted back; if it happens to hold a banned word, it is simply not quoted
  const open = input.openFromBefore.find((t) => t.trim() && isCalm(t));
  const lines = [pick(OPENERS[part], seed, 0)(name)];
  if (input.winsYesterday > 0) lines.push(pick(WINS, seed, 1)(input.winsYesterday));
  // one open item is named, never a pile: counting what is left is what makes people dread the app
  if (open) lines.push(pick(OPEN_LINES, seed, 2)(clip(open, 40)));
  const options = chooseOptions(part, open);
  const ask = pick(ASKS, seed, 3);
  const text = `${lines.join(' ')} ${ask}`;
  const spoken = quiet ? '' : `${lines.slice(0, 2).join(' ')} ${ask} ${options.map((o) => o.label.toLowerCase()).join(', or ')}?`;
  return { text, spoken, options };
}

// ---- inputs from real data ----------------------------------------------------------------------------------------

/** Wins yesterday: list items finished yesterday plus focus blocks that got started yesterday (local day). */
export function countWinsYesterday(items: TodayItem[], sessions: CoachSessionRecord[], now = new Date()): number {
  const y = yesterdayOf(now);
  const done = items.filter((i) => i.done && localDayOf(i.doneAt) === y).length;
  const started = sessions.filter((s) => !s.isSample && (s.outcome === 'started' || s.outcome === 'partly_started') && localDayOf(s.createdAt) === y).length;
  return done + started;
}

/** Open items created before today, newest first. */
export function openFromBefore(items: TodayItem[], now = new Date()): string[] {
  const today = localDay(now);
  return items.filter((i) => !i.done && (localDayOf(i.createdAt) ?? today) < today).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((i) => i.text);
}

// ---- once-a-day state ---------------------------------------------------------------------------------------------

export const GREETING_KEY = 'stay_greeting_v1';
interface GreetState { dismissedDay?: string; spokenDay?: string }
const read = (): GreetState => {
  try {
    return JSON.parse(window.localStorage.getItem(GREETING_KEY) || '{}') as GreetState;
  } catch {
    return {};
  }
};
const write = (s: GreetState) => {
  try {
    window.localStorage.setItem(GREETING_KEY, JSON.stringify(s));
  } catch {
    // private mode: shown again on reload, which is harmless
  }
};
export const greetingCardDue = (now = new Date()) => read().dismissedDay !== localDay(now);
export const greetingSpokenDue = (now = new Date()) => read().spokenDay !== localDay(now);
export const markGreetingDismissed = (now = new Date()) => write({ ...read(), dismissedDay: localDay(now) });
export const markGreetingSpoken = (now = new Date()) => write({ ...read(), spokenDay: localDay(now) });
