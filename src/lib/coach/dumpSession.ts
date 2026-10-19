/**
 * Voice brain dump, the pure parts. While capture is on Stay says nothing: it only listens, keeps the items it heard, and
 * recognises the few spoken controls (done, cancel, scratch that, remove X). When the person is done it reads back ONE thing to
 * start and a few for today. The sorting itself is the existing triage (model with a deterministic fallback).
 */
import { splitDump, type TriageItem } from '@/lib/coach/triage';

export type DumpControl =
  | { kind: 'end'; rest: string }
  | { kind: 'cancel' }
  | { kind: 'scratch' }
  | { kind: 'drop'; target: string }
  | { kind: 'chunk'; text: string };

const FILLER = /\b(?:um+|uh+|er+m?|hmm+|you know|i mean|like,|sort of|kind of|basically|literally|so yeah|anyway)\b[,.]?\s*/gi;
const END = /(?:^|[\s,.;])(?:okay[, ]+|ok[, ]+|right[, ]+|so[, ]+)?(?:that'?s (?:it|all|everything|the lot)|that is (?:it|all|everything)|i'?m (?:done|finished)|i am (?:done|finished)|all done|(?:i'?m )?done now|sort (?:it|them|that|this|those)(?: out| for me)?(?: please)?|go ahead and sort|please sort|finished)[\s.!?]*$/i;
const CANCEL = /^\s*(?:okay[, ]+)?(?:cancel(?: (?:this|that|the dump|the brain dump))?|never ?mind|forget (?:it|that|all that)|scrap (?:it|that|all that)|stop the (?:brain )?dump)[\s.!?]*$/i;
const SCRATCH = /^\s*(?:scratch that|undo that|delete that|take that back|ignore that|remove that)[\s.!?]*$/i;
const DROP = /^\s*(?:remove|delete|drop|scratch|forget|take off|cross off|not)\s+(?:the |my |that )?(.{3,60}?)(?:\s+(?:off|from the (?:dump|list)))?[\s.!?]*$/i;

const START = /\b(?:(?:i )?(?:need|want|have|got|gotta|going) to (?:dump|empty|unload|offload|download) (?:my|the|all (?:of )?my) (?:head|brain|mind)|brain ?dump|dump (?:my|the) (?:head|brain|mind)|empty (?:out )?(?:my|the) (?:head|brain|mind)|get (?:it|everything|all of it|it all) out of my (?:head|brain|mind)|let me (?:ramble|vent|download|unload)|everything(?:'s| is) (?:spinning|swirling|in my head))\b/i;

/** "I need to dump my head" opens the listening mode at once, with no model in between. Whatever else was said becomes the first thing heard. */
export function detectDumpStart(text: string): { rest: string } | null {
  const m = START.exec(text);
  if (!m) return null;
  const rest = cleanChunk(`${text.slice(0, m.index)} ${text.slice(m.index + m[0].length)}`.replace(/^\s*(?:okay|ok|so|right|hey stay|stay)[, ]+/i, ''));
  return { rest: rest.split(/\s+/).length >= 3 ? rest : '' };
}

export const cleanChunk = (t: string) => t.replace(FILLER, ' ').replace(/\s+/g, ' ').replace(/^[\s,;.]+|[\s,;]+$/g, '').trim();

/** What a spoken sentence means while a dump is being captured. */
export function classifyDumpUtterance(raw: string): DumpControl {
  const text = raw.trim();
  if (CANCEL.test(text)) return { kind: 'cancel' };
  if (SCRATCH.test(text)) return { kind: 'scratch' };
  const end = END.exec(text);
  if (end) return { kind: 'end', rest: cleanChunk(text.slice(0, end.index)) };
  const drop = DROP.exec(text);
  if (drop && text.split(/\s+/).length <= 7) return { kind: 'drop', target: drop[1].trim() };
  return { kind: 'chunk', text: cleanChunk(text) };
}

/** The items heard so far, as the split the triage will see (so the live list matches what gets sorted). */
export function captureItems(parts: string[]): string[] {
  return splitDump(parts.filter(Boolean).join('\n'));
}

const words = (t: string) => new Set(t.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').split(/\s+/).filter((w) => w.length > 2));

/** Removes the heard item that best matches what the person wants dropped. Returns the text removed, or null. */
export function dropFromCapture(parts: string[], target: string): { parts: string[]; removed: string | null } {
  const want = words(target);
  if (want.size === 0) return { parts, removed: null };
  let best = { i: -1, score: 0 };
  parts.forEach((p, i) => {
    const have = words(p);
    const score = [...want].filter((w) => have.has(w)).length / want.size;
    if (score > best.score) best = { i, score };
  });
  if (best.i < 0 || best.score < 0.5) return { parts, removed: null };
  return { parts: parts.filter((_, i) => i !== best.i), removed: parts[best.i] };
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The line Stay speaks after sorting: one thing to start, a few for today, the rest parked. Calm and short. */
export function readBackLine(items: TriageItem[]): string {
  if (items.length === 0) return 'I did not catch anything to sort. Want to try again?';
  const now = items.find((i) => i.bucket === 'now') ?? items[0];
  const today = items.filter((i) => i !== now && i.bucket === 'today');
  const later = items.filter((i) => i !== now && i.bucket === 'later');
  const parts = [`Got it, ${items.length === 1 ? 'one thing' : `${items.length} things`}. Start with ${clip(now.text, 50)}${now.minutes ? `, about ${now.minutes} minutes` : ''}.`];
  if (now.firstStep) parts.push(`First: ${clip(now.firstStep.replace(/[.!]+$/, ''), 70)}.`);
  if (today.length) parts.push(`Maybe also today: ${today.slice(0, 3).map((i) => clip(i.text, 30)).join(', ')}${today.length > 3 ? `, and ${today.length - 3} more` : ''}.`);
  if (later.length) parts.push(`${later.length === 1 ? 'One more is' : `${later.length} more are`} parked for later.`);
  return parts.join(' ');
}
