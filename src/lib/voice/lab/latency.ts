/**
 * T2.8: turns the page's own marks into one row per turn, for a real-microphone run.
 *
 *   end of speech   = the last time the microphone was loud before the speech service called the turn finished
 *   called finished = the speech service's end-of-turn mark ("eot")
 *   played          = the first sample of Stay's reply the audio context actually output (T2.1)
 *
 * All times are epoch milliseconds (Date.now()). Pure, so it can be tested without a browser.
 */
export interface Turn {
  turn: number;
  endOfSpeechAt: number | null;
  calledFinishedAt: number;
  playedAt: number | null;
  /** end of speech to first sample played; null if either end is missing */
  latencyMs: number | null;
  /** end of turn called to first sample played */
  afterTurnCalledMs: number | null;
}

export type Mark = [name: string, at: number];

/** how far back from the end-of-turn mark to look for the last loud microphone frame */
const LOOKBACK_MS = 6000;
/** how long after the end-of-turn mark a reply may start playing and still belong to that turn */
const REPLY_WINDOW_MS = 20000;

export function computeTurns(marks: Mark[], plays: number[], loud: number[]): Turn[] {
  const eots = marks.filter(([n]) => n.startsWith('eot')).map(([, t]) => t).sort((a, b) => a - b);
  const playsSorted = [...plays].sort((a, b) => a - b);
  const loudSorted = [...loud].sort((a, b) => a - b);
  return eots.map((eot, i) => {
    const next = eots[i + 1] ?? Infinity;
    const playedAt = playsSorted.find((p) => p >= eot - 50 && p < Math.min(next, eot + REPLY_WINDOW_MS)) ?? null;
    let endOfSpeechAt: number | null = null;
    for (const t of loudSorted) if (t <= eot && t >= eot - LOOKBACK_MS) endOfSpeechAt = t;
    return {
      turn: i + 1,
      endOfSpeechAt,
      calledFinishedAt: eot,
      playedAt,
      latencyMs: endOfSpeechAt !== null && playedAt !== null ? Math.round(playedAt - endOfSpeechAt) : null,
      afterTurnCalledMs: playedAt !== null ? Math.round(playedAt - eot) : null,
    };
  });
}

export function summarise(turns: Turn[]): { n: number; medianMs: number | null; p95Ms: number | null; worstMs: number | null } {
  const v = turns.map((t) => t.latencyMs).filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, medianMs: null, p95Ms: null, worstMs: null };
  return { n: v.length, medianMs: v[Math.floor(v.length / 2)], p95Ms: v[Math.min(v.length - 1, Math.floor(v.length * 0.95))], worstMs: v[v.length - 1] };
}

export function exportLatency(turns: Turn[], meta: { gitSha?: string; at?: string; note?: string } = {}): string {
  return JSON.stringify(
    {
      gate: 'T2.8',
      labels: ['real-mic', 'live-model'],
      measure: 'last loud microphone frame to the first sample of the reply output by the audio context',
      note: meta.note ?? 'A real person speaking into a real microphone, with headphones.',
      gitSha: meta.gitSha ?? null,
      exportedAt: meta.at ?? new Date().toISOString(),
      summary: summarise(turns),
      turns,
    },
    null,
    2,
  );
}
