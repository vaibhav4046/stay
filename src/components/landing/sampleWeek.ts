/**
 * Four weeks of SAMPLE focus blocks for the landing page. These are made up, generated once by a fixed seed, so the page
 * can show what the History screen looks like without anyone's real data. They are shaped like real records
 * (CoachSessionRecord) so the charts run through the same functions as the real History page.
 */
import type { BarrierType, CoachSessionRecord, SessionOutcome, StrategyKey } from '@/types/domain';

/** Monday 21 September 2026, 00:00 UTC. Day 0 of 28. */
const START = Date.UTC(2026, 8, 21);
export const SAMPLE_DAYS = 28;
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
/** The last moment of the sample, used as "now" for the 7-day tally. */
export const SAMPLE_NOW = new Date(START + SAMPLE_DAYS * 86_400_000 - 60_000);

/** Six time-of-day bands for the heatmap. */
export const BANDS = [
  { label: 'Early', hours: '6 to 9', from: 6, to: 9 },
  { label: 'Morning', hours: '9 to 12', from: 9, to: 12 },
  { label: 'Midday', hours: '12 to 15', from: 12, to: 15 },
  { label: 'Afternoon', hours: '15 to 18', from: 15, to: 18 },
  { label: 'Evening', hours: '18 to 21', from: 18, to: 21 },
  { label: 'Late', hours: '21 to 24', from: 21, to: 24 },
] as const;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Task {
  text: string;
  step: string;
  barrier: BarrierType;
  minutes: number;
}

const TASKS: Task[] = [
  { text: 'Reply to my landlord about the renewal', step: 'Open the email and type just the greeting', barrier: 'unclear_next_step', minutes: 10 },
  { text: 'Start the tax return', step: 'Put the tax folder on the desk', barrier: 'overwhelm', minutes: 10 },
  { text: 'Write the cover letter', step: 'Write one ugly sentence about why you want the job', barrier: 'perfectionism_or_fear', minutes: 10 },
  { text: 'Do the expenses', step: 'Open the spreadsheet and enter one receipt', barrier: 'boredom_or_distraction', minutes: 15 },
  { text: 'Tidy the kitchen', step: 'Put five things in the bin', barrier: 'low_energy', minutes: 5 },
  { text: 'Book the dentist', step: 'Find the number and put it on the screen', barrier: 'unclear_next_step', minutes: 5 },
  { text: 'Plan the group project', step: 'List three things that are due, in any order', barrier: 'overwhelm', minutes: 10 },
  { text: 'Send the draft to my tutor', step: 'Attach the file; do not reread it', barrier: 'perfectionism_or_fear', minutes: 10 },
  { text: 'File the receipts', step: 'Make two piles: keep and bin', barrier: 'boredom_or_distraction', minutes: 15 },
  { text: 'Wash up', step: 'Fill the sink; that is the whole step', barrier: 'low_energy', minutes: 5 },
  { text: 'Answer the insurance letter', step: 'Read only the first paragraph', barrier: 'overwhelm', minutes: 10 },
  { text: 'Order the prescription', step: 'Open the pharmacy site and sign in', barrier: 'unclear_next_step', minutes: 5 },
];

const STRATEGY_FOR: Record<BarrierType, StrategyKey[]> = {
  overwhelm: ['task_shrinking', 'task_shrinking', 'timeboxing'],
  unclear_next_step: ['implementation_intention', 'implementation_intention', 'task_shrinking'],
  perfectionism_or_fear: ['reframing', 'reframing', 'timeboxing'],
  boredom_or_distraction: ['timeboxing', 'timeboxing', 'implementation_intention'],
  low_energy: ['task_shrinking', 'task_shrinking', 'implementation_intention'],
  other: ['task_shrinking', 'task_shrinking', 'reframing'],
};

/** How likely a block is to start, by strategy and by the hour. Invented, and uneven on purpose. */
const BASE: Record<StrategyKey, number> = { task_shrinking: 0.82, implementation_intention: 0.7, reframing: 0.52, timeboxing: 0.6 };
const hourEffect = (h: number) => (h < 9 ? 0.04 : h < 12 ? 0.1 : h < 15 ? -0.02 : h < 18 ? -0.08 : h < 21 ? -0.04 : -0.2);

function pickHour(r: () => number): number {
  const u = r();
  if (u < 0.12) return 6 + Math.floor(r() * 3);
  if (u < 0.4) return 9 + Math.floor(r() * 3);
  if (u < 0.58) return 12 + Math.floor(r() * 3);
  if (u < 0.78) return 15 + Math.floor(r() * 3);
  if (u < 0.93) return 18 + Math.floor(r() * 3);
  return 21 + Math.floor(r() * 3);
}

function build(): CoachSessionRecord[] {
  const r = rng(20261019);
  const out: CoachSessionRecord[] = [];
  for (let d = 0; d < SAMPLE_DAYS; d++) {
    const dow = d % 7;
    // a rough patch in week two (days 9 to 11) and quiet Sundays: real weeks are not even
    const rough = d >= 9 && d <= 11;
    const weights = rough ? [0.62, 0.38, 0, 0, 0] : dow === 6 ? [0.38, 0.4, 0.2, 0.02, 0] : dow >= 5 ? [0.2, 0.4, 0.3, 0.1, 0] : [0.06, 0.22, 0.38, 0.26, 0.08];
    let u = r();
    let n = 0;
    while (n < weights.length - 1 && u > weights[n]) {
      u -= weights[n];
      n++;
    }
    for (let k = 0; k < n; k++) {
      const task = TASKS[Math.floor(r() * TASKS.length)];
      const pool = STRATEGY_FOR[task.barrier];
      const strategyKey = pool[Math.floor(r() * pool.length)];
      const hour = pickHour(r);
      const p = Math.min(0.95, Math.max(0.08, BASE[strategyKey] + hourEffect(hour) - (rough ? 0.25 : 0)));
      const x = r();
      const outcome: SessionOutcome = x < p * 0.72 ? 'started' : x < p ? 'partly_started' : r() < 0.3 ? 'paused_or_stopped' : 'not_started';
      const won = outcome === 'started' || outcome === 'partly_started';
      const minute = Math.floor(r() * 50);
      out.push({
        id: `sample-${d}-${k}`,
        userId: 'sample',
        createdAt: new Date(START + d * 86_400_000 + hour * 3_600_000 + minute * 60_000).toISOString(),
        completedAt: null,
        mode: r() < 0.6 ? 'voice' : 'text',
        careContext: 'self_managing',
        taskText: task.text,
        barrierType: task.barrier,
        strategyKey,
        firstStep: task.step,
        plannedMinutes: task.minutes,
        actualSeconds: won ? task.minutes * 60 - Math.floor(r() * 120) : null,
        outcome,
        helpfulRating: won ? 3 + Math.floor(r() * 3) : null,
        crisisTriggered: false,
        isSample: true,
      });
    }
  }
  return out;
}

export const SAMPLE_SESSIONS: CoachSessionRecord[] = build();

export const dayOf = (s: CoachSessionRecord) => Math.floor((Date.parse(s.createdAt) - START) / 86_400_000);
export const hourOf = (s: CoachSessionRecord) => new Date(s.createdAt).getUTCHours();
export const bandOf = (s: CoachSessionRecord) => BANDS.findIndex((b) => hourOf(s) >= b.from && hourOf(s) < b.to);
export const wonOutcome = (o: SessionOutcome | null) => o === 'started' || o === 'partly_started';
