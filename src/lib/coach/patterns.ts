import type {
  BarrierStat,
  BarrierType,
  CoachSessionRecord,
  StrategyKey,
  StrategyStat,
  TreatmentCheckinRecord,
} from '@/types/domain';
import { BARRIER_DEFINITIONS, STRATEGY_DEFINITIONS } from '@/lib/coach/strategies';

const STRATEGY_ORDER: StrategyKey[] = [
  'task_shrinking',
  'implementation_intention',
  'reframing',
  'timeboxing',
];

export interface OverallInitiationMetrics {
  totalCompletedSessions: number;
  startedCount: number;
  partlyStartedCount: number;
  notStartedCount: number;
  pausedCount: number;
  overallStartRatePercent: number | null;
  overallDenominatorLabel: string;
  totalFocusedMinutes: number;
  isPreliminary: boolean;
}

export interface TreatmentAdherenceSummary {
  totalCheckins: number;
  takenCount: number;
  skippedCount: number;
  notApplicableCount: number;
  takenRatePercent: number | null;
  denominatorLabel: string;
  averageFocusRating: number | null;
  averageSleepQuality: number | null;
  sideEffectsCount: number;
  sideEffectNotes: Array<{ createdAt: string; note: string }>;
}

export function computeOverallMetrics(
  sessions: CoachSessionRecord[]
): OverallInitiationMetrics {
  const completed = sessions.filter((s) => s.outcome !== null && !s.crisisTriggered);
  const totalCompletedSessions = completed.length;

  let startedCount = 0;
  let partlyStartedCount = 0;
  let notStartedCount = 0;
  let pausedCount = 0;
  let totalActualSeconds = 0;

  for (const s of completed) {
    if (s.outcome === 'started') startedCount++;
    else if (s.outcome === 'partly_started') partlyStartedCount++;
    else if (s.outcome === 'not_started') notStartedCount++;
    else if (s.outcome === 'paused_or_stopped') pausedCount++;

    if (typeof s.actualSeconds === 'number' && s.actualSeconds > 0) {
      totalActualSeconds += s.actualSeconds;
    } else if (s.outcome === 'started' || s.outcome === 'partly_started') {
      totalActualSeconds += s.plannedMinutes * 60;
    }
  }

  const positiveStarts = startedCount + partlyStartedCount;
  const overallStartRatePercent =
    totalCompletedSessions > 0
      ? Math.round((positiveStarts / totalCompletedSessions) * 100)
      : null;

  return {
    totalCompletedSessions,
    startedCount,
    partlyStartedCount,
    notStartedCount,
    pausedCount,
    overallStartRatePercent,
    overallDenominatorLabel:
      totalCompletedSessions > 0
        ? `${positiveStarts} of ${totalCompletedSessions} logged sessions started (fully or partly)`
        : '0 logged sessions',
    totalFocusedMinutes: Math.round(totalActualSeconds / 60),
    isPreliminary: totalCompletedSessions < 5,
  };
}

export function computeStrategyStats(
  sessions: CoachSessionRecord[]
): StrategyStat[] {
  const completed = sessions.filter((s) => s.outcome !== null && !s.crisisTriggered);

  return STRATEGY_ORDER.map((strategyKey) => {
    const def = STRATEGY_DEFINITIONS[strategyKey];
    const matching = completed.filter((s) => s.strategyKey === strategyKey);
    const attempts = matching.length;

    let startedCount = 0;
    let partlyStartedCount = 0;
    let notStartedCount = 0;
    let pausedCount = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    for (const s of matching) {
      if (s.outcome === 'started') startedCount++;
      else if (s.outcome === 'partly_started') partlyStartedCount++;
      else if (s.outcome === 'not_started') notStartedCount++;
      else if (s.outcome === 'paused_or_stopped') pausedCount++;

      if (typeof s.helpfulRating === 'number') {
        ratingSum += s.helpfulRating;
        ratingCount++;
      }
    }

    const positiveStarts = startedCount + partlyStartedCount;
    const startRatePercent =
      attempts > 0 ? Math.round((positiveStarts / attempts) * 100) : null;

    return {
      strategyKey,
      label: def.label,
      shortDescription: def.shortDescription,
      attempts,
      startedCount,
      partlyStartedCount,
      notStartedCount,
      pausedCount,
      startRatePercent,
      denominatorLabel:
        attempts > 0
          ? `${positiveStarts} of ${attempts} started`
          : 'No sessions logged yet',
      isPreliminary: attempts < 3,
      averageHelpfulRating:
        ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : null,
    };
  });
}

export function computeBarrierBreakdown(
  sessions: CoachSessionRecord[]
): BarrierStat[] {
  const valid = sessions.filter((s) => !s.crisisTriggered);
  const total = valid.length;
  if (total === 0) return [];

  const counts = new Map<BarrierType, number>();
  for (const s of valid) {
    counts.set(s.barrierType, (counts.get(s.barrierType) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([barrierType, count]) => ({
      barrierType,
      label: BARRIER_DEFINITIONS[barrierType]?.label || barrierType,
      count,
      sharePercent: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

export function computeAdherenceSummary(
  checkins: TreatmentCheckinRecord[]
): TreatmentAdherenceSummary {
  const totalCheckins = checkins.length;
  let takenCount = 0;
  let skippedCount = 0;
  let notApplicableCount = 0;
  let focusSum = 0;
  let focusCount = 0;
  let sleepSum = 0;
  let sleepCount = 0;
  let sideEffectsCount = 0;
  const sideEffectNotes: Array<{ createdAt: string; note: string }> = [];

  for (const c of checkins) {
    if (c.takenStatus === 'taken') takenCount++;
    else if (c.takenStatus === 'skipped') skippedCount++;
    else if (c.takenStatus === 'not_applicable') notApplicableCount++;

    if (typeof c.focusRating === 'number') {
      focusSum += c.focusRating;
      focusCount++;
    }
    if (typeof c.sleepQuality === 'number') {
      sleepSum += c.sleepQuality;
      sleepCount++;
    }
    if (c.sideEffectsNoted) {
      sideEffectsCount++;
      if (c.sideEffectNote && c.sideEffectNote.trim()) {
        sideEffectNotes.push({
          createdAt: c.createdAt,
          note: c.sideEffectNote.trim(),
        });
      }
    }
  }

  const applicableDenominator = takenCount + skippedCount;
  const takenRatePercent =
    applicableDenominator > 0
      ? Math.round((takenCount / applicableDenominator) * 100)
      : null;

  return {
    totalCheckins,
    takenCount,
    skippedCount,
    notApplicableCount,
    takenRatePercent,
    denominatorLabel:
      applicableDenominator > 0
        ? `${takenCount} of ${applicableDenominator} applicable check-in days recorded as taken`
        : `${totalCheckins} check-ins recorded`,
    averageFocusRating:
      focusCount > 0 ? Number((focusSum / focusCount).toFixed(1)) : null,
    averageSleepQuality:
      sleepCount > 0 ? Number((sleepSum / sleepCount).toFixed(1)) : null,
    sideEffectsCount,
    sideEffectNotes,
  };
}
