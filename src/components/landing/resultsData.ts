/**
 * Every number here is copied from the repository docs, nothing is rounded in Stay's favour:
 *  - docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md  (Stay vs ChatGPT voice vs Gemini 3.8 Live)
 *  - docs/STAY_VERIFICATION_2026-10-18.md        (languages, voice engines)
 * Small samples, one laptop, synthesized speakers injected as the microphone. The limits are rendered next to the numbers.
 */
export type Who = 'stay' | 'chatgpt' | 'gemini';
export const WHO_LABEL: Record<Who, string> = { stay: 'Stay', chatgpt: 'ChatGPT voice', gemini: 'Gemini 3.8 Live' };

export interface SpanRow {
  who: Who;
  /** Low and high of the observed values in seconds. */
  min: number;
  max: number;
  /** Median, when the doc gives one. */
  median?: number;
  /** What the text beside the bar says, exactly. */
  text: string;
}

export interface SpanCard {
  id: string;
  title: string;
  unit: string;
  /** Axis maximum in seconds. */
  scale: number;
  ticks: number[];
  rows: SpanRow[];
  note: string;
  /** Stay is behind on this one. */
  stayBehind?: boolean;
}

export const SPAN_CARDS: SpanCard[] = [
  {
    id: 'reply',
    title: 'Reply after you stop talking',
    unit: 's',
    scale: 4.5,
    ticks: [0, 1, 2, 3, 4],
    stayBehind: true,
    rows: [
      { who: 'stay', min: 1.74, max: 2.36, median: 1.95, text: '1.95 s median, 5 turns' },
      { who: 'chatgpt', min: 0.91, max: 4.01, median: 1.65, text: '1.65 s median, 8 turns' },
      { who: 'gemini', min: 1.31, max: 2.11, median: 1.44, text: '1.44 s median, 10 turns' },
    ],
    note: 'Stay was the slowest of the three on typical speed. ChatGPT voice had the worst single reply (4.0 s).',
  },
  {
    id: 'interrupt',
    title: 'You interrupt it: time until it goes quiet',
    unit: 's',
    scale: 1.8,
    ticks: [0, 0.5, 1, 1.5],
    rows: [
      { who: 'stay', min: 0.38, max: 0.45, text: '0.38 to 0.45 s' },
      { who: 'chatgpt', min: 1.07, max: 1.5, text: '1.07 and 1.50 s' },
      { who: 'gemini', min: 0.43, max: 0.43, text: '0.43 s in the clean run' },
    ],
    note: 'Gemini also showed 0.27 and 0.29 s in two runs where its reply may have been ending anyway. Stay’s long-request run opened a sheet instead of speaking much, so there was little to cut off.',
  },
  {
    id: 'length',
    title: 'How long it talks back',
    unit: 's',
    scale: 22,
    ticks: [0, 5, 10, 15, 20],
    rows: [
      { who: 'stay', min: 4, max: 10, text: '4 to 10 s' },
      { who: 'chatgpt', min: 9, max: 20, text: '9 to 20 s' },
      { who: 'gemini', min: 8, max: 9, text: '8 to 9 s' },
    ],
    note: 'Reply to “I keep putting off replying to my landlord”. Stay’s prompt tells it to keep replies short.',
  },
];

export interface PauseRow {
  who: Who;
  /** Seconds into the silence at which it started talking, one per run. Empty = it waited. */
  jumpedIn: number[];
  text: string;
}

/** A pause of about 3.2 s in the middle of a thought. */
export const PAUSE = {
  seconds: 3.2,
  rows: [
    { who: 'stay', jumpedIn: [], text: 'Waited, then answered the finished thought (1 run in this rig)' },
    { who: 'chatgpt', jumpedIn: [1.75, 2.1], text: 'Started talking in 2 of 2 runs' },
    { who: 'gemini', jumpedIn: [1.46, 1.57], text: 'Started talking in 2 of 2 runs' },
  ] as PauseRow[],
};

export const TALKED_OVER = [
  { who: 'stay' as Who, yes: false, text: 'No' },
  { who: 'chatgpt' as Who, yes: true, text: 'Yes, 2 of 2 runs (2.1 s and 1.3 s before the sentence ended)' },
  { who: 'gemini' as Who, yes: false, text: 'No' },
];

export const STAY_BEHIND = [
  'Slowest typical reply: 1.95 s against 1.65 s and 1.44 s.',
  'After “Wait, stop, just one tiny step please” Stay answered 1.7 to 2.7 s later. ChatGPT and Gemini answered in about 1.2 to 1.4 s.',
  'In one run it stayed silent for 18 s, because a tool call (opening the Brain Dump sheet) swallowed the reply.',
  'It once saved facts nobody said into local memory. That is fixed: a memory is saved only if your last words asked for it.',
];

/** Fast voice against the managed voice it replaced (docs/STAY_VERIFICATION and RESEARCH_VOICE_LATENCY). Kept as the original table. */
export const MEASURED = [
  { what: 'Reply after you stop talking', fast: 'about 1.3 seconds', old: 'about 2.8 seconds' },
  { what: 'You pause mid-thought for 2.3 seconds', fast: 'Waits for you', old: 'Talks over the pause' },
  { what: 'You interrupt it', fast: 'Notices in 0.5 to 0.8 seconds', old: 'Notices in about 1.0 to 1.1 seconds' },
  { what: '"Park it: call the dentist"', fast: 'Done and confirmed in 1.3 to 3.3 seconds', old: 'Done, confirmed in about 2.9 seconds (an earlier run)' },
  { what: "Stay's own voice leaks into the microphone", fast: 'It never mistook itself for you (0 stray transcripts in 26)', old: 'None in 27 this time; it once transcribed its own greeting as if you had said it (1 in 10, an earlier run)' },
];

/** Character error rate of one synthesized sentence per language on auto-detect (STAY_VERIFICATION part 2). */
export const LANGS_OK: Array<[string, string, number]> = [
  ['en', 'English', 0], ['es', 'Spanish', 0], ['fr', 'French', 0], ['de', 'German', 0], ['it', 'Italian', 0], ['pt', 'Portuguese', 13],
  ['hi', 'Hindi', 5], ['ja', 'Japanese', 0], ['zh', 'Chinese', 0], ['ko', 'Korean', 0], ['nl', 'Dutch', 0], ['ru', 'Russian', 0],
  ['tr', 'Turkish', 0], ['ar', 'Arabic', 3], ['sv', 'Swedish', 0], ['no', 'Norwegian', 2], ['da', 'Danish', 0], ['fi', 'Finnish', 0],
  ['ro', 'Romanian', 2], ['vi', 'Vietnamese', 0], ['id', 'Indonesian', 4], ['ms', 'Malay', 1], ['he', 'Hebrew', 2],
];
/** Misheard on auto-detect and silent when pinned; the app uses the browser's speech recognition for these. The doc gives pl and hu exactly and the rest as about 100%. */
export const LANGS_NO: Array<[string, string, number]> = [
  ['pl', 'Polish', 58], ['hu', 'Hungarian', 38], ['el', 'Greek', 100], ['uk', 'Ukrainian', 100], ['bn', 'Bengali', 100], ['ta', 'Tamil', 100], ['te', 'Telugu', 100], ['th', 'Thai', 100],
];
