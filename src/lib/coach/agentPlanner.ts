/**
 * The agent's planning tools, as plain functions. Each one returns what it did plus a `say` line built from that result, so the
 * spoken confirmation can only describe what actually happened. No calendar needed: planning uses the person's energy and the time
 * they say they have.
 */
import type { CoachSessionRecord } from '@/types/domain';
import { buildDeterministicFirstStep } from '@/lib/coach/strategies';
import { openToday, type TodayItem } from '@/lib/coach/todayList';
import { localDay, localDayOf } from '@/lib/coach/time';

export type Energy = 'low' | 'medium' | 'high';

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, half: 0.5 };

/** "low energy, about two hours" -> { energy: 'low', minutes: 120 }. Unstated values come back null so the caller can say it assumed. */
export function parseEnergyMinutes(raw: string): { energy: Energy | null; minutes: number | null } {
  const t = raw.toLowerCase();
  const energy: Energy | null = /\b(?:low|tired|exhaust\w*|drained|flat|foggy|wiped|no energy|little energy)\b/.test(t) ? 'low' : /\b(?:high|great|energi[sz]ed|wired|fresh|plenty|lots of energy)\b/.test(t) ? 'high' : /\b(?:medium|ok(?:ay)?|so-so|normal|fine|alright)\b/.test(t) ? 'medium' : null;
  let minutes: number | null = null;
  const h = /(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|half(?: an?)?)[\s-]*(?:h|hrs?|hours?)\b/.exec(t);
  const m = /(\d+)\s*(?:m|mins?|minutes?)\b/.exec(t);
  if (h) minutes = Math.round((Number(h[1]) || NUM[h[1].split(' ')[0]] || 1) * 60);
  else if (/\bhalf an hour\b/.test(t)) minutes = 30;
  if (m) minutes = (h ? minutes ?? 0 : 0) + Number(m[1]);
  return { energy, minutes: minutes && minutes > 0 ? Math.min(minutes, 600) : null };
}

const BLOCK: Record<Energy, number> = { low: 8, medium: 15, high: 25 };
const MAX_ITEMS: Record<Energy, number> = { low: 2, medium: 3, high: 4 };
const BREAK = 5;
const DEFAULT_MINUTES = 90;

export interface PlannedItem {
  id: string;
  text: string;
  minutes: number;
  firstStep?: string;
}
export interface DayPlan {
  ok: true;
  empty: boolean;
  energy: Energy;
  availableMinutes: number;
  assumed: string[];
  picked: PlannedItem[];
  leftover: number;
  say: string;
}

/**
 * Picks what fits: the "now" item first, then today's, then later ones only if there is room. Low energy gets shorter blocks and
 * fewer items. Block length follows the person's learned block length when there is one.
 */
export function planDay(input: { energy?: Energy | null; minutes?: number | null; items: TodayItem[]; preferredBlock?: number | null }): DayPlan {
  const assumed: string[] = [];
  const energy = input.energy ?? 'medium';
  if (!input.energy) assumed.push('medium energy');
  const available = input.minutes ?? DEFAULT_MINUTES;
  if (!input.minutes) assumed.push(`about ${DEFAULT_MINUTES} minutes`);
  const block = Math.max(5, Math.min(BLOCK[energy], input.preferredBlock && input.preferredBlock >= 5 ? input.preferredBlock : BLOCK[energy]));

  const open = [...openToday(input.items), ...input.items.filter((i) => !i.done && i.bucket === 'later')];
  const picked: PlannedItem[] = [];
  let used = 0;
  for (const it of open) {
    if (picked.length >= MAX_ITEMS[energy]) break;
    const minutes = Math.max(5, Math.min(it.minutes ?? block, block * 2));
    const cost = minutes + (picked.length ? BREAK : 0);
    if (used + cost > available && picked.length > 0) continue;
    if (used + cost > available && picked.length === 0) {
      picked.push({ id: it.id, text: it.text, minutes: Math.max(5, Math.min(minutes, available)), firstStep: it.firstStep });
      used += picked[0].minutes;
      continue;
    }
    picked.push({ id: it.id, text: it.text, minutes, firstStep: it.firstStep });
    used += cost;
  }
  const leftover = open.length - picked.length;
  const note = assumed.length ? ` I assumed ${assumed.join(' and ')}.` : '';
  if (picked.length === 0) {
    return { ok: true, empty: true, energy, availableMinutes: available, assumed, picked, leftover: 0, say: 'Your list is empty, so there is nothing to plan yet. Want to empty your head first, or name one small thing?' };
  }
  const steps = picked.map((p, i) => `${i === 0 ? 'First' : i === 1 ? 'then' : 'then'} ${p.text}, ${p.minutes} minutes`).join('; ');
  const say = `${energy === 'low' ? 'Gentle plan' : 'Plan'} for about ${used} minutes: ${steps}.${leftover > 0 ? ` ${leftover} more ${leftover === 1 ? 'is' : 'are'} waiting, no pressure.` : ''}${note}`;
  return { ok: true, empty: false, energy, availableMinutes: available, assumed, picked, leftover, say };
}

// ---- break a task into steps with timers --------------------------------------------------------------------------

export interface Step {
  text: string;
  minutes: number;
  done: boolean;
}
export interface StepPlan {
  task: string;
  steps: Step[];
  at: string;
  /** Index of the step whose timer was last started. */
  cursor?: number;
}

export const STEPS_KEY = 'stay_steps_v1';

/** Four plain steps, each with its own timer: get ready, the tiny first move, one working block, a clean stop. */
export function breakDown(task: string, workMinutes = 10, now = new Date()): StepPlan {
  const t = task.replace(/\s+/g, ' ').trim().slice(0, 80);
  const first = buildDeterministicFirstStep(t, 'task_shrinking');
  const work = Math.max(5, Math.min(25, Math.round(workMinutes)));
  return {
    task: t,
    at: now.toISOString(),
    steps: [
      { text: `Get ready: open or fetch what you need for ${t}`, minutes: 2, done: false },
      { text: first.length > 110 ? `${first.slice(0, 109).trimEnd()}…` : first, minutes: 5, done: false },
      { text: `Keep going on ${t}. Rough is fine`, minutes: work, done: false },
      { text: 'Stop where you are and write down the next move', minutes: 2, done: false },
    ],
  };
}

export function loadSteps(): StepPlan | null {
  try {
    const p = JSON.parse((typeof window === 'undefined' ? null : window.localStorage.getItem(STEPS_KEY)) || 'null') as StepPlan | null;
    return p && Array.isArray(p.steps) && p.steps.length ? p : null;
  } catch {
    return null;
  }
}
export function saveSteps(p: StepPlan | null): void {
  try {
    if (p) window.localStorage.setItem(STEPS_KEY, JSON.stringify(p));
    else window.localStorage.removeItem(STEPS_KEY);
  } catch {
    // private mode: kept for this page only
  }
}

/** Marks the current step done and returns the next one; null next means that was the last step. */
export function advanceSteps(p: StepPlan): { plan: StepPlan; finished: Step | null; next: Step | null } {
  const i = p.steps.findIndex((s) => !s.done);
  if (i < 0) return { plan: p, finished: null, next: null };
  const steps = p.steps.map((s, k) => (k === i ? { ...s, done: true } : s));
  return { plan: { ...p, steps }, finished: p.steps[i], next: steps.find((s) => !s.done) ?? null };
}

// ---- end-of-day wrap-up and resume --------------------------------------------------------------------------------

export interface WrapUp {
  wins: string[];
  open: number;
  say: string;
}

/** Today's real wins (finished items and started blocks), read back warmly, with the rest left safely for tomorrow. */
export function wrapUp(items: TodayItem[], sessions: CoachSessionRecord[], now = new Date()): WrapUp {
  const today = localDay(now);
  const wins = [
    ...items.filter((i) => i.done && localDayOf(i.doneAt) === today).map((i) => i.text),
    ...sessions.filter((s) => !s.isSample && (s.outcome === 'started' || s.outcome === 'partly_started') && localDayOf(s.createdAt) === today).map((s) => s.taskText),
  ];
  const unique = [...new Set(wins)];
  const open = items.filter((i) => !i.done).length;
  const list = unique.slice(0, 3).map((w) => (w.length > 40 ? `${w.slice(0, 39)}…` : w)).join(', ');
  const rest = open > 0 ? ' What is left is safe on your list for tomorrow.' : '';
  const say = unique.length === 0
    ? `Nothing logged today, and that is okay. A day is more than a list.${rest} Rest well.`
    : `Today you got ${unique.length === 1 ? 'one thing' : `${unique.length} things`} going: ${list}${unique.length > 3 ? `, and ${unique.length - 3} more` : ''}.${rest} Rest well.`;
  return { wins: unique, open, say };
}

/** The open item to pick back up: something left from before today first (newest), otherwise the top of today's list. */
export function pickResume(items: TodayItem[], now = new Date()): TodayItem | null {
  const today = localDay(now);
  const before = items.filter((i) => !i.done && (localDayOf(i.createdAt) ?? today) < today).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return before[0] ?? openToday(items)[0] ?? items.find((i) => !i.done) ?? null;
}

// ---- soft reminders by clock time ---------------------------------------------------------------------------------

export const MAX_REMIND_MINUTES = 240;

/** "in 20 minutes", "at 3pm", "at 15:30", "tomorrow morning" -> minutes from now and the cleaned reminder text. */
export function parseWhen(raw: string, now = new Date()): { minutes: number | null; text: string } {
  const t = raw.trim();
  const rel = /\b(?:in\s+)?(\d+)\s*(h|hr|hrs|hours?|m|mins?|minutes?)\b/i.exec(t);
  if (rel) return { minutes: /^h/i.test(rel[2]) ? Number(rel[1]) * 60 : Number(rel[1]), text: tidy(t.replace(rel[0], '')) };
  const clock = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(t);
  if (clock) {
    let hour = Number(clock[1]);
    const min = Number(clock[2] ?? 0);
    const ap = clock[3]?.toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    if (hour > 23 || min > 59) return { minutes: null, text: tidy(t) };
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0);
    if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
    return { minutes: Math.max(1, Math.round((due.getTime() - now.getTime()) / 60_000)), text: tidy(t.replace(clock[0], '')) };
  }
  return { minutes: null, text: tidy(t) };
}
const tidy = (s: string) => s.replace(/^\s*(?:please\s+)?(?:remind me|check in(?: with me)?)(?:\s+to|\s+about)?\s*/i, '').replace(/\s+/g, ' ').replace(/^[\s,.:-]+|[\s,.:-]+$/g, '').replace(/^(?:to|about)\s+/i, '');
