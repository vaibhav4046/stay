'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BarrierType,
  CareContext,
  CoachPlanProposal,
  CoachSessionRecord,
  SessionOutcome,
  StrategyKey,
} from '@/types/domain';
import { BARRIER_DEFINITIONS, STRATEGY_DEFINITIONS, buildDeterministicCoachPlan } from '@/lib/coach/strategies';
import { computeStrategyStats } from '@/lib/coach/patterns';
import { detectCrisisSignal, CRISIS_FIXED_MESSAGE } from '@/lib/safety/crisis';
import { useVoiceAgent } from '@/lib/voice/useVoiceAgent';
import { useCrisisPanel } from '@/components/CrisisHelpPanel';
import { Signal } from '@/components/Signal';
import {
  loadUserCalibration,
  recordSessionLearning,
  addUserTrainingInstruction,
  removeUserTrainingInstruction,
  type UserCalibrationProfile,
} from '@/lib/coach/selfImprovement';
import {
  addUserMemoryFact,
  removeUserMemoryFact,
  clearAllUserMemories,
  recordSessionMemory,
  buildMemorySystemPrompt,
} from '@/lib/coach/userMemory';
import { OrbCompanionView } from '@/components/OrbCompanionView';
import { GroundingPanel } from '@/components/GroundingPanel';
import { AuthModal } from '@/components/AuthModal';
import { useAssistantHardware } from '@/lib/voice/useAssistantHardware';
import { useAuth } from '@/lib/auth/useAuth';
import { detectSensoryGroundingRequest, detectImpulsiveActionRisk } from '@/lib/safety/crisis';

type Step = 'capture' | 'barrier' | 'plan' | 'timer' | 'outcome' | 'done';

const OUTCOME_OPTIONS: Array<{ key: SessionOutcome; label: string }> = [
  { key: 'started', label: 'I started' },
  { key: 'partly_started', label: 'I partly started' },
  { key: 'not_started', label: "I didn't start" },
  { key: 'paused_or_stopped', label: 'I paused or stopped' },
];

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function softChime() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 1.25);
    o.onended = () => ctx.close();
  } catch {
    // audio unavailable
  }
}

export function CoachWorkspace({
  careContext,
  sessions,
  proactiveCheckins,
  quietMode,
  onQuietModeChange,
  onLogSession,
  isDemo,
}: {
  careContext: CareContext;
  sessions: CoachSessionRecord[];
  proactiveCheckins: boolean;
  quietMode: boolean;
  onQuietModeChange: (quiet: boolean) => void;
  onLogSession: (rec: Omit<CoachSessionRecord, 'id' | 'userId' | 'createdAt'>) => Promise<unknown>;
  isDemo: boolean;
}) {
  const { openCrisisPanel } = useCrisisPanel();
  const [step, setStep] = useState<Step>('capture');
  const [taskText, setTaskText] = useState('');
  const [barrier, setBarrier] = useState<BarrierType | null>(null);
  const [plan, setPlan] = useState<CoachPlanProposal | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [calibration, setCalibration] = useState<UserCalibrationProfile>(() => {
    try {
      return loadUserCalibration();
    } catch {
      return {
        preferredMinutes: 20,
        personaTone: 'warm_body_double',
        stepGranularity: 'ultra_micro',
        strategyWeights: { task_shrinking: 1.2, implementation_intention: 1.0, reframing: 1.1, timeboxing: 1.2 },
        userTrainingNotes: [],
        totalSessionsAnalyzed: 0,
        positiveRatingCount: 0,
        negativeRatingCount: 0,
        lastTrainedAt: new Date().toISOString(),
      };
    }
  });
  const [timerMinutes, setTimerMinutes] = useState<number>(() => calibration.preferredMinutes || 20);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [helpful, setHelpful] = useState<number | null>(null);
  const [boundaryNote, setBoundaryNote] = useState<string | null>(null);
  const [lastLogged, setLastLogged] = useState<SessionOutcome | null>(null);
  const [viewMode, setViewMode] = useState<'orb' | 'grid'>('orb');
  const [showGroundingPanel, setShowGroundingPanel] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useAuth();
  const [usedVoice, setUsedVoice] = useState(false);
  const [showStuckRescue, setShowStuckRescue] = useState(false);
  const [showTrainingPanel, setShowTrainingPanel] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [newMemoryFact, setNewMemoryFact] = useState('');
  const [trainingInput, setTrainingInput] = useState('');
  const [typedMessage, setTypedMessage] = useState('');
  const [actionReceipt, setActionReceipt] = useState<string | null>(null);
  const deadlineRef = useRef<number>(0);
  const crisisRef = useRef(false);
  const taskInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        taskInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const strategyHistory = useMemo(
    () =>
      computeStrategyStats(sessions).map((s) => ({
        strategyKey: s.strategyKey,
        attempts: s.attempts,
        startedCount: s.startedCount + s.partlyStartedCount,
      })),
    [sessions]
  );

  const triggerCrisis = useCallback(
    (message: string) => {
      crisisRef.current = true;
      setRunning(false);
      openCrisisPanel(message);
    },
    [openCrisisPanel]
  );

  const startTimer = useCallback((minutes: number) => {
    const valid = Math.max(1, Math.min(60, minutes));
    setTimerMinutes(valid);
    deadlineRef.current = Date.now() + valid * 60 * 1000;
    setRemaining(valid * 60);
    setElapsed(0);
    setRunning(true);
    setStep('timer');
    setActionReceipt(`Timer started · ${valid} min`);
  }, []);

  const voice = useVoiceAgent({
    onPlanProposed: (p) => {
      setTaskText(p.taskText);
      setBarrier(p.barrierType);
      setPlan(p);
      setTimerMinutes(p.timerMinutes === 0 ? (calibration.preferredMinutes || 20) : p.timerMinutes);
      setStep('plan');
      setActionReceipt(`Plan ready: ${p.strategyLabel}`);
    },
    onStartTimerRequested: (minutes, firstStep) => {
      const valid = minutes || calibration.preferredMinutes || 20;
      setPlan((prev) =>
        prev
          ? { ...prev, firstStep, timerMinutes: valid }
          : buildDeterministicCoachPlan({ taskText: firstStep, careContext, preferredMinutes: valid })
      );
      startTimer(valid);
    },
    onOutcomeRecorded: (outcome, rating) => {
      void logOutcome(outcome, rating ?? null);
    },
    onCrisisDetected: triggerCrisis,
    onMedicalBoundaryDetected: (m) => setBoundaryNote(m),
    onVoiceCommandDetected: (cmd) => {
      if (!cmd) return;
      if (cmd.type === 'start_timer') {
        setActionReceipt(`Voice command: Started ${cmd.minutes}m focus timer`);
      } else if (cmd.type === 'pause_listening') {
        setActionReceipt('Voice command: Hands-free listening paused');
      } else if (cmd.type === 'resume_listening') {
        setActionReceipt('Voice command: Hands-free listening active');
      } else if (cmd.type === 'record_outcome') {
        setActionReceipt(`Voice command: Logged outcome (${cmd.outcome})`);
      } else if (cmd.type === 'break_down') {
        voice.sendUserTextMessage('Can you break this down into an ultra-micro step?');
        setActionReceipt('Voice command: Shrinking task step');
      } else if (cmd.type === 'stop_timer') {
        setRunning(false);
        setActionReceipt('Voice command: Timer stopped');
      }
    },
  });

  useAssistantHardware({
    isConnected: voice.isConnected,
    isHandsFreePaused: voice.isHandsFreePaused,
    onToggleVoice: () => {
      if (!voice.isConnected) voice.startVoiceSession();
      else voice.disconnectVoiceSession();
    },
    onToggleHandsFreeMute: voice.toggleHandsFreeMute,
    onTriggerGrounding: () => setShowGroundingPanel(true),
    onStartTimer: (mins) => startTimer(mins),
  });

  const logOutcome = useCallback(
    async (outcome: SessionOutcome, rating?: number | null) => {
      if (!plan) return;
      const actualRating = rating ?? helpful;
      await onLogSession({
        completedAt: new Date().toISOString(),
        mode: usedVoice ? 'voice' : 'text',
        careContext,
        taskText: plan.taskText,
        barrierType: plan.barrierType,
        strategyKey: plan.strategyKey,
        firstStep: plan.firstStep,
        plannedMinutes: timerMinutes,
        actualSeconds: elapsed || null,
        outcome,
        helpfulRating: actualRating,
        crisisTriggered: false,
      });

      // Self-Improvement & Continuous Model Adaptation
      const updatedProfile = recordSessionLearning({
        strategyKey: plan.strategyKey,
        outcome,
        rating: actualRating,
        usedMinutes: timerMinutes,
      });
      setCalibration(updatedProfile);

      // Long-term Episodic Memory Recording
      recordSessionMemory({
        task: plan.taskText,
        outcome,
        minutes: timerMinutes,
      });
      voice.refreshUserMemory();

      setLastLogged(outcome);
      setRunning(false);
      setStep('done');
      setActionReceipt(`Session outcome logged · Memory updated`);
    },
    [plan, onLogSession, usedVoice, careContext, timerMinutes, elapsed, helpful, voice]
  );

  // Seed the agent with care context once connected.
  useEffect(() => {
    if (voice.isConnected) {
      setUsedVoice(true);
      voice.injectContext(
        `User care context: ${careContext}. Preferred focus block: ${calibration.preferredMinutes} minutes. Adapt tone warmly as a peer body-double. Never give medication advice.` +
          (taskText ? ` The user already typed this task: "${taskText}".` : '')
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isConnected]);

  // Timer tick based on wall-clock deadline (robust to tab throttling).
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      setElapsed(timerMinutes * 60 - left);
      if (left === 0) {
        setRunning(false);
        setStep('outcome');
        softChime();
        if (proactiveCheckins && plan) {
          voice.speakProactively(
            `The user's ${timerMinutes}-minute focus timer just ended. Speak first: in under 20 words, warmly ask whether they got started on "${plan.firstStep}". When they answer, call record_session_outcome.`
          );
        }
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [running, timerMinutes, proactiveCheckins, plan, voice.speakProactively]);

  const requestPlan = useCallback(
    async (chosenBarrier: BarrierType | null, preferredStrategy?: StrategyKey) => {
      const text = taskText.trim();
      if (!text) return;
      const crisis = detectCrisisSignal(text);
      if (crisis.triggered) {
        triggerCrisis(CRISIS_FIXED_MESSAGE);
        return;
      }
      setPlanLoading(true);
      setBoundaryNote(null);
      try {
        const res = await fetch('/api/coach/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskText: text,
            barrierType: chosenBarrier ?? undefined,
            preferredStrategy,
            careContext,
            preferredMinutes: timerMinutes,
            userMemoryPrompt: buildMemorySystemPrompt(voice.userMemory),
            strategyHistory,
          }),
        });
        const data = (await res.json()) as CoachPlanProposal & { error?: string };
        if (!res.ok || data.error) throw new Error(data.error || 'plan failed');
        if (data.safetyFlag === 'crisis') {
          triggerCrisis(data.spokenResponse);
          return;
        }
        if (data.safetyFlag === 'medical_boundary') {
          setBoundaryNote(data.spokenResponse);
          return;
        }
        setPlan(data);
        setTimerMinutes(data.timerMinutes === 0 ? (calibration.preferredMinutes || 20) : data.timerMinutes);
        setActionReceipt(`Plan ready: ${data.strategyLabel}`);
        setStep('plan');
      } catch {
        // Offline / server error: deterministic local plan keeps the loop working.
        const local = buildDeterministicCoachPlan({
          taskText: text,
          barrierType: chosenBarrier ?? undefined,
          preferredStrategy,
          careContext,
          preferredMinutes: timerMinutes,
          strategyHistory,
        });
        if (local.safetyFlag === 'crisis') {
          triggerCrisis(local.spokenResponse);
          return;
        }
        if (local.safetyFlag === 'medical_boundary') {
          setBoundaryNote(local.spokenResponse);
          return;
        }
        setPlan(local);
        setTimerMinutes(local.timerMinutes === 0 ? (calibration.preferredMinutes || 20) : local.timerMinutes);
        setStep('plan');
      } finally {
        setPlanLoading(false);
      }
    },
    [taskText, careContext, strategyHistory, triggerCrisis, timerMinutes, calibration.preferredMinutes]
  );

  const reset = () => {
    setStep('capture');
    setTaskText('');
    setBarrier(null);
    setPlan(null);
    setHelpful(null);
    setLastLogged(null);
    setBoundaryNote(null);
    setRunning(false);
  };

  const voiceAvailable = !quietMode;
  const progress = running || step === 'timer' ? 1 - remaining / (timerMinutes * 60) : 0;

  return (
    <>
      {viewMode === 'orb' ? (
        <OrbCompanionView
          voice={voice}
          taskText={taskText}
          onTaskTextChange={(t) => {
            setTaskText(t);
            const ground = detectSensoryGroundingRequest(t);
            if (ground.triggered) {
              setShowGroundingPanel(true);
              return;
            }
            const impulse = detectImpulsiveActionRisk(t);
            if (impulse.triggered) {
              setBoundaryNote(impulse.message);
              setActionReceipt('Safeguard: 10-Minute Dopamine Pause');
              return;
            }
            void requestPlan(null);
          }}
          plan={plan}
          running={running}
          remaining={remaining}
          timerMinutes={timerMinutes}
          onStartTimer={startTimer}
          onStopTimer={() => {
            setRunning(false);
            setActionReceipt('Timer stopped');
          }}
          onLogOutcome={(outcome) => {
            void logOutcome(outcome, 5);
          }}
          onOpenMemory={() => setShowMemoryPanel(true)}
          onOpenTraining={() => setShowTrainingPanel(true)}
          onOpenGrounding={() => setShowGroundingPanel(true)}
          onOpenAuth={() => setShowAuthModal(true)}
          onToggleQuietMode={() => {
            if (!quietMode) voice.disconnectVoiceSession();
            onQuietModeChange(!quietMode);
          }}
          quietMode={quietMode}
          onSwitchToWorkspace={() => setViewMode('grid')}
          actionReceipt={actionReceipt}
          userEmail={user?.email}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main loop column */}
          <section className="card p-5 sm:p-7" aria-labelledby="workspace-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="workspace-title" className="card-title">
                {step === 'capture' && 'What are you putting off?'}
                {step === 'barrier' && "What's making it hard to start?"}
                {step === 'plan' && 'One smaller first step'}
                {step === 'timer' && 'Focus block'}
                {step === 'outcome' && 'How did it go?'}
                {step === 'done' && 'Logged'}
              </h2>
              <div className="flex items-center gap-2">
                {isDemo && <span className="sample-badge">Sample data</span>}
                <button
                  type="button"
                  className="chip text-[0.82rem] flex items-center gap-1.5 border border-accent/30 bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium shadow-xs"
                  onClick={() => setViewMode('orb')}
                  title="Switch to Living Voice AGI Orb"
                >
                  <span>✨</span>
                  <span>Living Orb</span>
                </button>
                <button
                  type="button"
                  className="chip text-[0.82rem] flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  onClick={() => setShowGroundingPanel(true)}
                  title="Sensory Grounding (Key: G)"
                >
                  <span>🌿</span>
                  <span className="font-medium hidden sm:inline">Ground Me</span>
                </button>
                <button
                  type="button"
                  className="chip text-[0.82rem] flex items-center gap-1.5 border border-accent/20 bg-accent/5 text-accent hover:bg-accent/10 transition-colors"
                  onClick={() => setShowMemoryPanel(true)}
                  data-testid="user-memory-trigger"
                  title="View Stay's persistent memory of you"
                >
                  <span>🧬</span>
                  <span className="font-medium">
                    Memory ({voice.userMemory.facts.length + voice.userMemory.recentSessionsSummary.length})
                  </span>
                </button>
                <button
                  type="button"
                  className="chip text-[0.82rem] flex items-center gap-1.5 border border-accent/20 bg-accent/5 text-accent hover:bg-accent/10 transition-colors"
                  onClick={() => setShowTrainingPanel(true)}
                  data-testid="self-improvement-trigger"
                  title="View Stay's autonomous model adaptation & train your preferences"
                >
                  <span>🧠</span>
                  <span className="font-medium">Learned: {calibration.preferredMinutes}m</span>
                </button>
                <button
                  type="button"
                  className="chip text-[0.82rem] flex items-center gap-1.5 border border-line hover:bg-line transition-colors"
                  onClick={() => setShowAuthModal(true)}
                  title="Google Sign In & Cloud Sync"
                >
                  <span>{user ? '👤' : '🔐'}</span>
                  <span className="font-medium hidden sm:inline">{user ? user.email?.split('@')[0] : 'Sign In'}</span>
                </button>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={quietMode}
                  onClick={() => {
                    if (!quietMode) voice.disconnectVoiceSession();
                    onQuietModeChange(!quietMode);
                  }}
                  data-testid="quiet-mode-toggle"
                >
                  {quietMode ? 'Quiet mode on' : 'Quiet mode'}
                </button>
              </div>
            </div>

        <ol className="mt-4 flex gap-1.5" aria-label="Progress">
          {(['capture', 'barrier', 'plan', 'timer', 'outcome'] as Step[]).map((s, i) => {
            const order = ['capture', 'barrier', 'plan', 'timer', 'outcome', 'done'];
            const done = order.indexOf(step) >= i;
            return (
              <li
                key={s}
                className="h-1 flex-1 rounded-full"
                style={{ background: done ? '#006A67' : '#E9E6DF' }}
                aria-current={step === s ? 'step' : undefined}
              />
            );
          })}
        </ol>

        {boundaryNote && (
          <p className="notice mt-5" role="note" data-testid="medical-boundary-note">
            {boundaryNote}
          </p>
        )}

        {step === 'capture' && (
          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (taskText.trim()) setStep('barrier');
            }}
          >
            <div className="flex items-center justify-between">
              <label htmlFor="task" className="label">
                Say it out loud, or type it. One task is enough.
              </label>
              <span className="text-[0.78rem] text-ink-3 hidden sm:inline">Press &apos;/&apos; to focus</span>
            </div>
            <textarea
              id="task"
              ref={taskInputRef}
              className="field mt-2 min-h-[96px] resize-y"
              maxLength={280}
              placeholder="Reply to my landlord about the lease renewal"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              data-testid="task-input"
            />
            <div className="mt-3">
              <span className="text-[0.8rem] text-ink-3 block mb-1.5 font-medium">Quick examples:</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Reply to landlord', text: 'Reply to my landlord about the lease renewal date' },
                  { label: 'Sort expense receipts', text: 'Upload three overdue expense receipts to portal' },
                  { label: 'Q4 handover notes', text: 'Outline Q4 project handover notes for team' },
                  { label: 'Desk mail pile', text: 'Sort the mail and document pile on the counter' },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="chip text-[0.82rem] py-1 px-2.5 hover:bg-line transition-colors"
                    onClick={() => {
                      setTaskText(item.text);
                      taskInputRef.current?.focus();
                    }}
                  >
                    + {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={!taskText.trim()} data-testid="task-continue">
                Continue
              </button>
              <span className="meta">{taskText.length}/280</span>
            </div>
          </form>
        )}

        {step === 'barrier' && (
          <div className="mt-6">
            <p className="text-ink-2">Pick the closest one. A rough guess is fine.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label="Barriers">
              {(Object.keys(BARRIER_DEFINITIONS) as BarrierType[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className="chip w-full justify-start py-2.5"
                  aria-pressed={barrier === key}
                  onClick={() => setBarrier(key)}
                  data-testid={`barrier-${key}`}
                >
                  <span>
                    <span className="block font-medium">{BARRIER_DEFINITIONS[key].label}</span>
                    <span className="meta block mt-0.5">{BARRIER_DEFINITIONS[key].shortPrompt}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="btn btn-primary"
                disabled={planLoading}
                onClick={() => requestPlan(barrier)}
                data-testid="get-plan"
              >
                {planLoading ? 'Working it out' : barrier ? 'Shrink it' : "Not sure, you pick"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setStep('capture')}>
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'plan' && plan && (
          <div className="mt-6" data-testid="plan-panel">
            <p className="meta">Task</p>
            <p className="mt-0.5">{plan.taskText}</p>

            <div className="mt-5 rounded-xl border border-line bg-recessed p-4 sm:p-5">
              <p className="meta">Your first step</p>
              <p className="mt-1 text-[1.15rem] leading-snug font-medium" data-testid="plan-first-step">
                {plan.firstStep}
              </p>
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="meta">Barrier</dt>
                <dd className="mt-0.5">{BARRIER_DEFINITIONS[plan.barrierType].label}</dd>
              </div>
              <div>
                <dt className="meta">Strategy</dt>
                <dd className="mt-0.5" data-testid="plan-strategy">{plan.strategyLabel}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="meta">Why this fits</dt>
                <dd className="mt-0.5 text-ink-2">{plan.whyThisFits}</dd>
              </div>
            </dl>

            <fieldset className="mt-6">
              <div className="flex items-center justify-between">
                <legend className="label">Focus block</legend>
                <span className="text-[0.78rem] text-ink-3">Learned preference: {calibration.preferredMinutes}m</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {([5, 10, 15, 20, 25, 30] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="chip tnum"
                    aria-pressed={timerMinutes === m}
                    onClick={() => {
                      setTimerMinutes(m);
                      const updated = addUserTrainingInstruction(`User preferred focus duration: ${m} minutes`);
                      setCalibration(updated);
                    }}
                    data-testid={`timer-option-${m}`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn btn-primary" onClick={() => startTimer(timerMinutes)} data-testid="start-timer">
                Start {timerMinutes}-minute block
              </button>
              <details className="relative">
                <summary className="btn btn-secondary list-none cursor-pointer">Try another strategy</summary>
                <div className="card absolute z-10 mt-2 w-72 p-2">
                  {(Object.keys(STRATEGY_DEFINITIONS) as StrategyKey[])
                    .filter((k) => k !== plan.strategyKey)
                    .map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="btn btn-ghost w-full justify-start text-left"
                        onClick={() => requestPlan(plan.barrierType, k)}
                      >
                        {STRATEGY_DEFINITIONS[k].label}
                      </button>
                    ))}
                </div>
              </details>
              <button type="button" className="btn btn-ghost" onClick={reset}>
                Start over
              </button>
            </div>
          </div>
        )}

        {step === 'timer' && plan && (
          <div className="mt-6 text-center" data-testid="timer-panel">
            <p className="text-ink-2 max-w-[48ch] mx-auto">{plan.firstStep}</p>
            <p className="font-display tnum mt-6 text-[clamp(3.5rem,10vw,5.5rem)] font-semibold leading-none" aria-live="off" data-testid="timer-clock">
              {formatClock(remaining)}
            </p>
            <div className="bar-track mt-6 max-w-sm mx-auto" aria-hidden="true">
              <div className="bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="meta mt-3">
              {proactiveCheckins ? 'Stay will check in when the block ends.' : 'Check-ins are off. You can end any time.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setRunning(false);
                  setStep('outcome');
                }}
                data-testid="end-early"
              >
                End block now
              </button>
              <button
                type="button"
                className="btn btn-ghost text-[0.88rem] text-ink-2"
                onClick={() => setShowStuckRescue(!showStuckRescue)}
                data-testid="im-stuck-btn"
              >
                I&apos;m stuck
              </button>
              {isDemo && (
                <button
                  type="button"
                  className="btn btn-ghost text-[0.85rem] text-accent font-medium"
                  onClick={() => {
                    deadlineRef.current = Date.now() + 2000;
                    setRemaining(2);
                  }}
                  data-testid="fast-forward-timer"
                >
                  ⚡ Fast-forward timer (Demo)
                </button>
              )}
            </div>

            {showStuckRescue && (
              <div className="mt-5 mx-auto max-w-md rounded-xl border border-accent/30 bg-surface-recessed p-4 text-left text-[0.92rem]">
                <p className="font-semibold text-accent">60-second de-escalation</p>
                <p className="mt-1 text-ink leading-relaxed">
                  Take one slow breath. You don&apos;t have to finish or do this well.
                  What is the single smallest physical movement you can make right now?
                  (e.g., place two fingers on the keyboard, or open the document without reading it).
                </p>
                <button
                  type="button"
                  onClick={() => setShowStuckRescue(false)}
                  className="mt-3 text-[0.82rem] font-medium text-accent underline"
                >
                  Back to timer
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'outcome' && plan && (
          <div className="mt-6" data-testid="outcome-panel">
            <p className="text-ink-2">Any answer is useful. Not starting is data, not failure.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {OUTCOME_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  className="chip w-full justify-center py-3"
                  onClick={() => logOutcome(o.key)}
                  data-testid={`outcome-${o.key}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <fieldset className="mt-6">
              <legend className="label">Was the strategy helpful? (optional)</legend>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip tnum w-11 justify-center"
                    aria-pressed={helpful === n}
                    aria-label={`${n} of 5`}
                    onClick={() => setHelpful(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 'done' && (
          <div className="mt-6" data-testid="done-panel">
            <p>
              {lastLogged === 'started' && 'Nice. You got moving.'}
              {lastLogged === 'partly_started' && 'A partial start still counts.'}
              {lastLogged === 'not_started' && "That's okay. Stay will remember what didn't fit."}
              {lastLogged === 'paused_or_stopped' && 'Paused and logged. Pick it up whenever.'}
            </p>
            <p className="meta mt-2">Saved to {isDemo ? 'this sample session only' : 'your history on this device'}.</p>
            <button type="button" className="btn btn-primary mt-5" onClick={reset} data-testid="next-task">
              Another task
            </button>
          </div>
        )}
      </section>

      {/* Voice column */}
      <aside className="card p-5 sm:p-6 flex flex-col" aria-label="Voice companion">
        <Signal state={quietMode ? 'idle' : voice.visualState} energy={voice.audioEnergy} className="mx-auto w-full max-w-[260px]" />

        {/* Real-time NLU comprehension chips (Full-duplex VoiceAgentRAG) */}
        {!quietMode && voice.streamingAnalysis && (voice.partialUserTranscript || voice.visualState === 'listening' || voice.visualState === 'backchannel') && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 animate-fadeIn" data-testid="streaming-analysis-hud">
            {voice.streamingAnalysis.detectedTask && (
              <button
                type="button"
                onClick={() => {
                  if (voice.streamingAnalysis?.detectedTask) {
                    setTaskText(voice.streamingAnalysis.detectedTask);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[0.72rem] font-medium text-accent border border-accent/20 hover:bg-accent/15 transition-colors cursor-pointer text-left"
                title="Click to adopt detected task into workspace"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <span>Task: <strong>{voice.streamingAnalysis.detectedTask}</strong></span>
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-recessed px-2.5 py-1 text-[0.72rem] font-medium text-ink-2 border border-line">
              <span>Barrier: <strong>{BARRIER_DEFINITIONS[voice.streamingAnalysis.detectedBarrier]?.label || voice.streamingAnalysis.detectedBarrier}</strong></span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-[0.72rem] font-medium text-amber-800 dark:text-amber-300 border border-amber-500/20">
              <span>Backchannel: &ldquo;{voice.streamingAnalysis.suggestedBackchannel}&rdquo;</span>
            </span>
          </div>
        )}

        {voiceAvailable ? (
          <div className="mt-4">
            {!voice.isConnected ? (
              <button
                type="button"
                className="btn btn-primary w-full"
                onClick={() => voice.startVoiceSession()}
                disabled={voice.visualState === 'connecting'}
                data-testid="voice-start"
              >
                {voice.visualState === 'connecting' ? 'Connecting' : 'Talk to Stay (Full AGI Live)'}
              </button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface-recessed border border-line text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        voice.isHandsFreePaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'
                      }`}
                    />
                    <span className="font-medium text-ink">
                      {voice.isHandsFreePaused ? 'Listening Paused' : 'Hands-Free Active'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={voice.toggleHandsFreeMute}
                    className="chip py-0.5 px-2 text-[0.75rem]"
                    title={voice.isHandsFreePaused ? 'Resume listening' : 'Pause listening'}
                  >
                    {voice.isHandsFreePaused ? 'Resume ("Hey Stay")' : 'Pause ("Stay pause")'}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary w-full py-1.5 text-xs"
                  onClick={voice.disconnectVoiceSession}
                  data-testid="voice-stop"
                >
                  End voice
                </button>
              </div>
            )}
            <p className="meta mt-2 text-center text-xs">
              Voice commands: &ldquo;Stay pause&rdquo; · &ldquo;Hey Stay&rdquo; · &ldquo;Start 20m&rdquo; · &ldquo;I&apos;m done&rdquo;
            </p>
            {voice.errorMessage && (
              <p className="notice mt-3" role="alert">
                {voice.errorMessage}
              </p>
            )}
          </div>
        ) : (
          <p className="notice mt-4">Quiet mode: text only, no microphone. Everything still works.</p>
        )}

        {actionReceipt && (
          <div className="mt-2 rounded bg-surface-recessed px-3 py-1.5 text-[0.8rem] text-accent font-mono flex items-center justify-between border border-line">
            <span>✓ {actionReceipt}</span>
            <button
              type="button"
              onClick={() => setActionReceipt(null)}
              className="text-ink-3 hover:text-ink font-sans text-xs ml-2"
              aria-label="Dismiss receipt"
            >
              ×
            </button>
          </div>
        )}

        <div className="mt-4 flex-1 flex flex-col min-h-[160px] max-h-[380px] border-t border-line pt-3">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1" aria-live="polite" aria-label="Conversation">
            {voice.transcripts.length === 0 && !voice.partialUserTranscript && (
              <p className="meta text-xs">Captions and typed replies appear here in real time.</p>
            )}
            <ul className="space-y-2.5">
              {voice.transcripts.map((t) => (
                <li
                  key={t.id + t.timestamp}
                  className={`rounded-lg p-2.5 text-[0.88rem] ${
                    t.role === 'user'
                      ? 'bg-surface-recessed ml-4 text-ink'
                      : 'bg-accent/5 border border-accent/15 mr-4 text-ink-2'
                  }`}
                >
                  <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-ink-3 mb-0.5">
                    {t.role === 'user' ? 'You' : 'Stay'}
                  </span>
                  <span>{t.text}</span>
                </li>
              ))}
              {voice.partialUserTranscript && (
                <li className="rounded-lg p-2.5 text-[0.88rem] bg-surface-recessed ml-4 text-muted italic">
                  <div className="flex items-center justify-between">
                    <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-ink-3 mb-0.5">
                      Listening in real time...
                    </span>
                    {voice.streamingAnalysis && (
                      <span className="text-[0.68rem] font-mono text-accent not-italic">
                        {Math.round(voice.streamingAnalysis.confidence * 100)}% match
                      </span>
                    )}
                  </div>
                  <span>{voice.partialUserTranscript}</span>
                  {voice.streamingAnalysis && (
                    <div className="mt-1.5 pt-1.5 border-t border-line/50 flex flex-wrap gap-1 text-[0.7rem] not-italic">
                      <span className="text-ink-3">Understood barrier:</span>
                      <strong className="text-ink font-semibold">
                        {BARRIER_DEFINITIONS[voice.streamingAnalysis.detectedBarrier]?.label}
                      </strong>
                    </div>
                  )}
                </li>
              )}
            </ul>
          </div>

          {/* Integrated continuous text input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!typedMessage.trim()) return;
              const sent = voice.sendUserTextMessage(typedMessage);
              if (!sent && step === 'capture') {
                setTaskText(typedMessage);
                setStep('barrier');
              }
              setTypedMessage('');
            }}
            className="mt-3 flex gap-2 border-t border-line pt-2.5"
          >
            <input
              type="text"
              className="field py-1.5 px-3 text-[0.85rem] flex-1"
              placeholder={voice.isConnected ? "Type reply to agent..." : "Type in session..."}
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              aria-label="Type message in coaching session"
            />
            <button
              type="submit"
              disabled={!typedMessage.trim()}
              className="btn btn-secondary py-1 px-3 text-[0.82rem]"
            >
              Send
            </button>
          </form>
        </div>
      </aside>
    </div>
  )}

      {/* Self-Improvement & Continuous Model Training Modal */}
      {showTrainingPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="training-dialog-title"
        >
          <div className="card w-full max-w-lg p-5 sm:p-6 bg-surface border border-line shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧠</span>
                <div>
                  <h3 id="training-dialog-title" className="font-display font-semibold text-ink text-base">
                    Self-Learning Model & Training
                  </h3>
                  <p className="text-xs text-ink-3">Stay learns your focus patterns and adapts autonomously</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTrainingPanel(false)}
                className="text-ink-3 hover:text-ink text-xl font-medium px-2 py-1"
                aria-label="Close training dialog"
              >
                ✕
              </button>
            </div>

            {/* Current Learned Profile */}
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-surface-recessed p-2.5 border border-line">
                  <span className="text-ink-3 block">Optimal Focus Duration</span>
                  <span className="font-semibold text-accent text-sm">{calibration.preferredMinutes} minutes</span>
                </div>
                <div className="rounded-lg bg-surface-recessed p-2.5 border border-line">
                  <span className="text-ink-3 block">Conversational Persona</span>
                  <span className="font-semibold text-ink text-sm">Warm Body-Double</span>
                </div>
                <div className="rounded-lg bg-surface-recessed p-2.5 border border-line">
                  <span className="text-ink-3 block">Sessions Analyzed</span>
                  <span className="font-semibold text-ink text-sm">{calibration.totalSessionsAnalyzed} logged</span>
                </div>
                <div className="rounded-lg bg-surface-recessed p-2.5 border border-line">
                  <span className="text-ink-3 block">First Step Sizing</span>
                  <span className="font-semibold text-ink text-sm">{calibration.stepGranularity === 'ultra_micro' ? '<60s micro' : '<2 min'}</span>
                </div>
              </div>

              {/* User Training Rules */}
              <div className="mt-4">
                <label htmlFor="user-training-input" className="label text-xs">
                  Train Stay With Your Specific Preferences:
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="user-training-input"
                    type="text"
                    value={trainingInput}
                    onChange={(e) => setTrainingInput(e.target.value)}
                    placeholder="e.g. I work best in 20 min sprints, or Be more casual"
                    className="field py-1.5 px-3 text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!trainingInput.trim()) return;
                      const updated = addUserTrainingInstruction(trainingInput.trim());
                      setCalibration(updated);
                      setTimerMinutes(updated.preferredMinutes);
                      if (voice.isConnected) {
                        voice.injectContext(`User training update: "${trainingInput.trim()}". Update behavior immediately.`);
                      }
                      setTrainingInput('');
                      setActionReceipt('Model updated with your training instruction');
                    }}
                    disabled={!trainingInput.trim()}
                    className="btn btn-primary py-1 px-3 text-xs"
                    data-testid="add-training-rule-btn"
                  >
                    Train
                  </button>
                </div>
              </div>

              {/* Active Instructions List */}
              <div className="mt-3">
                <span className="text-xs font-medium text-ink-3 block mb-1.5">Active Learned Rules:</span>
                <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                  {calibration.userTrainingNotes.map((note, idx) => (
                    <li
                      key={note + idx}
                      className="rounded bg-surface-recessed px-2.5 py-1.5 text-xs text-ink flex items-center justify-between border border-line"
                    >
                      <span>✓ {note}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = removeUserTrainingInstruction(idx);
                          setCalibration(updated);
                        }}
                        className="text-ink-3 hover:text-ink text-xs ml-2"
                        title="Remove instruction"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setShowTrainingPanel(false)}
                className="btn btn-secondary py-1.5 px-4 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Cognitive Memory (AGI) Modal */}
      {showMemoryPanel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-dialog-title"
        >
          <div className="card w-full max-w-lg p-5 sm:p-6 bg-surface border border-line shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧬</span>
                <div>
                  <h3 id="memory-dialog-title" className="font-display font-semibold text-ink text-base">
                    Persistent Cognitive Memory (AGI)
                  </h3>
                  <p className="text-xs text-ink-3">Long-term episodic & contextual memory stored securely in your browser</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMemoryPanel(false)}
                className="text-ink-3 hover:text-ink text-xl font-medium px-2 py-1"
                aria-label="Close memory dialog"
              >
                ✕
              </button>
            </div>

            {/* Profile Overview */}
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-surface-recessed p-2.5 border border-line">
                  <span className="text-ink-3 block">User Name</span>
                  <span className="font-semibold text-accent text-sm">
                    {voice.userMemory.name || 'Learning naturally...'}
                  </span>
                </div>
                <div className="rounded-lg bg-surface-recessed p-2.5 border border-line">
                  <span className="text-ink-3 block">Work / Life Context</span>
                  <span className="font-semibold text-ink text-sm">
                    {voice.userMemory.roleOrField || 'Learning from chats...'}
                  </span>
                </div>
              </div>

              {/* Avoidance Triggers & Strengths */}
              <div className="space-y-2 text-xs">
                <div className="rounded-lg bg-surface-recessed p-2.5 border border-line">
                  <span className="text-ink-3 block font-medium mb-1">Known Avoidance Traps:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {voice.userMemory.coreTriggers.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.72rem] text-amber-800 dark:text-amber-300 border border-amber-500/20"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-surface-recessed p-2.5 border border-line">
                  <span className="text-ink-3 block font-medium mb-1">Known Strengths:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {voice.userMemory.knownStrengths.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.72rem] text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add Memory Fact Form */}
              <div className="mt-4">
                <label htmlFor="user-memory-input" className="label text-xs">
                  Teach Stay A Fact About Yourself:
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="user-memory-input"
                    type="text"
                    value={newMemoryFact}
                    onChange={(e) => setNewMemoryFact(e.target.value)}
                    placeholder="e.g. Call me Sarah, or I get overwhelmed by Slack"
                    className="field py-1.5 px-3 text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newMemoryFact.trim()) return;
                      addUserMemoryFact(newMemoryFact.trim());
                      voice.refreshUserMemory();
                      if (voice.isConnected) {
                        voice.injectContext(
                          `User added new memory fact: "${newMemoryFact.trim()}". Remember this permanently.`
                        );
                      }
                      setNewMemoryFact('');
                      setActionReceipt('Saved new fact to persistent memory');
                    }}
                    disabled={!newMemoryFact.trim()}
                    className="btn btn-primary py-1 px-3 text-xs"
                    data-testid="add-memory-fact-btn"
                  >
                    Remember
                  </button>
                </div>
              </div>

              {/* Stored Facts List */}
              <div className="mt-3">
                <span className="text-xs font-medium text-ink-3 block mb-1.5">
                  Stored Facts & Insights ({voice.userMemory.facts.length}):
                </span>
                <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                  {voice.userMemory.facts.map((fact, idx) => (
                    <li
                      key={fact + idx}
                      className="rounded bg-surface-recessed px-2.5 py-1.5 text-xs text-ink flex items-center justify-between border border-line"
                    >
                      <span>✓ {fact}</span>
                      <button
                        type="button"
                        onClick={() => {
                          removeUserMemoryFact(idx);
                          voice.refreshUserMemory();
                        }}
                        className="text-ink-3 hover:text-ink text-xs ml-2"
                        title="Remove memory fact"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Episodic Sessions History */}
              {voice.userMemory.recentSessionsSummary.length > 0 && (
                <div className="mt-3">
                  <span className="text-xs font-medium text-ink-3 block mb-1.5">Recent Session Breakthroughs:</span>
                  <ul className="space-y-1 max-h-28 overflow-y-auto">
                    {voice.userMemory.recentSessionsSummary.map((item, idx) => (
                      <li
                        key={item.task + idx}
                        className="text-[0.78rem] text-ink-2 bg-surface-recessed/60 px-2 py-1 rounded border border-line/60 flex items-center justify-between"
                      >
                        <span className="truncate max-w-[280px]">{item.task}</span>
                        <span className="font-mono text-accent text-[0.72rem] shrink-0 ml-2">
                          {item.minutes}m · {item.outcome}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-line flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Clear all stored Stay memories?')) {
                    clearAllUserMemories();
                    voice.refreshUserMemory();
                    setActionReceipt('Persistent memories cleared');
                  }
                }}
                className="text-xs text-ink-3 hover:text-red-500 transition-colors"
              >
                Clear all memories
              </button>
              <button
                type="button"
                onClick={() => setShowMemoryPanel(false)}
                className="btn btn-secondary py-1.5 px-4 text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grounding & Box Breathing Panel */}
      {showGroundingPanel && (
        <GroundingPanel
          isOpen={showGroundingPanel}
          onClose={() => setShowGroundingPanel(false)}
        />
      )}

      {/* Google OAuth & Cloud Sync Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </>
  );
}
