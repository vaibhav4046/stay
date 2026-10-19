/**
 * Spoken corrections to Today's list: "move the bins to later", "that one is done", "drop the dentist". The sentence is parsed
 * with plain rules and matched to a real item by its words; if it cannot tell which item is meant it says so instead of guessing.
 */
import { loadToday, removeToday, toggleToday, TODAY_KEY, type Bucket, type TodayItem } from '@/lib/coach/todayList';

export type ListEdit =
  | { kind: 'move'; target: string; bucket: Bucket }
  | { kind: 'done'; target: string }
  | { kind: 'remove'; target: string };

const BUCKET_WORD: Record<string, Bucket> = { later: 'later', tomorrow: 'later', 'next week': 'later', today: 'today', now: 'now', first: 'now' };

export function parseListEdit(raw: string): ListEdit | null {
  const t = raw.toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ').trim();
  let m = /\b(?:move|put|push|shift|send|park)\s+(?:the |my )?(.+?)\s+(?:to|into|for|till|until|on)\s+(later|today|now|tomorrow|next week)\b/.exec(t);
  if (m) return { kind: 'move', target: m[1], bucket: BUCKET_WORD[m[2]] };
  m = /\b(?:start with|make|do)\s+(?:the )?(.+?)\s+(?:first|now|the one to start)$/.exec(t) ?? /\bstart with (?:the )?(.+)$/.exec(t);
  if (m) return { kind: 'move', target: m[1], bucket: 'now' };
  m = /\b(?:that one|this one|it)(?:'s| is| was)? (?:done|finished|complete|sorted)\b/.exec(t) ?? /^(?:done|finished) (?:with )?(?:that|it)$/.exec(t);
  if (m) return { kind: 'done', target: '' };
  m = /\b(?:i )?(?:did|finished|completed|done with|ticked off|crossed off|just did)\s+(?:the |my )?(.+)$/.exec(t) ?? /\b(?:the )?(.+?)\s+(?:is|are|was|were)\s+(?:all )?(?:done|finished|complete|sorted)$/.exec(t);
  if (m) return { kind: 'done', target: m[1] };
  m = /\b(?:remove|delete|drop|scrap)\s+(?:the |my )?(.+?)(?:\s+off(?: the list)?|\s+from (?:the |my )?list)?$/.exec(t) ?? /\btake\s+(?:the |my )?(.+?)\s+off(?: the list)?$/.exec(t);
  if (m) return { kind: 'remove', target: m[1] };
  return null;
}

const toks = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !['the', 'and', 'for', 'one'].includes(w)));
const stem = (w: string) => w.replace(/(?:ing|es|s)$/, '');

export type Match = { item: TodayItem } | { ambiguous: TodayItem[] } | { none: true };

/** The open item the words point at. An empty target means "the one we are on" (the "now" item, or the only open one). */
export function matchItem(items: TodayItem[], target: string, includeDone = false): Match {
  const open = items.filter((i) => includeDone || !i.done);
  const want = [...toks(target)].map(stem);
  if (want.length === 0) {
    const now = open.filter((i) => i.bucket === 'now');
    if (now.length === 1) return { item: now[0] };
    return open.length === 1 ? { item: open[0] } : open.length === 0 ? { none: true } : { ambiguous: open.slice(0, 3) };
  }
  const scored = open.map((i) => {
    const have = new Set([...toks(i.text)].map(stem));
    return { i, score: want.filter((w) => have.has(w)).length / want.length };
  }).filter((s) => s.score >= 0.5).sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { none: true };
  const top = scored.filter((s) => s.score === scored[0].score);
  return top.length === 1 ? { item: top[0].i } : { ambiguous: top.map((s) => s.i).slice(0, 3) };
}

export interface EditResult {
  ok: boolean;
  say: string;
  changed?: { id: string; text: string; action: ListEdit['kind']; bucket?: Bucket };
}

const short = (t: string) => (t.length > 40 ? `${t.slice(0, 39).trimEnd()}…` : t);
const WHERE: Record<Bucket, string> = { later: 'later', today: 'today', now: 'the top, to start with' };

/** Applies one spoken correction to the stored list. Honest about what happened, including when nothing did. */
export function applyListEdit(spoken: string, now = new Date()): EditResult {
  const edit = parseListEdit(spoken);
  if (!edit) return { ok: false, say: 'I did not catch what to change. Try "move the bins to later" or "that one is done".' };
  const items = loadToday(now);
  const m = matchItem(items, edit.target);
  if ('none' in m) return { ok: false, say: edit.target ? `I could not find "${short(edit.target)}" on your list.` : 'Your list has nothing open to change.' };
  if ('ambiguous' in m) return { ok: false, say: `Which one: ${m.ambiguous.map((i) => short(i.text)).join(' or ')}?` };
  const { item } = m;
  if (edit.kind === 'done') {
    toggleToday(item.id, now);
    return { ok: true, say: `Marked ${short(item.text)} done. That is a win.`, changed: { id: item.id, text: item.text, action: 'done' } };
  }
  if (edit.kind === 'remove') {
    removeToday(item.id, now);
    return { ok: true, say: `Removed ${short(item.text)}.`, changed: { id: item.id, text: item.text, action: 'remove' } };
  }
  // only one "now": whatever was on top steps down to today
  const next = items.map((i) => (i.id === item.id ? { ...i, bucket: edit.bucket } : edit.bucket === 'now' && i.bucket === 'now' && !i.done ? { ...i, bucket: 'today' as const } : i));
  try {
    window.localStorage.setItem(TODAY_KEY, JSON.stringify(next));
  } catch {
    return { ok: false, say: 'I could not save that change on this device.' };
  }
  return { ok: true, say: `Moved ${short(item.text)} to ${WHERE[edit.bucket]}.`, changed: { id: item.id, text: item.text, action: 'move', bucket: edit.bucket } };
}
