import { describe, expect, it } from 'vitest';
import {
  detectCrisisSignal,
  detectMedicationAdviceRequest,
  detectSensoryGroundingRequest,
  detectImpulsiveActionRisk,
  UK_CRISIS_RESOURCES,
} from '@/lib/safety/crisis';
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
  it('includes 999, 111, 116 123, 85258 and 988 in emergency resources', () => {
    const contacts = UK_CRISIS_RESOURCES.map((r) => r.contact);
    expect(contacts).toContain('999');
    expect(contacts).toContain('111');
    expect(contacts).toContain('116 123');
    expect(contacts).toContain('988');
  });
});

describe('sensory grounding & acute dysregulation safety tier', () => {
  it.each(['Stay ground me', 'I am having a panic attack', 'sensory overload', "I can't breathe", 'having a meltdown'])(
    'triggers grounding for "%s"',
    (t) => expect(detectSensoryGroundingRequest(t).triggered).toBe(true)
  );
  it('does not trigger on ordinary task', () => {
    expect(detectSensoryGroundingRequest('Organize my desk drawers').triggered).toBe(false);
  });
});

describe('ADHD impulsive action & dopamine pause safeguard', () => {
  it.each([
    'going to quit my job right now',
    'spend all my savings on this gadget',
    'send an angry email to my manager',
  ])('triggers dopamine pause for "%s"', (t) =>
    expect(detectImpulsiveActionRisk(t).triggered).toBe(true)
  );
  it('does not trigger on planned task', () => {
    expect(detectImpulsiveActionRisk('Write draft reply to landlord').triggered).toBe(false);
  });
});

describe('medication boundary', () => {
  it.each([
    'Should I double my dose?',
    'what dose should I take',
    'can I stop taking my elvanse',
    'is 30mg too high',
    'Should I take 30mg or 40mg of my Vyvanse?',
  ])('flags "%s"', (t) => expect(detectMedicationAdviceRequest(t).triggered).toBe(true));
  it('does not flag logging', () => expect(detectMedicationAdviceRequest('I took my meds this morning').triggered).toBe(false));
});

describe('coach plan', () => {
  it('crisis input short-circuits to crisis flag with 0 timerMinutes and resources', () => {
    const plan = buildDeterministicCoachPlan({ taskText: 'I want to end my life' });
    expect(plan.safetyFlag).toBe('crisis');
    expect(plan.timerMinutes).toBe(0);
    expect(plan.resources?.length).toBeGreaterThanOrEqual(3);
  });
  it('medication question gets boundary flag with 0 timerMinutes and doctor referral', () => {
    const plan = buildDeterministicCoachPlan({ taskText: 'should I increase my dose' });
    expect(plan.safetyFlag).toBe('medical_boundary');
    expect(plan.timerMinutes).toBe(0);
    expect(plan.spokenResponse).toContain('prescribing clinician');
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
  it('supports custom focus intervals (like 20 or 25 min) and clamps excessive timers', () => {
    const p20 = ProposeCoachingPlanToolArgsSchema.parse({
      taskText: 'x',
      barrierType: 'nonsense',
      strategyKey: 'task_shrinking',
      firstStep: 'open it',
      timerMinutes: 20,
    });
    expect(p20.timerMinutes).toBe(20);
    expect(p20.barrierType).toBe('overwhelm');

    const pMax = ProposeCoachingPlanToolArgsSchema.parse({
      taskText: 'x',
      barrierType: 'overwhelm',
      strategyKey: 'task_shrinking',
      firstStep: 'open it',
      timerMinutes: 120,
    });
    expect(pMax.timerMinutes).toBe(60);
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

  it('supports saving, retrieving, and clearing custom Supabase config in local storage', async () => {
    const { saveCustomSupabaseConfig, clearCustomSupabaseConfig, getEffectiveSupabaseConfig } =
      await import('@/lib/supabase/client');

    saveCustomSupabaseConfig('https://myproject.supabase.co', 'eyJcustomAnonKey123');
    const cfg = getEffectiveSupabaseConfig();
    expect(cfg?.url).toBe('https://myproject.supabase.co');
    expect(cfg?.anonKey).toBe('eyJcustomAnonKey123');

    clearCustomSupabaseConfig();
    expect(getEffectiveSupabaseConfig()).toBeNull();
  });
});
