/**
 * Check-in reminders: "check in with me in 20 minutes". They survive a reload (stored with their due time) and fire as a
 * chime, an on-screen note, a spoken line when the voice is live, and a system notification if the person allowed it.
 * A browser tab cannot wake itself when it is closed; this works while Stay is open, including in the background.
 */
export interface Reminder {
  id: string;
  text: string;
  dueAt: number;
}

export const REMINDERS_KEY = 'stay_reminders_v1';
const MAX = 10;

export function loadReminders(): Reminder[] {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(REMINDERS_KEY);
    const list = raw ? (JSON.parse(raw) as Reminder[]) : [];
    return Array.isArray(list) ? list.filter((r) => r && typeof r.id === 'string' && typeof r.dueAt === 'number') : [];
  } catch {
    return [];
  }
}

function save(list: Reminder[]): Reminder[] {
  try {
    window.localStorage.setItem(REMINDERS_KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // private mode: kept for this page only
  }
  return list.slice(0, MAX);
}

export function addReminder(minutes: number, text: string, now = Date.now()): { list: Reminder[]; reminder: Reminder } {
  const m = Math.max(1, Math.min(240, Math.round(minutes)));
  const reminder: Reminder = { id: `rem-${now}-${Math.random().toString(36).slice(2, 5)}`, text: (text || 'Check in').replace(/\s+/g, ' ').trim().slice(0, 100), dueAt: now + m * 60_000 };
  return { list: save([...loadReminders(), reminder].sort((a, b) => a.dueAt - b.dueAt)), reminder };
}

export function removeReminder(id: string): Reminder[] {
  return save(loadReminders().filter((r) => r.id !== id));
}

/** Reminders that are due; they are removed from storage. Anything more than an hour overdue is dropped, not shouted about. */
export function takeDue(now = Date.now()): Reminder[] {
  const all = loadReminders();
  const due = all.filter((r) => r.dueAt <= now);
  if (due.length === 0) return [];
  save(all.filter((r) => r.dueAt > now));
  return due.filter((r) => now - r.dueAt < 3_600_000);
}

export function notificationState(): 'unsupported' | 'default' | 'granted' | 'denied' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Must be called from a tap. Returns the resulting permission. */
export async function askNotificationPermission(): Promise<ReturnType<typeof notificationState>> {
  if (notificationState() === 'unsupported') return 'unsupported';
  try {
    return (await Notification.requestPermission()) as ReturnType<typeof notificationState>;
  } catch {
    return notificationState();
  }
}

export function showNotification(title: string, body: string): void {
  try {
    if (notificationState() === 'granted') new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'stay-checkin' });
  } catch {
    // some browsers only allow notifications from a service worker
  }
}

export function minutesUntil(r: Reminder, now = Date.now()): number {
  return Math.max(0, Math.ceil((r.dueAt - now) / 60_000));
}
