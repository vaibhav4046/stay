import { describe, expect, it } from 'vitest';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';
import { buildDeterministicCoachPlan, chooseBestStrategy } from '@/lib/coach/strategies';
import { computeAdherenceSummary, computeOverallMetrics, computeStrategyStats } from '@/lib/coach/patterns';
import { SAMPLE_DEMO_CHECKINS, SAMPLE_DEMO_SESSIONS } from '@/lib/storage/repository';
import { CoachPlanResponseSchema, ProposeCoachingPlanToolArgsSchema } from '@/lib/coach/schema';

describe('crisis detection', () => {
  it.each(['I want to kill myself', 'thinking about suicide', "I don't want to be alive", 'I might hurt myself'])(
    'flags "%s"',
    (t) => expect(detectCrisisSignal(t).triggered).toBe(true)
  );
  it.each(['this deadline is killing me', 'reply to my landlord', 'I am dying to finish this'])('does not flag "%s"', (t) =>
    expect(detectCrisisSignal(t).triggered).toBe(false)
  );
});

describe('medication boundary', () => {
  it.each(['Should I double my dose?', 'what dose should I take', 'can I stop taking my elvanse', 'is 30mg too high'])(
    'flags "%s"',
    (t) => expect(detectMedicationAdviceRequest(t).triggered).toBe(true)
  );
  it('does not flag logging', () => expect(detectMedicationAdviceRequest('I took my meds this morning').triggered).toBe(false));
});

describe('coach plan', () => {
  it('crisis input short-circuits to crisis flag', () => {
    expect(buildDeterministicCoachPlan({ taskText: 'I want to end my life' }).safetyFlag).toBe('crisis');
  });
  it('medication question gets boundary flag', () => {
    expect(buildDeterministicCoachPlan({ taskText: 'should I increase my dose' }).safetyFlag).toBe('medical_boundary');
  });
  it('normal task produces schema-valid plan', () => {
    const p = buildDeterministicCoachPlan({ taskText: 'Reply to landlord email', barrierType: 'overwhelm' });
    expect(CoachPlanResponseSchema.safeParse(p).success).toBe(true);
    expect(p.strategyKey).toBe('task_shrinking');
    expect(p.timerMinutes).toBe(5);
  });
  it('personalises once a strategy has >=3 attempts and >=60% start rate', () => {
    const r = chooseBestStrategy({
      barrierType: 'perfectionism_or_fear',
      strategyHistory: [{ strategyKey: 'timeboxing', attempts: 4, startedCount: 3 }],
    });
    expect(r.strategyKey).toBe('timeboxing');
    expect(r.personalizedReason).toContain('3 of 4');
  });
  it('does not personalise on tiny samples', () => {
    const r = chooseBestStrategy({
      barrierType: 'perfectionism_or_fear',
      strategyHistory: [{ strategyKey: 'timeboxing', attempts: 2, startedCount: 2 }],
    });
    expect(r.strategyKey).toBe('reframing');
  });
});

describe('tool arg parsing', () => {
  it('clamps timer minutes and tolerates unknown enums', () => {
    const p = ProposeCoachingPlanToolArgsSchema.parse({
      taskText: 'x',
      barrierType: 'nonsense',
      strategyKey: 'task_shrinking',
      firstStep: 'open it',
      timerMinutes: 25,
    });
    expect(p.timerMinutes).toBe(15);
    expect(p.barrierType).toBe('overwhelm');
  });
});

describe('patterns', () => {
  it('computes exact denominators from sample data', () => {
    const o = computeOverallMetrics(SAMPLE_DEMO_SESSIONS);
    expect(o.totalCompletedSessions).toBe(6);
    expect(o.overallStartRatePercent).toBe(83); // 5 of 6
    const shrink = computeStrategyStats(SAMPLE_DEMO_SESSIONS).find((s) => s.strategyKey === 'task_shrinking')!;
    expect(shrink.attempts).toBe(3);
    expect(shrink.denominatorLabel).toBe('3 of 3 started');
  });
  it('adherence excludes not_applicable from denominator', () => {
    const a = computeAdherenceSummary(SAMPLE_DEMO_CHECKINS);
    expect(a.takenCount).toBe(3);
    expect(a.takenRatePercent).toBe(75);
    expect(a.sideEffectsCount).toBe(2);
  });
});
