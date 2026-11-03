/**
 * Your Stay data as notes you own. Two outputs from the same data, both built on the device, nothing uploaded:
 *  - a folder of linked Markdown notes you can open as an Obsidian vault (memory, what Stay learned with its evidence, every logged block,
 *    your list, recent check-ins), with [[wiki links]] between them;
 *  - one plain-text summary for "Email this to me" (a mailto: link: your own mail app opens with the text filled in; Stay sends nothing).
 * No diagnosis, no medical claim: these are your own words and your own counts.
 */
import type { CoachSessionRecord } from '@/types/domain';
import type { UserMemoryProfile } from '@/lib/coach/userMemory';
import type { Learning, LearningsState } from '@/lib/coach/learnings';
import { whyLine } from '@/lib/coach/learnings';

export interface VaultInput {
  memory: UserMemoryProfile | null;
  learnings: LearningsState | null;
  sessions: CoachSessionRecord[];
  list: Array<{ text: string; bucket?: string; done?: boolean }>;
  now?: Date;
}

export interface VaultFile {
  path: string;
  content: string;
}

const day = (iso: string) => iso.slice(0, 10);
const safeName = (s: string) => s.replace(/[\\/:*?"<>|#^\[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'untitled';
const outcomeWord = (o: CoachSessionRecord['outcome']) => (o === 'started' ? 'started' : o === 'partly_started' ? 'partly started' : o === 'not_started' ? 'did not start' : o === 'paused_or_stopped' ? 'paused' : 'open');
const isReal = (s: CoachSessionRecord) => !s.isSample;

const front = (kv: Record<string, string | number | boolean | string[]>) =>
  `---\n${Object.entries(kv).map(([k, v]) => `${k}: ${Array.isArray(v) ? `[${v.map((x) => JSON.stringify(x)).join(', ')}]` : typeof v === 'string' ? JSON.stringify(v) : v}`).join('\n')}\n---\n`;

export function buildVault(input: VaultInput): VaultFile[] {
  const now = input.now ?? new Date();
  const sessions = input.sessions.filter(isReal).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const learnings = (input.learnings?.items ?? []).filter((l) => !l.stale);
  const files: VaultFile[] = [];

  const sessionNote = (s: CoachSessionRecord) => `Blocks/${day(s.createdAt)} ${safeName(s.taskText)}`;
  files.push({
    path: 'Stay.md',
    content:
      `${front({ type: 'index', exported: now.toISOString() })}# Stay vault\n\nYour own notes from Stay, exported ${day(now.toISOString())}. Nothing here was uploaded; it was built in your browser.\n\n` +
      `- [[Memory]]: what you asked Stay to remember\n- [[What Stay learned]]: patterns from your own blocks, each with its evidence\n- [[Your list]]\n- [[Blocks]]: every logged block (${sessions.length})\n\n` +
      `Stay is not a doctor or therapist. These notes are your own words and counts, not a diagnosis.\n`,
  });

  const m = input.memory;
  files.push({
    path: 'Memory.md',
    content:
      `${front({ type: 'memory' })}# Memory\n\n` +
      (m?.name ? `Name: ${m.name}\n\n` : '') +
      (m?.roleOrField ? `Work or field: ${m.roleOrField}\n\n` : '') +
      (m?.facts?.length ? `## Facts you asked Stay to remember\n${m.facts.map((f) => `- ${f}`).join('\n')}\n\n` : '## Facts\nNothing yet. Say "remember that I focus best in the morning" in a call.\n\n') +
      (m?.knownStrengths?.length ? `## What works for you\n${m.knownStrengths.map((f) => `- ${f}`).join('\n')}\n\n` : '') +
      (m?.coreTriggers?.length ? `## What gets in the way\n${m.coreTriggers.map((f) => `- ${f}`).join('\n')}\n\n` : '') +
      `Back to [[Stay]].\n`,
  });

  const evidenceLinks = (l: Learning) =>
    l.evidence.some((e) => e.type === 'sessions') ? sessions.slice(-5).map((s) => `[[${sessionNote(s)}]]`).join(', ') : '';
  files.push({
    path: 'What Stay learned.md',
    content:
      `${front({ type: 'learnings', count: learnings.length })}# What Stay learned\n\n` +
      (learnings.length
        ? learnings.map((l) => `## ${l.text}\n${whyLine(l)}\n${evidenceLinks(l) ? `\nRecent blocks: ${evidenceLinks(l)}\n` : ''}`).join('\n')
        : 'Nothing yet. Stay only says something here after it has counted enough of your own blocks (at least three).\n') +
      `\nEvery line is a count over your real blocks or a quote of your own words. You can edit or delete any of it in Stay, or switch learning off.\n\nBack to [[Stay]].\n`,
  });

  files.push({
    path: 'Your list.md',
    content:
      `${front({ type: 'list', items: input.list.length })}# Your list\n\n` +
      (input.list.length ? input.list.map((i) => `- [${i.done ? 'x' : ' '}] ${i.text}${i.bucket ? ` (${i.bucket})` : ''}`).join('\n') : 'Empty.') +
      `\n\nBack to [[Stay]].\n`,
  });

  const byDay = new Map<string, CoachSessionRecord[]>();
  for (const s of sessions) byDay.set(day(s.createdAt), [...(byDay.get(day(s.createdAt)) ?? []), s]);
  files.push({
    path: 'Blocks.md',
    content:
      `${front({ type: 'blocks', count: sessions.length })}# Blocks\n\n` +
      ([...byDay.entries()].reverse().map(([d, list]) => `## ${d}\n${list.map((s) => `- [[${sessionNote(s)}]]: ${outcomeWord(s.outcome)}`).join('\n')}`).join('\n\n') || 'No blocks yet.') +
      `\n\nBack to [[Stay]].\n`,
  });
  for (const s of sessions) {
    files.push({
      path: `${sessionNote(s)}.md`,
      content:
        `${front({ type: 'block', date: day(s.createdAt), outcome: outcomeWord(s.outcome), minutes: s.plannedMinutes, strategy: s.strategyKey, tags: ['stay/block'] })}# ${s.taskText}\n\n` +
        `First step: ${s.firstStep}\n\nPlanned: ${s.plannedMinutes} minutes. Outcome: ${outcomeWord(s.outcome)}.${s.helpfulRating ? ` You rated it ${s.helpfulRating} of 5.` : ''}\n\n` +
        `Part of [[Blocks]]. See [[What Stay learned]].\n`,
    });
  }
  return files;
}

/** Plain text for "Email this to me": short, no markup, the facts from the person's own device. */
export function buildEmailSummary(input: VaultInput): { subject: string; body: string } {
  const now = input.now ?? new Date();
  const sessions = input.sessions.filter(isReal).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const week = sessions.filter((s) => now.getTime() - Date.parse(s.createdAt) < 7 * 86_400_000);
  const started = week.filter((s) => s.outcome === 'started' || s.outcome === 'partly_started').length;
  const learnings = (input.learnings?.items ?? []).filter((l) => !l.stale).slice(0, 3);
  const lines: string[] = [];
  lines.push(`Your Stay summary, ${day(now.toISOString())}`, '');
  lines.push(week.length ? `This week: ${started} of ${week.length} blocks got started.` : 'This week: no blocks logged yet.');
  for (const s of week.slice(0, 5)) lines.push(`- ${s.taskText}: ${outcomeWord(s.outcome)}`);
  if (input.list.length) lines.push('', 'On your list:', ...input.list.filter((i) => !i.done).slice(0, 8).map((i) => `- ${i.text}`));
  if (learnings.length) lines.push('', 'What has worked for you:', ...learnings.map((l) => `- ${l.text}`));
  if (input.memory?.facts?.length) lines.push('', 'What you asked Stay to remember:', ...input.memory.facts.slice(0, 6).map((f) => `- ${f}`));
  lines.push('', 'Sent from your own device by your own mail app. Stay did not upload or store this.', 'Stay is not a doctor or therapist.');
  return { subject: `Your Stay summary, ${day(now.toISOString())}`, body: lines.join('\n') };
}

export function mailtoLink(summary: { subject: string; body: string }, to = ''): string {
  return `mailto:${to}?subject=${encodeURIComponent(summary.subject)}&body=${encodeURIComponent(summary.body.slice(0, 1800))}`;
}

/**
 * Whole-vault retrieval: the few notes that matter for what was just said, by plain word overlap (no model, no upload). Used so a long
 * history never has to be sent whole: only the best two or three lines go to the model, as data.
 */
export function relevantNotes(query: string, files: VaultFile[], limit = 3): string[] {
  const words = (s: string) => new Set(s.toLowerCase().match(/\p{L}{4,}/gu) ?? []);
  const q = words(query);
  if (!q.size) return [];
  const scored: Array<{ score: number; line: string }> = [];
  for (const f of files) {
    for (const raw of f.content.split('\n')) {
      const line = raw.replace(/^[-#>\s]+/, '').trim();
      if (line.length < 12 || line.startsWith('---')) continue;
      const w = words(line);
      let hits = 0;
      for (const x of q) if (w.has(x)) hits++;
      if (hits) scored.push({ score: hits / Math.sqrt(w.size + 1), line: line.slice(0, 160) });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.line);
}
