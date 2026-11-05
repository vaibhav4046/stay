/**
 * When Stay may speak first, and what it says. Two windows a day in the person's own time zone, at most one message per window,
 * nothing at night. The server knows no names, tasks or history, so a message is a calm, general invitation; the app opens on
 * Today, where the real greeting (with the person's own data) is built on their device.
 */
import { isCalm } from '@/lib/coach/dailyGreeting';

export type Slot = 'morning' | 'evening';
export const SLOTS: readonly Slot[] = ['morning', 'evening'];
/** Local minutes after midnight: [start, end). */
export const WINDOWS: Record<Slot, readonly [number, number]> = { morning: [9 * 60, 11 * 60], evening: [18 * 60 + 30, 20 * 60 + 30] };

/** Which windows the person wants. At least one is always on; switching off both is what the main switch is for. */
export type SlotPrefs = Record<Slot, boolean>;
export const ALL_SLOTS: SlotPrefs = { morning: true, evening: true };

export interface SentLog {
  day: string;
  slots: Slot[];
}

export function localParts(now: Date, timeZone: string): { day: string; minutes: number } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return { day: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

/** The slot to send right now, or null. A window that already opened before someone subscribed counts as sent (see `startLog`). */
export function dueSlot(now: Date, timeZone: string, sent: SentLog, prefs: SlotPrefs = ALL_SLOTS): Slot | null {
  const { day, minutes } = localParts(now, timeZone);
  const done = sent.day === day ? sent.slots : [];
  return SLOTS.find((s) => prefs[s] && minutes >= WINDOWS[s][0] && minutes < WINDOWS[s][1] && !done.includes(s)) ?? null;
}

/** On subscribing, today's windows that have already opened are marked sent, so the first real message is the next window, not a surprise at once. */
export function startLog(now: Date, timeZone: string): SentLog {
  const { day, minutes } = localParts(now, timeZone);
  return { day, slots: SLOTS.filter((s) => minutes >= WINDOWS[s][0]) };
}

export const MESSAGES: Record<Slot, readonly string[]> = {
  morning: [
    "Morning. One small thing is enough to start. Tap and say what's on your mind.",
    "Good morning. No plan needed: say the first thing out loud and we'll shrink it together.",
    "Morning. When you're ready I'm here. Even one sentence is a start.",
  ],
  evening: [
    "Evening. If something is still spinning in your head, say it out loud and I'll hold it.",
    'Hi. Anything from today worth parking so tomorrow can feel lighter? I will listen.',
    'Winding down? Tell me what is left in your head and we will sort it or park it.',
  ],
};

export const WELCOME = 'Stay is on. I will check in softly, at most twice a day, and you can switch me off any time in Settings.';

/** A stable pick per day, varied by a per-person seed, so one device does not get the same line twice running. */
export function messageFor(slot: Slot, day: string, seed: number): string {
  const list = MESSAGES[slot];
  const dayN = Number(day.replaceAll('-', '')) || 0;
  return list[Math.abs(dayN + seed) % list.length];
}

export const allMessagesCalm = () => [...SLOTS.flatMap((s) => MESSAGES[s]), WELCOME].every(isCalm);
