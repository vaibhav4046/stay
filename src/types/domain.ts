export type CareContext =
  | 'waitlisted'
  | 'medicated'
  | 'in_therapy'
  | 'self_managing'
  | 'prefer_not_to_say';

export type InteractionMode = 'voice_and_text' | 'quiet_text_only';

export type BarrierType =
  | 'overwhelm'
  | 'unclear_next_step'
  | 'perfectionism_or_fear'
  | 'boredom_or_distraction'
  | 'low_energy'
  | 'other';

export type StrategyKey =
  | 'task_shrinking'
  | 'implementation_intention'
  | 'reframing'
  | 'timeboxing';

export type SessionOutcome =
  | 'started'
  | 'partly_started'
  | 'not_started'
  | 'paused_or_stopped';

export type TakenStatus =
  | 'taken'
  | 'skipped'
  | 'not_applicable'
  | 'prefer_not_to_say';

export type VoiceVisualState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'saving'
  | 'complete'
  | 'error';

export interface UserProfile {
  userId: string;
  careContext: CareContext;
  interactionMode: InteractionMode;
  proactiveCheckins: boolean;
  onboardingCompleted: boolean;
  updatedAt: string;
}

export interface CoachPlanProposal {
  spokenResponse: string;
  taskText: string;
  barrierType: BarrierType;
  strategyKey: StrategyKey;
  strategyLabel: string;
  firstStep: string;
  whyThisFits: string;
  timerMinutes: 5 | 10 | 15;
  checkinPrompt: string;
  safetyFlag: 'none' | 'crisis' | 'medical_boundary';
}

export interface CoachSessionRecord {
  id: string;
  userId: string;
  createdAt: string;
  completedAt: string | null;
  mode: 'voice' | 'text';
  careContext: CareContext;
  taskText: string;
  barrierType: BarrierType;
  strategyKey: StrategyKey;
  firstStep: string;
  plannedMinutes: number;
  actualSeconds: number | null;
  outcome: SessionOutcome | null;
  helpfulRating: number | null;
  crisisTriggered: boolean;
  isSample?: boolean;
}

export interface TreatmentCheckinRecord {
  id: string;
  userId: string;
  createdAt: string;
  takenStatus: TakenStatus;
  sideEffectsNoted: boolean;
  sideEffectNote: string | null;
  focusRating: number | null;
  sleepQuality: number | null;
  isSample?: boolean;
}

export interface AuditEventRecord {
  id: string;
  userId: string;
  createdAt: string;
  eventType: string;
  eventSummary: string;
}

export interface StrategyStat {
  strategyKey: StrategyKey;
  label: string;
  shortDescription: string;
  attempts: number;
  startedCount: number;
  partlyStartedCount: number;
  notStartedCount: number;
  pausedCount: number;
  startRatePercent: number | null;
  denominatorLabel: string;
  isPreliminary: boolean;
  averageHelpfulRating: number | null;
}

export interface BarrierStat {
  barrierType: BarrierType;
  label: string;
  count: number;
  sharePercent: number;
}

export interface ClinicianReportConfig {
  periodDays: 7 | 14 | 30;
  includeCareContext: boolean;
  includeInitiationMetrics: boolean;
  includeStrategyTable: boolean;
  includeBarriers: boolean;
  includeTreatmentAdherence: boolean;
  includeSideEffectNotes: boolean;
  includeQuestionsForClinician: boolean;
  questionsForClinician: string;
  patientDisplayName: string;
}
