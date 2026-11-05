/**
 * Keeps a conversation inside what the model request can carry, by dropping the oldest turns, never by failing.
 * Hindi, Korean, Arabic and emoji take 2 to 4 bytes a character, so a long chat in them used to pass the server's 8 KB limit after a few
 * turns and the reply was an error. Both the client (before it sends) and the server (as a safety net) use this.
 *
 * Rules: the newest turn is always kept (cut short if it alone is too big); the kept part starts at a person's turn, so a tool answer is
 * never left without the assistant call it answers; order is never changed.
 */
export const HISTORY_BUDGET_BYTES = 7_000;

interface Turn {
  role: string;
  content?: string | null;
}

const encoder = new TextEncoder();
const byteLength = (s: string | null | undefined) => (s ? encoder.encode(s).length : 0);

/** Cuts text to at most `max` bytes on a character boundary (never in the middle of a letter or emoji). */
export function clipToBytes(text: string, max: number): string {
  if (byteLength(text) <= max) return text;
  let out = '';
  let used = 0;
  for (const ch of text) {
    const n = byteLength(ch);
    if (used + n > max) break;
    out += ch;
    used += n;
  }
  return out;
}

export function historyBytes(messages: readonly Turn[]): number {
  return messages.reduce((sum, m) => sum + byteLength(m.content), 0);
}

export function fitHistory<T extends Turn>(messages: readonly T[], maxBytes: number = HISTORY_BUDGET_BYTES): T[] {
  if (messages.length === 0 || historyBytes(messages) <= maxBytes) return [...messages];

  // newest first, as many whole turns as fit
  let used = 0;
  let start = messages.length;
  while (start > 0) {
    const n = byteLength(messages[start - 1].content);
    if (used + n > maxBytes) break;
    used += n;
    start--;
  }
  // begin at a person's turn so nothing is orphaned
  while (start < messages.length && messages[start].role !== 'user') start++;
  if (start < messages.length) return messages.slice(start) as T[];

  // not even the last person's turn with what followed it fits: keep that turn, cut to size, and what came after it if it fits
  let lastUser = messages.length - 1;
  while (lastUser >= 0 && messages[lastUser].role !== 'user') lastUser--;
  if (lastUser < 0) return [messages[messages.length - 1]];
  const after = messages.slice(lastUser + 1);
  const room = Math.max(200, maxBytes - historyBytes(after));
  const cut = { ...messages[lastUser], content: clipToBytes(messages[lastUser].content ?? '', room) } as T;
  return historyBytes([cut, ...after]) <= maxBytes ? [cut, ...(after as T[])] : [cut];
}
