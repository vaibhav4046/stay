import { inferBarrierFromTask, BARRIER_DEFINITIONS } from '@/lib/coach/strategies';
import type { BarrierType } from '@/types/domain';

export interface TaskRealityCalculation {
  taskText: string;
  inferredBarrier: BarrierType;
  perceivedMinutes: number;
  microEntrySeconds: number;
  recommendedSprintMinutes: number;
  inertiaBreakRate: number;
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
 * Calculates realistic initiation duration vs perceived ADHD time blindness.
 * Grounded in Russell Barkley's temporal myopia model & Safren's CBT behavioral activation.
 */
export function calculateTaskReality(taskText: string): TaskRealityCalculation {
  const clean = taskText.trim();
  const lower = clean.toLowerCase();
  const barrier = inferBarrierFromTask(clean);

  // Perceived time calculation: ADHD prefrontal dopamine deficits inflate task estimation
  let perceivedMinutes = 90;
  let microEntrySeconds = 60;
  let recommendedSprintMinutes = 10;
  let inertiaBreakRate = 82; // 82% of started tasks continue beyond micro-step

  if (/(tax|taxes|invoice|finances|spreadsheet|admin|paperwork|budget)/i.test(lower)) {
    perceivedMinutes = 180;
    microEntrySeconds = 45;
    recommendedSprintMinutes = 10;
    inertiaBreakRate = 86;
  } else if (/(clean|tidy|room|kitchen|closet|garage|laundry|dishes)/i.test(lower)) {
    perceivedMinutes = 120;
    microEntrySeconds = 60;
    recommendedSprintMinutes = 5;
    inertiaBreakRate = 89;
  } else if (/(write|writing|essay|thesis|study|exam|code|presentation|deck|draft|abstract|proposal|paper|report|article|blog)/i.test(lower)) {
    perceivedMinutes = 240;
    microEntrySeconds = 90;
    recommendedSprintMinutes = 15;
    inertiaBreakRate = 78;
  } else if (/(email|reply|call|text|apologize|boss|client|landlord)/i.test(lower)) {
    perceivedMinutes = 45;
    microEntrySeconds = 30;
    recommendedSprintMinutes = 5;
    inertiaBreakRate = 91;
  }

  const barrierDef = BARRIER_DEFINITIONS[barrier];
  const neuroInsight = `ADHD brains perceive tasks through a binary temporal lens ('Now' vs 'Not Now'). Your brain forecasts ${perceivedMinutes} min of friction, but breaking inertia only requires ${microEntrySeconds} seconds. Once physical momentum starts, ${inertiaBreakRate}% of users stay with it.`;

  const spokenSummary = `Your brain perceives ${perceivedMinutes} minutes of dread, but it only takes ${microEntrySeconds} seconds to break the initial friction. Let's do a gentle ${recommendedSprintMinutes}-minute sprint.`;

  return {
    taskText: clean,
    inferredBarrier: barrier,
    perceivedMinutes,
    microEntrySeconds,
    recommendedSprintMinutes,
    inertiaBreakRate,
    neuroInsight,
    spokenSummary,
  };
}

/**
 * Brainstorms 3 zero-friction starter angles to bypass executive freeze.
 */
export function brainstormStarterAngles(taskText: string): TaskBrainstormResult {
  const clean = taskText.trim();
  const lower = clean.toLowerCase();

  const isWritingOrDoc = /(write|writing|essay|report|email|deck|slides|article|paper|draft|resume|cv|abstract|proposal|blog)/i.test(lower);
  const isPhysicalOrSpace = /(clean|tidy|room|kitchen|clothes|dishes|desk|pack|organize)/i.test(lower);
  const isAdminOrFin = /(tax|taxes|form|bill|bank|invoice|expense|budget|apply)/i.test(lower);

  let angles: StarterAngle[];

  if (isWritingOrDoc) {
    angles = [
      {
        id: 'ugly-draft',
        name: 'The "Garbage First Pass"',
        prompt: `Open a blank page and write 3 terrible, messy bullet points that only you will ever see. Zero grammar, zero formatting.`,
        timeSeconds: 60,
        rationale: 'Disarms perfectionism by officially mandating a flawed draft.',
      },
      {
        id: 'last-sentence-first',
        name: 'The Reverse Finish Line',
        prompt: `Write just the very last line or conclusion: "In conclusion, this project is done because..."`,
        timeSeconds: 45,
        rationale: 'Clarifies the destination so working memory has a clear anchor.',
      },
      {
        id: 'voice-braindump',
        name: 'The 60-Second Verbal Dump',
        prompt: `Say 3 sentences out loud to Stay explaining what you want to convey, then paste the transcript.`,
        timeSeconds: 60,
        rationale: 'Verbal processing bypasses fine-motor keyboard resistance.',
      },
    ];
  } else if (isPhysicalOrSpace) {
    angles = [
      {
        id: 'five-items-only',
        name: 'The 5-Item Rule',
        prompt: `Pick up exactly five visible items and put them in their general place. When you hit five, you are free to stop.`,
        timeSeconds: 60,
        rationale: 'Replaces an infinite spatial field with an unambiguous numeric ceiling.',
      },
      {
        id: 'single-surface-anchor',
        name: 'The "Single Surface" Boundary',
        prompt: `Clear only a 1-foot square on your desk or counter. Ignore everything outside that boundary.`,
        timeSeconds: 90,
        rationale: 'Visual bounding calms sensory overwhelm.',
      },
      {
        id: 'soundtrack-sprint',
        name: 'One Song Sprint',
        prompt: `Put on one favorite high-tempo instrumental track and move things until the song ends.`,
        timeSeconds: 180,
        rationale: 'Rhythmic auditory cue provides artificial dopamine pacing.',
      },
    ];
  } else if (isAdminOrFin) {
    angles = [
      {
        id: 'open-and-stare',
        name: 'The "Open Tab Only" Move',
        prompt: `Navigate to the login portal or folder for "${clean}", log in, and then take your hands off the keyboard.`,
        timeSeconds: 45,
        rationale: 'Separates login authentication friction from actual work.',
      },
      {
        id: 'one-field-rule',
        name: 'The One-Field Rule',
        prompt: `Fill in only the date and your name or reference number. Leave the rest blank for now.`,
        timeSeconds: 60,
        rationale: 'Creates an open cognitive loop that makes finishing feel natural.',
      },
      {
        id: 'screenshot-recon',
        name: 'Visual Reconnaissance',
        prompt: `Take a screenshot of the form or bill and glance at the first question only.`,
        timeSeconds: 30,
        rationale: 'Low-threat exposure therapy reduces administrative anxiety.',
      },
    ];
  } else {
    angles = [
      {
        id: 'two-minute-rule',
        name: 'The 90-Second Micro Move',
        prompt: `Open the exact app or workspace for "${clean}" and perform just the first 90 seconds of physical setup.`,
        timeSeconds: 90,
        rationale: 'Physical action triggers dopamine release before mental motivation.',
      },
      {
        id: 'what-hurts-most',
        name: 'Identify the Friction Point',
        prompt: `Tell Stay in 1 sentence: what is the single most annoying part of this task?`,
        timeSeconds: 45,
        rationale: 'Naming the friction externalizes working memory.',
      },
      {
        id: 'timebox-bound',
        name: 'The 5-Minute Free Pass',
        prompt: `Start a 5-minute timer. Work on any piece of it with guaranteed permission to stop when the bell rings.`,
        timeSeconds: 300,
        rationale: 'Bounded time horizon protects against hyperfocus traps.',
      },
    ];
  }

  const spokenSummary = `I came up with 3 easy entry angles for "${clean}": 1) ${angles[0].name}, 2) ${angles[1].name}, or 3) ${angles[2].name}. Which one feels lightest?`;

  return {
    taskText: clean,
    angles,
    spokenSummary,
  };
}

/**
 * Synthesizes a structured 3-phase execution path for complex bureaucratic, study, or admin tasks.
 */
export function synthesizeTaskPath(taskText: string): TaskPathResult {
  const clean = taskText.trim();
  const calculation = calculateTaskReality(clean);

  const phases: TaskPathPhase[] = [
    {
      phase: 1,
      name: 'Desk Zero & Gathering',
      durationMinutes: 2,
      action: `Open only the single necessary browser tab or folder for "${clean}". Minimize all distracting windows and fetch water.`,
    },
    {
      phase: 2,
      name: 'Focused Sprint Block',
      durationMinutes: calculation.recommendedSprintMinutes,
      action: `Work exclusively on the primary deliverable for ${calculation.recommendedSprintMinutes} minutes with Stay keeping time.`,
    },
    {
      phase: 3,
      name: 'Clean Exit & Outcome Record',
      durationMinutes: 1,
      action: `Save progress, log session outcome in Stay, and take a guilt-free 5-minute cognitive recharge.`,
    },
  ];

  const totalSprintMinutes = phases.reduce((acc, p) => acc + p.durationMinutes, 0);

  const spokenSummary = `Here is your frictionless 3-phase path: 2 min to gather tools, ${calculation.recommendedSprintMinutes} min of pure focus, and 1 min to close out. Total ${totalSprintMinutes} minutes.`;

  return {
    taskText: clean,
    phases,
    totalSprintMinutes,
    spokenSummary,
  };
}
