import { z } from 'zod';

export const BarrierTypeSchema = z.enum([
  'overwhelm',
  'unclear_next_step',
  'perfectionism_or_fear',
  'boredom_or_distraction',
  'low_energy',
  'other',
]);

export const StrategyKeySchema = z.enum([
  'task_shrinking',
  'implementation_intention',
  'reframing',
  'timeboxing',
]);

export const CareContextSchema = z.enum([
  'waitlisted',
  'medicated',
  'in_therapy',
  'self_managing',
  'prefer_not_to_say',
]);

export const SessionOutcomeSchema = z.enum([
  'started',
  'partly_started',
  'not_started',
  'paused_or_stopped',
]);

export const CoachPlanRequestSchema = z.object({
  taskText: z.string().min(1, 'Please describe the task you want to start.').max(280),
  barrierType: BarrierTypeSchema.optional(),
  preferredStrategy: StrategyKeySchema.optional(),
  careContext: CareContextSchema.optional().default('self_managing'),
  preferredMinutes: z.number().int().min(1).max(60).optional(),
  userMemoryPrompt: z.string().max(2000).optional(),
  strategyHistory: z
    .array(
      z.object({
        strategyKey: StrategyKeySchema,
        attempts: z.number().int().nonnegative(),
        startedCount: z.number().int().nonnegative(),
      })
    )
    .optional(),
});

export const CoachPlanResponseSchema = z.object({
  spokenResponse: z.string().min(1).max(400),
  taskText: z.string().max(280),
  barrierType: BarrierTypeSchema,
  strategyKey: StrategyKeySchema,
  strategyLabel: z.string().max(80),
  firstStep: z.string().max(220),
  whyThisFits: z.string().max(240),
  timerMinutes: z.number().int().min(0).max(60),
  checkinPrompt: z.string().max(200),
  safetyFlag: z.enum(['none', 'crisis', 'medical_boundary']),
  resources: z
    .array(
      z.object({
        name: z.string(),
        contact: z.string(),
        href: z.string(),
        detail: z.string(),
      })
    )
    .optional(),
});

export const ProposeCoachingPlanToolArgsSchema = z.object({
  taskText: z.string().min(1).max(280),
  barrierType: BarrierTypeSchema.catch('overwhelm'),
  strategyKey: StrategyKeySchema.catch('task_shrinking'),
  firstStep: z.string().min(1).max(220),
  timerMinutes: z
    .number()
    .transform((n): number => (n <= 1 ? 5 : n > 60 ? 60 : Math.round(n))),
});

export const StartFocusTimerToolArgsSchema = z.object({
  minutes: z
    .number()
    .transform((n): number => (n <= 1 ? 5 : n > 60 ? 60 : Math.round(n))),
  firstStep: z.string().min(1).max(220),
});

export const RecordSessionOutcomeToolArgsSchema = z.object({
  outcome: SessionOutcomeSchema,
  helpfulRating: z.number().int().min(1).max(5).optional(),
});
