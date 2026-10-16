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
  const [timerMinutes, setTimerMinutes] = useState<5 | 10 | 15>(10);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [helpful, setHelpful] = useState<number | null>(null);
  const [boundaryNote, setBoundaryNote] = useState<string | null>(null);
  const [lastLogged, setLastLogged] = useState<SessionOutcome | null>(null);
  const [usedVoice, setUsedVoice] = useState(false);
  const [showStuckRescue, setShowStuckRescue] = useState(false);
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

  const startTimer = useCallback((minutes: 5 | 10 | 15) => {
    setTimerMinutes(minutes);
    deadlineRef.current = Date.now() + minutes * 60 * 1000;
    setRemaining(minutes * 60);
    setElapsed(0);
    setRunning(true);
    setStep('timer');
    setActionReceipt(`Timer started · ${minutes} min`);
  }, []);

  const logOutcome = useCallback(
    async (outcome: SessionOutcome, rating?: number | null) => {
      if (!plan) return;
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
        helpfulRating: rating ?? helpful,
        crisisTriggered: false,
      });
      setLastLogged(outcome);
      setRunning(false);
      setStep('done');
      setActionReceipt(`Session outcome logged: ${outcome}`);
    },
    [plan, onLogSession, usedVoice, careContext, timerMinutes, elapsed, helpful]
  );

  const voice = useVoiceAgent({
    onPlanProposed: (p) => {
      setTaskText(p.taskText);
      setBarrier(p.barrierType);
      setPlan(p);
      setTimerMinutes(p.timerMinutes === 0 ? 5 : p.timerMinutes);
      setStep('plan');
      setActionReceipt(`Plan ready: ${p.strategyLabel}`);
    },
    onStartTimerRequested: (minutes, firstStep) => {
      setPlan((prev) =>
        prev
          ? { ...prev, firstStep }
          : buildDeterministicCoachPlan({ taskText: firstStep, careContext, preferredMinutes: minutes })
      );
      startTimer(minutes);
    },
    onOutcomeRecorded: (outcome, rating) => {
      void logOutcome(outcome, rating ?? null);
    },
    onCrisisDetected: triggerCrisis,
    onMedicalBoundaryDetected: (m) => setBoundaryNote(m),
  });

  // Seed the agent with care context once connected.
  useEffect(() => {
    if (voice.isConnected) {
      setUsedVoice(true);
      voice.injectContext(
        `User care context: ${careContext}. Adapt tone accordingly. Never give medication advice.` +
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
        setTimerMinutes(data.timerMinutes === 0 ? 5 : data.timerMinutes);
        setActionReceipt(`Plan ready: ${data.strategyLabel}`);
        setStep('plan');
      } catch {
        // Offline / server error: deterministic local plan keeps the loop working.
        const local = buildDeterministicCoachPlan({
          taskText: text,
          barrierType: chosenBarrier ?? undefined,
          preferredStrategy,
          careContext,
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
        setTimerMinutes(local.timerMinutes === 0 ? 5 : local.timerMinutes);
        setStep('plan');
      } finally {
        setPlanLoading(false);
      }
    },
    [taskText, careContext, strategyHistory, triggerCrisis]
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
              <legend className="label">Focus block</legend>
              <div className="mt-2 flex gap-2">
                {([5, 10, 15] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="chip tnum"
                    aria-pressed={timerMinutes === m}
                    onClick={() => setTimerMinutes(m)}
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
                {voice.visualState === 'connecting' ? 'Connecting' : 'Talk to Stay'}
              </button>
            ) : (
              <button type="button" className="btn btn-secondary w-full" onClick={voice.disconnectVoiceSession} data-testid="voice-stop">
                End voice
              </button>
            )}
            <p className="meta mt-2 text-center text-xs">
              Interrupt any time. Audio is streamed ephemerally, never stored.
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
                  <span className="block text-[0.7rem] font-semibold uppercase tracking-wider text-ink-3 mb-0.5">
                    Listening...
                  </span>
                  {voice.partialUserTranscript}
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
  );
}
