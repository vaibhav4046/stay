import type {
  BarrierType,
  CareContext,
  CoachPlanProposal,
  StrategyKey,
} from '@/types/domain';
import {
  detectCrisisSignal,
  detectMedicationAdviceRequest,
} from '@/lib/safety/crisis';

export interface BarrierDefinition {
  key: BarrierType;
  label: string;
  shortPrompt: string;
  defaultStrategy: StrategyKey;
}

export interface StrategyDefinition {
  key: StrategyKey;
  label: string;
  evidenceBasis: string;
  shortDescription: string;
  howItWorks: string;
  defaultTimerMinutes: 5 | 10 | 15;
}

export const BARRIER_DEFINITIONS: Record<BarrierType, BarrierDefinition> = {
  overwhelm: {
    key: 'overwhelm',
    label: 'Too big / overwhelming',
    shortPrompt: 'There are too many moving parts to hold in working memory.',
    defaultStrategy: 'task_shrinking',
  },
  unclear_next_step: {
    key: 'unclear_next_step',
    label: 'Unclear first step',
    shortPrompt: 'The goal is clear, but the physical first move is blurry.',
    defaultStrategy: 'implementation_intention',
  },
  perfectionism_or_fear: {
    key: 'perfectionism_or_fear',
    label: 'Worry about getting it wrong',
    shortPrompt: 'High stakes, fear of judgment, or pressure to make it polished.',
    defaultStrategy: 'reframing',
  },
  boredom_or_distraction: {
    key: 'boredom_or_distraction',
    label: 'Boredom / under-stimulation',
    shortPrompt: 'Repetitive admin that feels tedious or pulls attention elsewhere.',
    defaultStrategy: 'timeboxing',
  },
  low_energy: {
    key: 'low_energy',
    label: 'Low mental or physical energy',
    shortPrompt: 'Fatigue or late-day executive depletion.',
    defaultStrategy: 'task_shrinking',
  },
  other: {
    key: 'other',
    label: 'Something else / just stuck',
    shortPrompt: 'General task friction without one obvious cause.',
    defaultStrategy: 'task_shrinking',
  },
};

export const STRATEGY_DEFINITIONS: Record<StrategyKey, StrategyDefinition> = {
  task_shrinking: {
    key: 'task_shrinking',
    label: 'Task shrinking (<2 min entry)',
    evidenceBasis: 'CBT behavioral activation & executive-function task decomposition',
    shortDescription: 'Cut the task down to a physical setup move that takes under two minutes.',
    howItWorks: 'Removes working-memory load by separating opening the work from finishing it.',
    defaultTimerMinutes: 5,
  },
  implementation_intention: {
    key: 'implementation_intention',
    label: 'If-Then anchor (Implementation intention)',
    evidenceBasis: 'Gollwitzer implementation intentions & ADHD CBT skills modules',
    shortDescription: 'Pair an immediate physical cue with one specific action.',
    howItWorks: 'Replaces open-ended deciding with a pre-committed trigger ("When timer starts, I will...").',
    defaultTimerMinutes: 10,
  },
  reframing: {
    key: 'reframing',
    label: 'Permission for a rough draft (Cognitive reframing)',
    evidenceBasis: 'CBT cognitive restructuring for ADHD perfectionism & avoidance',
    shortDescription: 'Lower the bar explicitly to a messy, private first pass.',
    howItWorks: 'Disarms all-or-nothing paralysis by making a flawed version the official target.',
    defaultTimerMinutes: 10,
  },
  timeboxing: {
    key: 'timeboxing',
    label: 'Bounded sprint with clean exit (Timeboxing)',
    evidenceBasis: 'Structured time-horizon bounding in adult ADHD coaching',
    shortDescription: 'Work for a fixed 5–10 minute window with full permission to stop at the bell.',
    howItWorks: 'Replaces an infinite horizon with a short, visible finish line.',
    defaultTimerMinutes: 10,
  },
};

export function inferBarrierFromTask(taskText: string): BarrierType {
  const lower = taskText.toLowerCase();
  if (/(email|reply|message|apolog|boss|client|landlord|call|tell|ask)/i.test(lower)) {
    return 'perfectionism_or_fear';
  }
  if (/(tax|form|invoice|expense|clean|tidy|laundry|dishes|sort|pack)/i.test(lower)) {
    return 'boredom_or_distraction';
  }
  if (/(tired|exhausted|sleepy|drained|late|headache)/i.test(lower)) {
    return 'low_energy';
  }
  if (/(plan|figure out|where to start|research|outline|decide)/i.test(lower)) {
    return 'unclear_next_step';
  }
  return 'overwhelm';
}

export function chooseBestStrategy(params: {
  barrierType: BarrierType;
  preferredStrategy?: StrategyKey;
  strategyHistory?: Array<{
    strategyKey: StrategyKey;
    attempts: number;
    startedCount: number;
  }>;
}): { strategyKey: StrategyKey; personalizedReason: string | null } {
  if (params.preferredStrategy) {
    return {
      strategyKey: params.preferredStrategy,
      personalizedReason: null,
    };
  }

  const defaultForBarrier = BARRIER_DEFINITIONS[params.barrierType].defaultStrategy;

  if (params.strategyHistory && params.strategyHistory.length > 0) {
    const eligible = params.strategyHistory
      .filter((item) => item.attempts >= 3)
      .map((item) => ({
        ...item,
        rate: item.startedCount / item.attempts,
      }))
      .sort((a, b) => b.rate - a.rate || b.attempts - a.attempts);

    if (eligible.length > 0 && eligible[0].rate >= 0.6) {
      const best = eligible[0];
      const def = STRATEGY_DEFINITIONS[best.strategyKey];
      return {
        strategyKey: best.strategyKey,
        personalizedReason: `Selected ${def.label} because you started in ${best.startedCount} of ${best.attempts} logged sessions using it.`,
      };
    }
  }

  return {
    strategyKey: defaultForBarrier,
    personalizedReason: null,
  };
}

export function buildDeterministicFirstStep(
  taskText: string,
  strategyKey: StrategyKey
): string {
  const cleaned = taskText.trim().replace(/\.$/, '');
  const lower = cleaned.toLowerCase();

  const isMessageTask = /(email|reply|message|text|write to|landlord|client|professor|manager|gp)/i.test(lower);
  const isDocTask = /(report|essay|slides|presentation|doc|proposal|application|cv|resume)/i.test(lower);
  const isAdminTask = /(form|tax|invoice|bill|bank|portal|appointment|insurance|expense)/i.test(lower);
  const isSpaceTask = /(clean|tidy|desk|kitchen|laundry|room|dishes|pack)/i.test(lower);

  if (strategyKey === 'task_shrinking') {
    if (isMessageTask) {
      return `Open the message thread for "${cleaned}" and type one rough sentence in the draft box without sending it.`;
    }
    if (isDocTask) {
      return `Open the document for "${cleaned}", write a working title at the top, and list three bullet fragments.`;
    }
    if (isAdminTask) {
      return `Open the webpage or folder for "${cleaned}" and place the first required document or reference number on screen.`;
    }
    if (isSpaceTask) {
      return `Pick up just five visible items related to "${cleaned}" and put them in one pile.`;
    }
    return `Open the exact tool or surface you need for "${cleaned}" and do the first 90 seconds of setup only.`;
  }

  if (strategyKey === 'implementation_intention') {
    if (isMessageTask) {
      return `When the timer starts, I will open the reply window for "${cleaned}" and write the first line: "Hi — quick update on this:"`;
    }
    return `When the timer starts, I will put everything else out of sight, open "${cleaned}", and complete the first visible field or bullet.`;
  }

  if (strategyKey === 'reframing') {
    if (isMessageTask) {
      return `Write a deliberately clumsy, private 2-sentence draft for "${cleaned}" that nobody sees yet—you only need raw words on screen.`;
    }
    return `Create a "version 0" scratch pass of "${cleaned}" where spelling, polish, and completeness do not count for the next 10 minutes.`;
  }

  // timeboxing
  return `Work on "${cleaned}" for one bounded timer block only. You have full permission to stop the moment the timer rings.`;
}

export function buildDeterministicCoachPlan(params: {
  taskText: string;
  barrierType?: BarrierType;
  preferredStrategy?: StrategyKey;
  careContext?: CareContext;
  preferredMinutes?: 5 | 10 | 15;
  strategyHistory?: Array<{
    strategyKey: StrategyKey;
    attempts: number;
    startedCount: number;
  }>;
}): CoachPlanProposal {
  const crisis = detectCrisisSignal(params.taskText);
  if (crisis.triggered) {
    return {
      spokenResponse: crisis.message,
      taskText: params.taskText,
      barrierType: 'other',
      strategyKey: 'task_shrinking',
      strategyLabel: STRATEGY_DEFINITIONS.task_shrinking.label,
      firstStep: 'Pause task coaching and connect with human crisis support right now.',
      whyThisFits: 'Immediate safety comes before any task.',
      timerMinutes: 5,
      checkinPrompt: 'Please reach out to 999, NHS 111, or Samaritans on 116 123.',
      safetyFlag: 'crisis',
    };
  }

  const medBoundary = detectMedicationAdviceRequest(params.taskText);
  if (medBoundary.triggered) {
    return {
      spokenResponse: medBoundary.message,
      taskText: params.taskText,
      barrierType: 'other',
      strategyKey: 'task_shrinking',
      strategyLabel: STRATEGY_DEFINITIONS.task_shrinking.label,
      firstStep: 'Write down your medication question in the Clinician Report notes to ask your prescriber or pharmacist.',
      whyThisFits: 'Stay never gives medication or dosing advice.',
      timerMinutes: 5,
      checkinPrompt: 'Did you note down the question for your prescriber or pharmacist?',
      safetyFlag: 'medical_boundary',
    };
  }

  const barrierType = params.barrierType || inferBarrierFromTask(params.taskText);
  const { strategyKey, personalizedReason } = chooseBestStrategy({
    barrierType,
    preferredStrategy: params.preferredStrategy,
    strategyHistory: params.strategyHistory,
  });

  const strategy = STRATEGY_DEFINITIONS[strategyKey];
  const barrier = BARRIER_DEFINITIONS[barrierType];
  const firstStep = buildDeterministicFirstStep(params.taskText, strategyKey);
  const timerMinutes: 5 | 10 | 15 =
    params.preferredMinutes ||
    (barrierType === 'low_energy' || barrierType === 'overwhelm'
      ? 5
      : strategy.defaultTimerMinutes);

  const whyThisFits =
    personalizedReason ||
    `For "${barrier.label.toLowerCase()}", ${strategy.label.toLowerCase()} lowers initiation friction: ${strategy.howItWorks}`;

  const spokenResponse = `Let's make this smaller. ${firstStep} Start a ${timerMinutes}-minute timer whenever you're ready, and I'll check in at the end.`;

  return {
    spokenResponse,
    taskText: params.taskText.trim(),
    barrierType,
    strategyKey,
    strategyLabel: strategy.label,
    firstStep,
    whyThisFits,
    timerMinutes,
    checkinPrompt: `Your ${timerMinutes}-minute block is complete. Did you get started on "${firstStep}"?`,
    safetyFlag: 'none',
  };
}
