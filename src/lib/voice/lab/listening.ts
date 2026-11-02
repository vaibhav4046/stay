/**
 * The listening test (T1.6): the same reply in three Stay voices and the browser's own voice, in an order nobody can guess, rated 1 to 5.
 * This file is the part that can be tested without a browser: the shuffle, the results and the export.
 */
export const LISTEN_QUESTION = "I'd happily listen to this for ten minutes";

/** About 15 seconds at a calm pace. The same words go to every voice. */
export const LISTEN_TEXT =
  "Okay, that email is heavy, and that's fine. Here is one small thing. Open a new message and type the first word, just Hi. " +
  'You do not have to send it. After that, we can look at the next line together, whenever you are ready.';

export interface ListenItem {
  /** what the listener sees: "Voice A" */
  label: string;
  /** what it really is: a voice id, or "browser" */
  source: string;
  name: string;
}

export interface Rating {
  label: string;
  source: string;
  name: string;
  stars: 1 | 2 | 3 | 4 | 5;
  at: string;
}

export interface ListenerResult {
  listener: string;
  startedAt: string;
  question: string;
  text: string;
  order: string[];
  ratings: Rating[];
}

/** Fisher-Yates with an injectable random source, so a test can fix it. */
export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The voices in a fresh random order, labelled A, B, C, D so the listener cannot tell which is which. */
export function buildRound(voices: Array<{ source: string; name: string }>, rand: () => number = Math.random): ListenItem[] {
  return shuffle(voices, rand).map((v, i) => ({ label: `Voice ${String.fromCharCode(65 + i)}`, source: v.source, name: v.name }));
}

export function newResult(listener: string, round: ListenItem[], now: Date = new Date()): ListenerResult {
  return { listener: listener.trim() || 'anonymous', startedAt: now.toISOString(), question: LISTEN_QUESTION, text: LISTEN_TEXT, order: round.map((r) => r.source), ratings: [] };
}

export function addRating(result: ListenerResult, item: ListenItem, stars: number, now: Date = new Date()): ListenerResult {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('A rating is a whole number from 1 to 5.');
  if (result.ratings.some((r) => r.source === item.source)) throw new Error('This voice was already rated.');
  return { ...result, ratings: [...result.ratings, { label: item.label, source: item.source, name: item.name, stars: stars as Rating['stars'], at: now.toISOString() }] };
}

/** Mean rating per voice over every listener, with the count, for the owner to read. The raw ratings are in the export. */
export function summarise(results: ListenerResult[]): Array<{ source: string; name: string; n: number; mean: number }> {
  const by = new Map<string, { name: string; sum: number; n: number }>();
  for (const r of results) for (const x of r.ratings) {
    const e = by.get(x.source) ?? { name: x.name, sum: 0, n: 0 };
    e.sum += x.stars;
    e.n += 1;
    by.set(x.source, e);
  }
  return [...by.entries()].map(([source, e]) => ({ source, name: e.name, n: e.n, mean: Math.round((e.sum / e.n) * 100) / 100 }));
}

export function exportJson(results: ListenerResult[], meta: { gitSha?: string; at?: string } = {}): string {
  return JSON.stringify({ gate: 'T1.6', label: 'listening test, human listeners, live TTS-1', question: LISTEN_QUESTION, exportedAt: meta.at ?? new Date().toISOString(), gitSha: meta.gitSha ?? null, listeners: results.length, summary: summarise(results), results }, null, 2);
}
