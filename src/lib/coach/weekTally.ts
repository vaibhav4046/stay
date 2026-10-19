export interface TallySession {
  createdAt: string;
  outcome?: string | null;
}

export interface WeekTally {
  blocks: number;
  started: number;
  partly: number;
  notStarted: number;
  /** Blocks from the last 7 days with no outcome logged yet. */
  open: number;
}

const WEEK_MS = 7 * 24 * 3_600_000;

/** Plain counts of the last 7 days of focus blocks: no streaks, no score, just what happened. */
export function weekTally(sessions: TallySession[], now = new Date()): WeekTally {
  const since = now.getTime() - WEEK_MS;
  const t: WeekTally = { blocks: 0, started: 0, partly: 0, notStarted: 0, open: 0 };
  for (const s of sessions) {
    const at = new Date(s.createdAt).getTime();
    if (!Number.isFinite(at) || at < since || at > now.getTime() + 60_000) continue;
    t.blocks += 1;
    if (s.outcome === 'started') t.started += 1;
    else if (s.outcome === 'partly_started') t.partly += 1;
    else if (s.outcome === 'not_started' || s.outcome === 'paused_or_stopped') t.notStarted += 1;
    else t.open += 1;
  }
  return t;
}

/** One honest sentence for the tally, with the real denominator. */
export function weekTallyLine(t: WeekTally): string {
  if (t.blocks === 0) return 'No blocks in the last 7 days. Starting one small thing counts.';
  const won = t.started + t.partly;
  const base = `${won} of ${t.blocks} block${t.blocks === 1 ? '' : 's'} this week got started`;
  return t.partly > 0 ? `${base} (${t.partly} partly).` : `${base}.`;
}
