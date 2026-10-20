/**
 * Self-improving memory that has to show its work.
 *
 * Stay derives a few candidate learnings from what really happened (logged blocks and things the person said), stores each
 * with its evidence, and lets the person see why, edit, pin or delete it, or switch learning off. Nothing is invented:
 * every learning is a count over real blocks or a quote of the person's own words, and a claim needs a minimum sample.
 * Learnings never come from a model. They are plain arithmetic over local data.
 *
 * Merge rules: sessions-based learnings are recomputed from the last 60 days every time, so they cannot go stale; if the
 * data stops supporting one it goes away (a pinned one stays, marked stale). Things the person said decay with a 45 day
 * half-life since they last said it, and drop below 15% strength. A deleted learning is remembered as removed so it does
 * not come back. An edited learning keeps the person's wording while its evidence keeps updating.
 */
import type { CoachSessionRecord, StrategyKey } from '@/types/domain';
import { daysBetween, partOfDay } from '@/lib/coach/time';

export type LearningKind = 'start_strategy' | 'block_length' | 'best_time' | 'avoidance_theme';

export type Evidence =
  | { type: 'sessions'; successes: number; blocks: number; label: string; from: string; to: string }
  | { type: 'utterance'; quote: string; at: string };

export interface Learning {
  id: string;
  kind: LearningKind;
  text: string;
  evidence: Evidence[];
  /** 0..1 when last confirmed. Use currentStrength() for the decayed value. */
  strength: number;
  firstSeen: string;
  lastConfirmed: string;
  pinned: boolean;
  edited: boolean;
  /** Pinned, but the recent blocks no longer support it. */
  stale?: boolean;
}

export interface StatedAvoidance {
  theme: string;
  quote: string;
  at: string;
}

export interface LearningsState {
  enabled: boolean;
  items: Learning[];
  /** Ids the person deleted: derivation must not bring them back. */
  removed: string[];
  stated: StatedAvoidance[];
  /** The one-time plain-language notice was shown. */
  noticeSeen: boolean;
}

export type Derived = Omit<Learning, 'firstSeen' | 'lastConfirmed' | 'pinned' | 'edited' | 'stale'>;

export const LEARNINGS_KEY = 'stay_learnings_v1';
export const WINDOW_DAYS = 60;
export const STATED_HALF_LIFE_DAYS = 45;
export const MIN_STRENGTH = 0.15;
export const MAX_ITEMS = 12;
const MIN_STRATEGY_BLOCKS = 3;
const MIN_LENGTH_BLOCKS = 3;
const MIN_TIME_BLOCKS = 4;
const MIN_RATE = 0.6;
const MAX_STATED = 20;

export const emptyLearnings = (): LearningsState => ({ enabled: true, items: [], removed: [], stated: [], noticeSeen: false });

const STRATEGY_PHRASE: Record<StrategyKey, string> = {
  task_shrinking: 'shrinking the task',
  implementation_intention: 'a when-then plan',
  reframing: 'a reframe',
  timeboxing: 'a short timebox',
};

const isSuccess = (o: CoachSessionRecord['outcome']) => o === 'started' || o === 'partly_started';
const isClosed = (o: CoachSessionRecord['outcome']) => o === 'started' || o === 'partly_started' || o === 'not_started' || o === 'paused_or_stopped';
const smoothed = (s: number, n: number) => (s + 1) / (n + 2);
const strengthOf = (s: number, n: number) => Math.round(smoothed(s, n) * Math.min(1, n / 6) * 100) / 100;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function lengthBucket(minutes: number): { key: string; label: string } {
  if (minutes <= 10) return { key: 'xs', label: '10 minutes or less' };
  if (minutes <= 20) return { key: 's', label: 'about 15 to 20 minutes' };
  if (minutes <= 35) return { key: 'm', label: 'about 25 to 35 minutes' };
  return { key: 'l', label: 'longer than 35 minutes' };
}

const TIME_PHRASE = { morning: 'mornings', afternoon: 'afternoons', evening: 'evenings', night: 'late at night' } as const;

const STOP = new Set('about after again also and are back been before call from have into just make need more much only other over really send some something stuff that their them then there these they this thing things today very want what when with work would your the for you can get got has was were will not too out one two how'.split(' '));

type Group = { successes: number; blocks: number; first: number; last: number };
const bump = (m: Map<string, Group>, key: string, ok: boolean, at: number) => {
  const g = m.get(key) ?? { successes: 0, blocks: 0, first: at, last: at };
  g.blocks += 1;
  if (ok) g.successes += 1;
  g.first = Math.min(g.first, at);
  g.last = Math.max(g.last, at);
  m.set(key, g);
};

/** Best group by rate (then by sample size) among groups with enough blocks and a rate that is actually good. */
function best(m: Map<string, Group>, min: number): [string, Group] | null {
  const ok = [...m.entries()].filter(([, g]) => g.blocks >= min && g.successes / g.blocks >= MIN_RATE);
  ok.sort((a, b) => b[1].successes / b[1].blocks - a[1].successes / a[1].blocks || b[1].blocks - a[1].blocks);
  return ok[0] ?? null;
}

const dayText = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const sessionsEvidence = (g: Group, label: string): Evidence => ({ type: 'sessions', successes: g.successes, blocks: g.blocks, label, from: dayText(g.first), to: dayText(g.last) });

/** Candidate learnings from real logged blocks. Sample data and blocks with no outcome are ignored. */
export function deriveFromSessions(sessions: CoachSessionRecord[], now = new Date()): Derived[] {
  const since = now.getTime() - WINDOW_DAYS * 86_400_000;
  const real = sessions.filter((s) => !s.isSample && isClosed(s.outcome) && !Number.isNaN(Date.parse(s.createdAt)) && Date.parse(s.createdAt) >= since && Date.parse(s.createdAt) <= now.getTime() + 60_000);
  const out: Derived[] = [];

  const byStrategy = new Map<string, Group>();
  const byLength = new Map<string, Group>();
  const byTime = new Map<string, Group>();
  const lengthLabel = new Map<string, string>();
  for (const s of real) {
    const at = Date.parse(s.createdAt);
    const ok = isSuccess(s.outcome);
    bump(byStrategy, s.strategyKey, ok, at);
    const b = lengthBucket(s.plannedMinutes);
    lengthLabel.set(b.key, b.label);
    bump(byLength, b.key, ok, at);
    bump(byTime, partOfDay(new Date(s.createdAt).getHours()), ok, at);
  }

  const strat = best(byStrategy, MIN_STRATEGY_BLOCKS);
  if (strat) {
    const [key, g] = strat;
    const others = [...byStrategy.entries()].filter(([k, o]) => k !== key && o.blocks >= MIN_STRATEGY_BLOCKS);
    const beatsOthers = others.every(([, o]) => g.successes / g.blocks > o.successes / o.blocks);
    if (beatsOthers) {
      const label = STRATEGY_PHRASE[key as StrategyKey] ?? key;
      out.push({ id: `start_strategy:${key}`, kind: 'start_strategy', text: `Starting has gone best with ${label}: ${g.successes} of ${plural(g.blocks, 'block')} got started.`, evidence: [sessionsEvidence(g, `blocks using ${label}`)], strength: strengthOf(g.successes, g.blocks) });
    }
  }

  const len = best(byLength, MIN_LENGTH_BLOCKS);
  if (len) {
    const [key, g] = len;
    const others = [...byLength.entries()].filter(([k, o]) => k !== key && o.blocks >= MIN_LENGTH_BLOCKS);
    if (others.every(([, o]) => g.successes / g.blocks > o.successes / o.blocks)) {
      const label = lengthLabel.get(key) ?? key;
      out.push({ id: `block_length:${key}`, kind: 'block_length', text: `Blocks of ${label} got started ${g.successes} of ${g.blocks} times.`, evidence: [sessionsEvidence(g, `blocks of ${label}`)], strength: strengthOf(g.successes, g.blocks) });
    }
  }

  const time = best(byTime, MIN_TIME_BLOCKS);
  if (time) {
    const [key, g] = time;
    const others = [...byTime.entries()].filter(([k, o]) => k !== key && o.blocks >= MIN_TIME_BLOCKS);
    if (others.every(([, o]) => g.successes / g.blocks > o.successes / o.blocks)) {
      const label = TIME_PHRASE[key as keyof typeof TIME_PHRASE];
      out.push({ id: `best_time:${key}`, kind: 'best_time', text: `${label[0].toUpperCase()}${label.slice(1)} have worked best: ${g.successes} of ${g.blocks} blocks got started.`, evidence: [sessionsEvidence(g, `blocks in the ${key === 'night' ? 'late evening or night' : key}`)], strength: strengthOf(g.successes, g.blocks) });
    }
  }

  // recurring task words in blocks that were not started: the person's own task text, counted
  const words = new Map<string, { failed: CoachSessionRecord[]; all: number }>();
  for (const s of real) {
    const seen = new Set((s.taskText.toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter((w) => !STOP.has(w)));
    for (const w of seen) {
      const e = words.get(w) ?? { failed: [], all: 0 };
      e.all += 1;
      if (!isSuccess(s.outcome)) e.failed.push(s);
      words.set(w, e);
    }
  }
  const themes = [...words.entries()].filter(([, e]) => e.failed.length >= 2 && e.failed.length / e.all >= 0.5).sort((a, b) => b[1].failed.length - a[1].failed.length || b[0].length - a[0].length).slice(0, 2);
  for (const [w, e] of themes) {
    const times = e.failed.map((s) => Date.parse(s.createdAt));
    const g: Group = { successes: e.all - e.failed.length, blocks: e.all, first: Math.min(...times), last: Math.max(...times) };
    out.push({
      id: `avoidance_theme:task:${w}`,
      kind: 'avoidance_theme',
      text: `Tasks about "${w}" have taken a few tries to start (${e.failed.length} of ${plural(e.all, 'block')} did not get started).`,
      evidence: [...e.failed.slice(0, 3).map((s): Evidence => ({ type: 'utterance', quote: s.taskText.slice(0, 100), at: s.createdAt })), sessionsEvidence(g, `blocks mentioning "${w}"`)],
      strength: Math.min(0.8, 0.35 + 0.1 * e.failed.length),
    });
  }
  return out;
}

/** Things the person said about avoiding something, kept with their exact words. Deterministic, no model. */
const STATED_RE = /\b(?:i(?:'m| am) (?:avoiding|dreading)|i (?:keep|always) (?:putting off|avoiding)|i(?:'ve| have) been (?:avoiding|putting off)|i (?:struggle with|hate doing|dread))\s+([\p{L}\p{N}' -]{3,40}?)(?=[.,;!?]|$| (?:because|but|and|so)\b)/iu;

export function detectStatedAvoidance(text: string): { theme: string; quote: string } | null {
  const m = STATED_RE.exec(text.trim());
  if (!m) return null;
  const theme = m[1].trim().toLowerCase();
  return theme.length >= 3 ? { theme, quote: text.trim().slice(0, 140) } : null;
}

export function deriveFromStated(stated: StatedAvoidance[], now = new Date()): Derived[] {
  const byTheme = new Map<string, StatedAvoidance[]>();
  for (const s of stated) byTheme.set(s.theme, [...(byTheme.get(s.theme) ?? []), s]);
  return [...byTheme.entries()].map(([theme, list]) => ({
    id: `avoidance_theme:said:${theme}`,
    kind: 'avoidance_theme' as const,
    text: `You told me ${theme} is something you avoid.`,
    evidence: list.slice(-3).map((s): Evidence => ({ type: 'utterance', quote: s.quote, at: s.at })),
    strength: Math.min(0.9, 0.5 + 0.15 * (list.length - 1)),
  })).filter((d) => d.evidence.length > 0 && !Number.isNaN(now.getTime()));
}

const isSessionsBased = (l: Pick<Learning, 'id'>) => !l.id.startsWith('avoidance_theme:said:');

/** Strength now: sessions-based items are recomputed (no decay); things the person said fade with a 45 day half-life. */
export function currentStrength(l: Learning, now = new Date()): number {
  if (l.pinned || isSessionsBased(l)) return l.stale ? Math.min(l.strength, 0.3) : l.strength;
  return l.strength * Math.pow(0.5, daysBetween(Date.parse(l.lastConfirmed), now.getTime()) / STATED_HALF_LIFE_DAYS);
}

/** Pure merge of freshly derived learnings into the stored state: dedupe by id, honour edits, pins and deletions, decay, cap. */
export function mergeLearnings(state: LearningsState, derived: Derived[], now = new Date()): LearningsState {
  const iso = now.toISOString();
  const removed = new Set(state.removed);
  const byId = new Map(state.items.map((i) => [i.id, i]));
  const next = new Map<string, Learning>();
  const derivedIds = new Set<string>();

  for (const d of derived) {
    if (removed.has(d.id) || derivedIds.has(d.id)) continue;
    derivedIds.add(d.id);
    const old = byId.get(d.id);
    next.set(d.id, old
      ? { ...old, kind: d.kind, text: old.edited ? old.text : d.text, evidence: d.evidence, strength: d.strength, lastConfirmed: iso, stale: false }
      : { ...d, firstSeen: iso, lastConfirmed: iso, pinned: false, edited: false });
  }

  for (const old of state.items) {
    if (derivedIds.has(old.id) || removed.has(old.id)) continue;
    if (isSessionsBased(old)) {
      // the recent blocks no longer support it: it goes, unless the person pinned it
      if (old.pinned) next.set(old.id, { ...old, stale: true });
    } else if (old.pinned || currentStrength(old, now) >= MIN_STRENGTH) {
      next.set(old.id, old);
    }
  }

  const items = [...next.values()]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || currentStrength(b, now) - currentStrength(a, now))
    .slice(0, MAX_ITEMS);
  return { ...state, items };
}

export function deriveAll(state: LearningsState, sessions: CoachSessionRecord[], now = new Date()): Derived[] {
  return [...deriveFromSessions(sessions, now), ...deriveFromStated(state.stated, now)];
}

// ---- storage -----------------------------------------------------------------------------------------------------

export function loadLearnings(): LearningsState {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(LEARNINGS_KEY);
    if (!raw) return emptyLearnings();
    const p = JSON.parse(raw) as Partial<LearningsState>;
    return {
      enabled: p.enabled !== false,
      items: Array.isArray(p.items) ? p.items.filter((i) => i && typeof i.id === 'string' && typeof i.text === 'string' && Array.isArray(i.evidence)) : [],
      removed: Array.isArray(p.removed) ? p.removed.filter((r) => typeof r === 'string') : [],
      stated: Array.isArray(p.stated) ? p.stated.filter((s) => s && typeof s.theme === 'string') : [],
      noticeSeen: p.noticeSeen === true,
    };
  } catch {
    return emptyLearnings();
  }
}

export function saveLearnings(state: LearningsState): LearningsState {
  try {
    window.localStorage.setItem(LEARNINGS_KEY, JSON.stringify(state));
  } catch {
    // private mode: kept for this page only
  }
  return state;
}

/** Re-derive from the person's blocks and store. Does nothing while learning is switched off. */
export function refreshLearnings(sessions: CoachSessionRecord[], now = new Date()): LearningsState {
  const state = loadLearnings();
  if (!state.enabled) return state;
  return saveLearnings(mergeLearnings(state, deriveAll(state, sessions, now), now));
}

/** Called when the person says they avoid something. Only stored while learning is on. */
export function noteStatedAvoidance(text: string, now = new Date()): LearningsState {
  const state = loadLearnings();
  const hit = detectStatedAvoidance(text);
  if (!state.enabled || !hit) return state;
  const stated = [...state.stated.filter((s) => !(s.theme === hit.theme && s.at.slice(0, 10) === now.toISOString().slice(0, 10))), { ...hit, at: now.toISOString() }].slice(-MAX_STATED);
  const next = { ...state, stated };
  return saveLearnings(mergeLearnings(next, deriveFromStated(stated, now), now));
}

export function setLearningsEnabled(enabled: boolean): LearningsState {
  return saveLearnings({ ...loadLearnings(), enabled, noticeSeen: true });
}

export const markNoticeSeen = (): LearningsState => saveLearnings({ ...loadLearnings(), noticeSeen: true });

const patch = (id: string, f: (l: Learning) => Learning): LearningsState => {
  const s = loadLearnings();
  return saveLearnings({ ...s, items: s.items.map((i) => (i.id === id ? f(i) : i)) });
};
export const togglePinLearning = (id: string) => patch(id, (l) => ({ ...l, pinned: !l.pinned }));
export const editLearning = (id: string, text: string) => {
  const t = text.replace(/\s+/g, ' ').trim().slice(0, 160);
  return t ? patch(id, (l) => ({ ...l, text: t, edited: true })) : loadLearnings();
};
export function deleteLearning(id: string): LearningsState {
  const s = loadLearnings();
  return saveLearnings({ ...s, items: s.items.filter((i) => i.id !== id), removed: [...new Set([...s.removed, id])], stated: id.startsWith('avoidance_theme:said:') ? s.stated.filter((x) => `avoidance_theme:said:${x.theme}` !== id) : s.stated });
}
/** Forget every learning and every deletion: Stay starts learning again from scratch (the person's logged blocks stay). */
export const resetLearnings = (): LearningsState => saveLearnings({ ...emptyLearnings(), enabled: loadLearnings().enabled, noticeSeen: true });

// ---- showing the work --------------------------------------------------------------------------------------------

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** Why this was learned, in plain words, from the stored evidence only. */
export function whyLine(l: Learning): string {
  const e = l.evidence;
  const s = e.find((x): x is Extract<Evidence, { type: 'sessions' }> => x.type === 'sessions');
  const q = e.filter((x): x is Extract<Evidence, { type: 'utterance' }> => x.type === 'utterance');
  const parts: string[] = [];
  if (s) parts.push(`${s.successes} of ${s.blocks} ${s.label} got started, between ${shortDay(s.from)} and ${shortDay(s.to)}.`);
  if (q.length) parts.push(l.id.startsWith('avoidance_theme:said:') ? `You said: "${q[q.length - 1].quote}" on ${shortDay(q[q.length - 1].at)}.` : `Your own task wording: ${q.map((x) => `"${x.quote}"`).join(', ')}.`);
  if (l.stale) parts.push('Your recent blocks no longer show this; it is kept because you pinned it.');
  return parts.join(' ');
}

/** One short line for the voice system prompt: the two strongest learnings, never when learning is off. */
export function learningsPromptLine(state: LearningsState, now = new Date()): string {
  if (!state.enabled) return '';
  const top = state.items
    .filter((i) => !i.stale && currentStrength(i, now) >= 0.3)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || currentStrength(b, now) - currentStrength(a, now))
    .slice(0, 2);
  return top.length ? `Learned: ${top.map((i) => i.text.slice(0, 80)).join(' ')}` : '';
}
