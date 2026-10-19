/**
 * Brain dump triage: turn "everything on my mind" into a short, ordered, guilt-free list.
 * The model does the sorting when it can; this module validates its answer and supplies a deterministic fallback.
 */
import { z } from 'zod';

export const BUCKETS = ['now', 'today', 'later'] as const;

export const TriageItemSchema = z.object({
  text: z.string().min(1).max(80),
  bucket: z.enum(BUCKETS),
  firstStep: z.string().max(140).optional(),
  minutes: z.number().int().min(1).max(120).optional(),
});
export const TriageResponseSchema = z.object({
  items: z.array(TriageItemSchema).min(1).max(12),
  summary: z.string().max(160).optional(),
});
export type TriageItem = z.infer<typeof TriageItemSchema>;
export type TriageResponse = z.infer<typeof TriageResponseSchema>;

const MAX_ITEMS = 12;
const MAX_TODAY = 4;

/** Splits free text on lines, bullets, semicolons and "and then / also" joins; trims, de-duplicates, caps the count. */
export function splitDump(text: string): string[] {
  const parts = text
    .replace(/\r/g, '')
    .split(/\n+|;|•|(?:^|\s)[-*]\s+|\b(?:and then|and also|also|then|plus)\b|,\s*(?:and\s+)?(?=(?:i|to|need|call|email|buy|pay|book|reply|clean|do|finish|send|write|fix|sort|text|check)\b)/i)
    .map((p) => p.replace(/^\s*[-*•]\s+/, '').replace(/^(?:and|i need to|i have to|i should|i must|need to|have to|to)\s+/i, '').replace(/[.,;\s]+$/g, '').trim())
    .filter((p) => p.length >= 3);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p.length > 80 ? `${p.slice(0, 77).trimEnd()}...` : p);
  }
  return out.slice(0, MAX_ITEMS);
}

const URGENT = /\b(today|tonight|asap|urgent|due|deadline|tomorrow|now|before|by (?:noon|5|five|end of day)|overdue)\b/i;
const SOMEDAY = /\b(someday|eventually|maybe|at some point|next (?:week|month)|one day|when i can|later)\b/i;
const QUICK = /\b(email|reply|text|call|send|book|pay|order|cancel|message|ring|schedule)\b/i;

/** Exactly one "now", at most four "today", the rest "later". Never more than twelve items. */
export function normalizeTriage(items: TriageItem[]): TriageItem[] {
  let nowSeen = false;
  let todayCount = 0;
  return items.slice(0, MAX_ITEMS).map((it) => {
    let bucket = it.bucket;
    if (bucket === 'now') {
      if (nowSeen) bucket = 'today';
      else nowSeen = true;
    }
    if (bucket === 'today') {
      if (todayCount >= MAX_TODAY) bucket = 'later';
      else todayCount++;
    }
    return { ...it, bucket };
  }).map((it, i, all) => (i === all.length - 1 && !nowSeen ? { ...it, bucket: 'now' as const } : it)).sort((a, b) => BUCKETS.indexOf(a.bucket) - BUCKETS.indexOf(b.bucket));
}

/** No model needed: split, label by wording, pick the quickest-looking task as the one to start. */
export function fallbackTriage(text: string): TriageResponse {
  const parts = splitDump(text);
  if (parts.length === 0) return { items: [{ text: text.trim().slice(0, 80) || 'Start something small', bucket: 'now' }] };
  const labelled: TriageItem[] = parts.map((p) => ({ text: p, bucket: SOMEDAY.test(p) ? 'later' : URGENT.test(p) ? 'today' : 'today' }));
  const quick = labelled.findIndex((i) => i.bucket !== 'later' && QUICK.test(i.text));
  const pick = quick >= 0 ? quick : labelled.findIndex((i) => i.bucket !== 'later');
  if (pick >= 0) labelled[pick] = { ...labelled[pick], bucket: 'now', minutes: 5 };
  return { items: normalizeTriage(labelled), summary: 'Sorted by wording. One thing to start, a few for today, the rest for later.' };
}

export const TRIAGE_SYSTEM = [
  'You help an adult with ADHD sort a brain dump. Reply with ONLY JSON: {"summary": string, "items": [{"text": string, "bucket": "now"|"today"|"later", "firstStep": string, "minutes": number}]}.',
  'Split into separate tasks (max 12, each text under 60 characters, in the speaker\'s language, plain words).',
  'Exactly ONE item is "now": the easiest one that would relieve the most pressure. At most 4 are "today". Everything else is "later". Never shame, never say overdue.',
  'firstStep is one tiny physical move under two minutes. minutes is a realistic short block (5 to 25). summary is one warm sentence under 20 words.',
  'Never give medical advice and never diagnose.',
].join('\n');

/** Pulls a JSON object out of a model reply and validates it; returns null if it is not usable. */
export function parseTriageReply(raw: string): TriageResponse | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const parsed = TriageResponseSchema.safeParse(JSON.parse(m[0]));
    if (!parsed.success) return null;
    return { ...parsed.data, items: normalizeTriage(parsed.data.items) };
  } catch {
    return null;
  }
}
