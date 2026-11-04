import { inferBarrierFromTask, BARRIER_DEFINITIONS, deJargonChaoticTask } from '@/lib/coach/strategies';
import type { BarrierType } from '@/types/domain';

export interface TaskRealityCalculation {
  taskText: string;
  inferredBarrier: BarrierType;
  perceivedMinutes: number;
  microEntrySeconds: number;
  recommendedSprintMinutes: number;
  neuroInsight: string;
  spokenSummary: string;
}

export interface StarterAngle {
  id: string;
  name: string;
  prompt: string;
  timeSeconds: number;
  rationale: string;
}

export interface TaskBrainstormResult {
  taskText: string;
  angles: StarterAngle[];
  spokenSummary: string;
}

export interface TaskPathPhase {
  phase: number;
  name: string;
  durationMinutes: number;
  action: string;
}

export interface TaskPathResult {
  taskText: string;
  phases: TaskPathPhase[];
  totalSprintMinutes: number;
  spokenSummary: string;
}

/**
 * A rough size for a task: how long it may feel, how long the first move takes, and one block length to try. These are fixed guesses by
 * kind of task, not measurements, and the replies never present them as facts about the person.
 */
export function calculateTaskReality(taskText: string): TaskRealityCalculation {
  const clean = deJargonChaoticTask(taskText);
  const lower = clean.toLowerCase();
  const barrier = inferBarrierFromTask(clean);

  // Rough guesses by kind of task
  let perceivedMinutes = 90;
  let microEntrySeconds = 60;
  let recommendedSprintMinutes = 10;

  if (/(tax|taxes|invoice|finances|spreadsheet|admin|paperwork|budget)/i.test(lower)) {
    perceivedMinutes = 180;
    microEntrySeconds = 45;
    recommendedSprintMinutes = 10;
  } else if (/(clean|tidy|room|kitchen|closet|garage|laundry|dishes)/i.test(lower)) {
    perceivedMinutes = 120;
    microEntrySeconds = 60;
    recommendedSprintMinutes = 5;
  } else if (/(write|writing|essay|thesis|study|exam|code|presentation|deck|draft|abstract|proposal|paper|report|article|blog)/i.test(lower)) {
    perceivedMinutes = 240;
    microEntrySeconds = 90;
    recommendedSprintMinutes = 15;
  } else if (/(email|reply|call|text|apologize|boss|client|landlord)/i.test(lower)) {
    perceivedMinutes = 45;
    microEntrySeconds = 30;
    recommendedSprintMinutes = 5;
  }

  const neuroInsight = `Big tasks tend to feel longer than their first move. This one starts with about ${microEntrySeconds} seconds of setup.`;

  const spokenSummary = `The first move takes about ${microEntrySeconds} seconds. Try one ${recommendedSprintMinutes}-minute block, and you can stop when it ends.`;

  return {
    taskText: clean,
    inferredBarrier: barrier,
    perceivedMinutes,
    microEntrySeconds,
    recommendedSprintMinutes,
    neuroInsight,
    spokenSummary,
  };
}

/**
 * Three small ways in, picked by kind of task.
 */
export function brainstormStarterAngles(taskText: string): TaskBrainstormResult {
  const clean = deJargonChaoticTask(taskText);
  const lower = clean.toLowerCase();

  const isWritingOrDoc = /(write|writing|essay|report|email|deck|slides|article|paper|draft|resume|cv|abstract|proposal|blog)/i.test(lower);
  const isPhysicalOrSpace = /(clean|tidy|room|kitchen|clothes|dishes|desk|pack|organize)/i.test(lower);
  const isAdminOrFin = /(tax|taxes|form|bill|bank|invoice|expense|budget|apply)/i.test(lower);

  let angles: StarterAngle[];

  if (isWritingOrDoc) {
    angles = [
      {
        id: 'ugly-draft',
        name: 'A rough first pass',
        prompt: 'Open a blank page and write three messy bullet points that only you will see. Grammar does not matter.',
        timeSeconds: 60,
        rationale: 'A rough draft is allowed, so there is nothing to get wrong.',
      },
      {
        id: 'last-sentence-first',
        name: 'Write the ending first',
        prompt: 'Write only the last line, the one that says it is done.',
        timeSeconds: 45,
        rationale: 'Knowing where it ends makes the first line easier to find.',
      },
      {
        id: 'voice-braindump',
        name: 'Say it out loud',
        prompt: 'Say three sentences out loud to Stay about what you want to get across, then copy what it heard.',
        timeSeconds: 60,
        rationale: 'Talking is often easier to start than typing.',
      },
    ];
  } else if (isPhysicalOrSpace) {
    angles = [
      {
        id: 'five-items-only',
        name: 'Five things',
        prompt: 'Pick up five things and put them roughly where they go. At five, you can stop.',
        timeSeconds: 60,
        rationale: 'A count gives the job an end.',
      },
      {
        id: 'single-surface-anchor',
        name: 'One surface',
        prompt: 'Clear one patch of desk or counter, about a foot square. Ignore everything outside it.',
        timeSeconds: 90,
        rationale: 'A small patch is easier to look at than the whole room.',
      },
      {
        id: 'soundtrack-sprint',
        name: 'One song',
        prompt: 'Put on one song you like and tidy until it ends.',
        timeSeconds: 180,
        rationale: 'A song has a built-in end.',
      },
    ];
  } else if (isAdminOrFin) {
    angles = [
      {
        id: 'open-and-stare',
        name: 'Just open it',
        prompt: 'Open the site or folder you need, log in, then take your hands off the keyboard.',
        timeSeconds: 45,
        rationale: 'Logging in is a step of its own. Do it first, by itself.',
      },
      {
        id: 'one-field-rule',
        name: 'One field',
        prompt: 'Fill in only the date and your name or reference number. Leave the rest blank for now.',
        timeSeconds: 60,
        rationale: 'A form that is already started is easier to finish.',
      },
      {
        id: 'screenshot-recon',
        name: 'Take a screenshot',
        prompt: 'Take a screenshot of the form or bill and read only the first question.',
        timeSeconds: 30,
        rationale: 'Looking at one question is less than facing the whole form.',
      },
    ];
  } else {
    angles = [
      {
        id: 'two-minute-rule',
        name: 'Ninety seconds of setup',
        prompt: 'Open the app or file you need and do only the first 90 seconds of setup.',
        timeSeconds: 90,
        rationale: 'Doing something small often comes before feeling like it.',
      },
      {
        id: 'what-hurts-most',
        name: 'Name the worst part',
        prompt: 'Tell Stay in one sentence what the most annoying part of this is.',
        timeSeconds: 45,
        rationale: 'Saying it out loud gets it out of your head.',
      },
      {
        id: 'timebox-bound',
        name: 'Five minutes, then stop',
        prompt: 'Start a five-minute timer. Work on any piece of it, and stop when it rings.',
        timeSeconds: 300,
        rationale: 'A short block with a clear end is easier to begin.',
      },
    ];
  }

  const spokenSummary = `Three ways in: 1) ${angles[0].name}, 2) ${angles[1].name}, or 3) ${angles[2].name}. Which one feels lightest?`;

  return {
    taskText: clean,
    angles,
    spokenSummary,
  };
}

/**
 * A path in three parts for a bigger task: get ready, work, stop cleanly.
 */
export function synthesizeTaskPath(taskText: string): TaskPathResult {
  const clean = deJargonChaoticTask(taskText);
  const calculation = calculateTaskReality(clean);

  const phases: TaskPathPhase[] = [
    {
      phase: 1,
      name: 'Get ready',
      durationMinutes: 2,
      action: 'Open only the one tab or folder you need. Close the rest and fetch some water.',
    },
    {
      phase: 2,
      name: 'Work',
      durationMinutes: calculation.recommendedSprintMinutes,
      action: `Work on the main thing for ${calculation.recommendedSprintMinutes} minutes. Stay keeps time.`,
    },
    {
      phase: 3,
      name: 'Stop cleanly',
      durationMinutes: 1,
      action: 'Save what you have, log how it went in Stay, and take a five-minute break.',
    },
  ];

  const totalSprintMinutes = phases.reduce((acc, p) => acc + p.durationMinutes, 0);

  const spokenSummary = `Here is a path in three parts: 2 minutes to get ready, ${calculation.recommendedSprintMinutes} minutes of work, and 1 minute to stop cleanly. About ${totalSprintMinutes} minutes in all.`;

  return {
    taskText: clean,
    phases,
    totalSprintMinutes,
    spokenSummary,
  };
}
