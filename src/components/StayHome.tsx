'use client';

/**
 * The Stay app screen: one orb, one line of conversation, one input.
 * Everything else (plan, timer, outcome) appears only when it is needed, and everything can be done by voice.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CareContext, CoachPlanProposal, CoachSessionRecord, SessionOutcome } from '@/types/domain';
import { buildDeterministicCoachPlan } from '@/lib/coach/strategies';
import { computeStrategyStats } from '@/lib/coach/patterns';
import {
  CRISIS_FIXED_MESSAGE,
  detectCrisisSignal,
  detectImpulsiveActionRisk,
  detectSensoryGroundingRequest,
} from '@/lib/safety/crisis';
import { isAgentVerifiedLanguage, useVoiceAgent } from '@/lib/voice/useVoiceAgent';
import { useAssistantHardware } from '@/lib/voice/useAssistantHardware';
import { parseMultiIntentUtterance } from '@/lib/voice/voiceCommands';
import { loadUserCalibration, recordSessionLearning } from '@/lib/coach/selfImprovement';
import { buildMemorySystemPrompt, clearAllUserMemories, recordSessionMemory, removeUserMemoryFact } from '@/lib/coach/userMemory';
import { useOrbShape } from '@/lib/orb/useOrbShape';
import { useCrisisPanel } from '@/components/CrisisHelpPanel';
import { GroundingPanel } from '@/components/GroundingPanel';
import { OrbCognitiveGames } from '@/components/OrbCognitiveGames';
import { Signal } from '@/components/Signal';

type Step = 'idle' | 'plan' | 'timer' | 'outcome' | 'done';

const OUTCOMES: Array<{ key: SessionOutcome; label: string }> = [
  { key: 'started', label: 'I started' },
  { key: 'partly_started', label: 'I partly started' },
  { key: 'not_started', label: "I didn't start" },
  { key: 'paused_or_stopped', label: 'I paused' },
];

const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

function chime() {
  try {
    const ctx = new AudioContext();
    const o = new OscillatorNode(ctx, { type: 'sine', frequency: 660 });
    const g = new GainNode(ctx);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 1.25);
    o.onended = () => void ctx.close();
  } catch {
    // audio unavailable
  }
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function StayHome({
  careContext,
  sessions,
  proactiveCheckins,
  quietMode,
  onQuietModeChange,
  onLogSession,
}: {
  careContext: CareContext;
  sessions: CoachSessionRecord[];
  proactiveCheckins: boolean;
  quietMode: boolean;
  onQuietModeChange: (quiet: boolean) => void;
  onLogSession: (rec: Omit<CoachSessionRecord, 'id' | 'userId' | 'createdAt'>) => Promise<unknown>;
}) {
  const router = useRouter();
  const { openCrisisPanel } = useCrisisPanel();
  const orb = useOrbShape();

  const [step, setStep] = useState<Step>('idle');
  const [input, setInput] = useState('');
  const [plan, setPlan] = useState<CoachPlanProposal | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [minutes, setMinutes] = useState(() => {
    try {
      return loadUserCalibration().preferredMinutes || 20;
    } catch {
      return 20;
    }
  });
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [lastOutcome, setLastOutcome] = useState<SessionOutcome | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'menu' | 'memory' | 'voice'>(null);
  const [grounding, setGrounding] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const deadline = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const strategyHistory = useMemo(
    () => computeStrategyStats(sessions).map((s) => ({ strategyKey: s.strategyKey, attempts: s.attempts, startedCount: s.startedCount + s.partlyStartedCount })),
    [sessions],
  );

  const say = useCallback((text: string) => {
    setReceipt(text);
  }, []);
  useEffect(() => {
    if (!receipt) return;
    const id = window.setTimeout(() => setReceipt(null), 4200);
    return () => window.clearTimeout(id);
  }, [receipt]);

  const triggerCrisis = useCallback(
    (message: string) => {
      setRunning(false);
      openCrisisPanel(message);
    },
    [openCrisisPanel],
  );

  const startTimer = useCallback(
    (m: number) => {
      const valid = Math.max(1, Math.min(60, m));
      setMinutes(valid);
      deadline.current = Date.now() + valid * 60_000;
      setRemaining(valid * 60);
      setElapsed(0);
      setRunning(true);
      setStep('timer');
      say(`Timer started · ${valid} min`);
    },
    [say],
  );

  const logOutcome = useCallback(
    async (outcome: SessionOutcome, rating: number | null = null) => {
      if (!plan) return;
      await onLogSession({
        completedAt: new Date().toISOString(),
        mode: usedVoice ? 'voice' : 'text',
        careContext,
        taskText: plan.taskText,
        barrierType: plan.barrierType,
        strategyKey: plan.strategyKey,
        firstStep: plan.firstStep,
        plannedMinutes: minutes,
        actualSeconds: elapsed || null,
        outcome,
        helpfulRating: rating,
        crisisTriggered: false,
      });
      recordSessionLearning({ strategyKey: plan.strategyKey, outcome, rating, usedMinutes: minutes });
      recordSessionMemory({ task: plan.taskText, outcome, minutes });
      voiceRef.current?.refreshUserMemory();
      setLastOutcome(outcome);
      setRunning(false);
      setStep('done');
      say('Saved on this device');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, onLogSession, usedVoice, careContext, minutes, elapsed, say],
  );

  const voice = useVoiceAgent({
    onPlanProposed: (p) => {
      setPlan(p);
      setMinutes(p.timerMinutes === 0 ? loadUserCalibration().preferredMinutes || 20 : p.timerMinutes);
      setStep('plan');
      say('Plan ready');
    },
    onStartTimerRequested: (m, firstStep) => {
      const valid = m || loadUserCalibration().preferredMinutes || 20;
      setPlan((prev) => (prev ? { ...prev, firstStep, timerMinutes: valid } : buildDeterministicCoachPlan({ taskText: firstStep, careContext, preferredMinutes: valid })));
      startTimer(valid);
    },
    onOutcomeRecorded: (outcome, rating) => void logOutcome(outcome, rating ?? null),
    onCrisisDetected: triggerCrisis,
    onMedicalBoundaryDetected: (m) => setNote(m),
    onShowMemoryRequested: () => setSheet('memory'),
    onShowHistoryRequested: () => router.push('/app/history'),
    onCloseModalsRequested: () => {
      setSheet(null);
      setGrounding(false);
    },
    onNavigateRequested: (path, label) => {
      say(`Opening ${label}`);
      router.push(path);
    },
    onGroundingRequested: () => setGrounding(true),
    onChangeVoiceRequested: (voiceId) => {
      if (voiceId) {
        voiceRef.current?.setSelectedVoice(voiceId);
        say(`Voice: ${voiceId}`);
      } else setSheet('voice');
    },
    onToggleQuietModeRequested: () => {
      if (!quietMode) voiceRef.current?.disconnectVoiceSession();
      onQuietModeChange(!quietMode);
    },
    onShapeRequested: (concept) => orb.request(concept),
    onVoiceCommandDetected: (cmd) => {
      if (!cmd) return;
      if (cmd.type === 'stop_timer') {
        setRunning(false);
        say('Timer stopped');
      } else if (cmd.type === 'change_language') {
        voiceRef.current?.setSelectedLanguage(cmd.langCode);
        say(`Language: ${cmd.langName}`);
      } else if (cmd.type === 'change_voice') {
        voiceRef.current?.setSelectedVoice(cmd.voiceId);
        say(`Voice: ${cmd.voiceId}`);
      } else if (cmd.type === 'break_down') {
        voiceRef.current?.sendUserTextMessage('Can you break this down into an ultra-micro step?');
      }
    },
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    if (voice.isConnected) {
      setUsedVoice(true);
      voice.injectContext(`User care context: ${careContext}. Never give medication advice.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isConnected]);

  useAssistantHardware({
    isConnected: voice.isConnected,
    isHandsFreePaused: voice.isHandsFreePaused,
    keepScreenAwake: running || voice.isConnected,
    onToggleVoice: () => (voice.isConnected ? voice.disconnectVoiceSession() : voice.startVoiceSession()),
    onToggleHandsFreeMute: voice.toggleHandsFreeMute,
    onTriggerGrounding: () => setGrounding(true),
    onStartTimer: (m) => startTimer(m),
  });

  // The orb listens to the conversation: partial speech (instant shapes only) and each finished turn.
  useEffect(() => {
    const t = voice.partialUserTranscript;
    if (!t) return;
    const id = window.setTimeout(() => orb.feed(t, 'partial'), 220);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.partialUserTranscript]);
  const fedUpTo = useRef(0);
  useEffect(() => {
    for (let i = fedUpTo.current; i < voice.transcripts.length; i++) {
      const e = voice.transcripts[i];
      if (e.role === 'user') orb.feed(e.text, 'user');
    }
    fedUpTo.current = voice.transcripts.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.transcripts]);

  // Wall-clock timer: robust to background-tab throttling.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      setElapsed(minutes * 60 - left);
      if (left === 0) {
        setRunning(false);
        setStep('outcome');
        chime();
        if (proactiveCheckins && plan) {
          voice.speakProactively(
            `The user's ${minutes}-minute focus timer just ended. Speak first: in under 20 words, warmly ask whether they got started on "${plan.firstStep}". When they answer, call record_session_outcome.`,
          );
        }
      }
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, minutes, proactiveCheckins, plan]);

  const requestPlan = useCallback(
    async (text: string, preferredStrategy?: CoachPlanProposal['strategyKey']) => {
      const t = text.trim();
      if (!t) return;
      if (detectCrisisSignal(t).triggered) return triggerCrisis(CRISIS_FIXED_MESSAGE);
      setPlanLoading(true);
      setNote(null);
      try {
        const res = await fetch('/api/coach/plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskText: t,
            preferredStrategy,
            careContext,
            preferredMinutes: minutes,
            userMemoryPrompt: buildMemorySystemPrompt(voiceRef.current.userMemory),
            strategyHistory,
          }),
        });
        const data = (await res.json()) as CoachPlanProposal & { error?: string };
        if (!res.ok || data.error) throw new Error(data.error || 'plan failed');
        if (data.safetyFlag === 'crisis') return triggerCrisis(data.spokenResponse);
        if (data.safetyFlag === 'medical_boundary') return setNote(data.spokenResponse);
        setPlan(data);
        setMinutes(data.timerMinutes === 0 ? loadUserCalibration().preferredMinutes || 20 : data.timerMinutes);
        setStep('plan');
        if (!quietMode && data.spokenResponse) voiceRef.current.speakProactively(data.spokenResponse);
      } catch {
        // offline or server error: the deterministic local plan keeps the loop working
        const local = buildDeterministicCoachPlan({ taskText: t, preferredStrategy, careContext, preferredMinutes: minutes, strategyHistory });
        if (local.safetyFlag === 'crisis') return triggerCrisis(local.spokenResponse);
        if (local.safetyFlag === 'medical_boundary') return setNote(local.spokenResponse);
        setPlan(local);
        setMinutes(local.timerMinutes === 0 ? loadUserCalibration().preferredMinutes || 20 : local.timerMinutes);
        setStep('plan');
        if (!quietMode && local.spokenResponse) voiceRef.current.speakProactively(local.spokenResponse);
      } finally {
        setPlanLoading(false);
      }
    },
    [careContext, minutes, strategyHistory, quietMode, triggerCrisis],
  );

  const submit = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) return;
      setInput('');
      orb.feed(t, 'typed');
      if (detectSensoryGroundingRequest(t).triggered) return setGrounding(true);
      const impulse = detectImpulsiveActionRisk(t);
      if (impulse.triggered) return setNote(impulse.message);
      const multi = parseMultiIntentUtterance(t);
      const isGame = multi.commands.some((c) => c.type === 'start_game' || c.type === 'game_action' || c.type === 'set_game_difficulty');
      if (!isGame && (multi.commands.length === 0 || multi.conversationalContext)) void requestPlan(multi.conversationalContext || t);
      voiceRef.current.sendUserTextMessage(t);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestPlan],
  );

  // A task typed on the landing page arrives here once, through sessionStorage (never the URL).
  useEffect(() => {
    try {
      const handed = sessionStorage.getItem('stay_handoff_task');
      if (handed) {
        sessionStorage.removeItem('stay_handoff_task');
        submit(handed);
      }
    } catch {
      // storage blocked: start empty
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleVoice = () => {
    if (quietMode) return say('Voice is off. Turn it on in the menu.');
    if (voice.isConnected) voice.disconnectVoiceSession();
    else void voice.startVoiceSession();
  };

  const reset = () => {
    setStep('idle');
    setPlan(null);
    setLastOutcome(null);
    setNote(null);
    setRunning(false);
    orb.rest();
    inputRef.current?.focus();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const lastAgent = [...voice.transcripts].reverse().find((e) => e.role === 'agent');
  const visual = planLoading ? 'thinking' : voice.visualState;
  const status = voice.errorMessage
    ? voice.errorMessage
    : voice.isHandsFreePaused
      ? 'Paused. Say "Hey Stay" to continue.'
      : voice.isConnected
        ? { idle: 'Listening', connecting: 'Connecting', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking', interrupted: 'Listening', backchannel: 'Listening', saving: 'Saving', complete: 'Done', error: 'Voice unavailable' }[visual]
        : planLoading
          ? 'Thinking'
          : quietMode
            ? 'Type below'
            : 'Tap the orb to talk';
  const caption =
    voice.partialUserTranscript ||
    (planLoading ? '' : step === 'idle' ? lastAgent?.text : '') ||
    (step === 'idle' ? 'What are you putting off?' : '');
  const progress = step === 'timer' ? 1 - remaining / (minutes * 60) : 0;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-xl flex-col items-center justify-between gap-4 pb-2">
      <h1 className="sr-only">Stay</h1>

      <div className="flex w-full flex-1 flex-col items-center">
       <div className="my-auto flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={voice.isConnected ? 'Stop listening' : 'Talk to Stay'}
          aria-pressed={voice.isConnected}
          data-testid="orb-button"
          className="relative aspect-square w-[min(84vw,420px)] rounded-full outline-none focus-visible:ring-4 focus-visible:ring-accent/30"
        >
          <Signal
            state={visual}
            energy={voice.audioEnergy}
            bands={voice.audioBands}
            shape={orb.target}
            thinking={orb.thinking}
            colorTheme={voice.orbColorTheme}
            hideLabel
            className="h-full w-full"
          />
        </button>

        <p className="meta" role="status" aria-live="polite" data-testid="orb-status">
          {status}
        </p>
        {caption && (
          <p className="min-h-[3.5rem] max-w-[24ch] text-center font-display text-[1.6rem] font-medium leading-tight tracking-tight sm:max-w-[28ch] sm:text-[1.9rem]" data-testid="caption">
            {caption}
          </p>
        )}
        {receipt && (
          <p className="rounded-full bg-accent-soft px-3 py-1 text-[0.82rem] font-medium text-accent" role="status">
            {receipt}
          </p>
        )}
       </div>
      </div>

      {note && (
        <div className="notice w-full" role="status" data-testid="note">
          {note}
        </div>
      )}

      {step === 'plan' && plan && (
        <section className="card w-full p-5" aria-label="Your first step" data-testid="plan-card">
          <p className="meta">Your first step</p>
          <p className="mt-1 font-display text-xl font-semibold leading-snug" data-testid="first-step">
            {plan.firstStep}
          </p>
          {plan.whyThisFits && <p className="mt-2 text-ink-2">{plan.whyThisFits}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={() => startTimer(minutes)} data-testid="start-timer">
              Start {minutes} min
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void requestPlan(plan.taskText, 'task_shrinking')}>
              Make it smaller
            </button>
            {[5, 10, 20, 30].map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)}>
                {m}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'timer' && plan && (
        <section className="card w-full p-5 text-center" aria-label="Focus block" data-testid="timer-card">
          <p className="meta">{plan.firstStep}</p>
          <p className="tnum my-2 font-display text-5xl font-semibold" data-testid="clock">
            {clock(remaining)}
          </p>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setRunning(false);
                setStep('outcome');
              }}
              data-testid="stop-timer"
            >
              Stop
            </button>
          </div>
        </section>
      )}

      {step === 'outcome' && plan && (
        <section className="card w-full p-5" aria-label="How did it go?" data-testid="outcome-card">
          <p className="font-display text-lg font-semibold">How did it go?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <button key={o.key} type="button" className="btn btn-secondary" onClick={() => void logOutcome(o.key)} data-testid={`outcome-${o.key}`}>
                {o.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'done' && (
        <section className="card w-full p-5 text-center" aria-label="Logged" data-testid="done-card">
          <p className="font-display text-lg font-semibold">Logged{lastOutcome ? `: ${OUTCOMES.find((o) => o.key === lastOutcome)?.label.toLowerCase()}` : ''}</p>
          <p className="mt-1 text-ink-2">It is saved in this browser. Nothing is judged here.</p>
          <button type="button" className="btn btn-primary mt-3" onClick={reset} data-testid="start-another">
            Start something else
          </button>
        </section>
      )}

      <form
        className="flex w-full items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
      >
        {!quietMode && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={voice.isConnected ? 'Stop listening' : 'Talk to Stay'}
            className="btn btn-secondary h-12 w-12 shrink-0 !p-0"
            data-testid="mic-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {voice.isConnected ? <rect x="6" y="6" width="12" height="12" rx="2" /> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>}
            </svg>
          </button>
        )}
        <input
          ref={inputRef}
          className="field h-12 flex-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What are you avoiding?"
          aria-label="Tell Stay what you're avoiding"
          maxLength={280}
          data-testid="task-input"
        />
        <button type="submit" className="btn btn-primary h-12" disabled={!input.trim()} data-testid="send">
          Send
        </button>
        <button type="button" className="btn btn-ghost h-12 !px-2" onClick={() => setSheet('menu')} aria-label="More" data-testid="menu-button">
          More
        </button>
      </form>

      {sheet === 'menu' && (
        <Sheet title="More" onClose={() => setSheet(null)}>
          <div className="grid gap-2">
            <button type="button" className="btn btn-secondary justify-start" onClick={() => (setSheet(null), setGrounding(true))}>
              Ground me (breathing)
            </button>
            <button type="button" className="btn btn-secondary justify-start" onClick={() => setSheet('voice')}>
              Voice and language
            </button>
            <button type="button" className="btn btn-secondary justify-start" onClick={() => setSheet('memory')}>
              What Stay remembers
            </button>
            <button
              type="button"
              className="btn btn-secondary justify-start"
              onClick={() => {
                if (!quietMode) voice.disconnectVoiceSession();
                onQuietModeChange(!quietMode);
                setSheet(null);
              }}
            >
              {quietMode ? 'Turn voice on' : 'Quiet mode: type only'}
            </button>
            <button type="button" className="btn btn-secondary justify-start" onClick={() => router.push('/app/history')}>
              History
            </button>
          </div>
          <p className="meta mt-4">Everything here also works by voice: &ldquo;ground me&rdquo;, &ldquo;show my memory&rdquo;, &ldquo;switch to Spanish&rdquo;, &ldquo;change voice to Charles&rdquo;.</p>
        </Sheet>
      )}

      {sheet === 'voice' && (
        <Sheet title="Voice and language" onClose={() => setSheet(null)}>
          <p className="label">Voice</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {voice.availableVoices.map((v) => (
              <button key={v.id} type="button" className="chip justify-start" aria-pressed={voice.selectedVoice === v.id} onClick={() => voice.setSelectedVoice(v.id)}>
                <span>
                  <span className="block font-medium">{v.name}</span>
                  <span className="meta block">{v.gender === 'female' ? 'Female' : 'Male'} · {v.accent}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="label mt-5">Language</p>
          <p className="meta mt-1">Auto-detect follows you if you switch mid-sentence. Languages marked * use your browser&apos;s speech recognition (best in Chrome or Edge).</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {voice.supportedLanguages.map((l) => (
              <button key={l.code} type="button" className="chip" aria-pressed={voice.selectedLanguage === l.code} onClick={() => voice.setSelectedLanguage(l.code)}>
                {l.nativeName}
                {l.code !== 'auto' && !isAgentVerifiedLanguage(l.code) ? ' *' : ''}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {sheet === 'memory' && (
        <Sheet title="What Stay remembers" onClose={() => setSheet(null)}>
          <p className="meta">Only what you said or finished. Stored on this device. You can remove anything.</p>
          <ul className="mt-3 space-y-2" data-testid="memory-list">
            {voice.userMemory.name && <li className="rounded-lg bg-recessed p-3">Your name: {voice.userMemory.name}</li>}
            {voice.userMemory.facts.map((f, i) => (
              <li key={`${f}-${i}`} className="flex items-start justify-between gap-2 rounded-lg bg-recessed p-3">
                <span>{f}</span>
                <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => (removeUserMemoryFact(i), voice.refreshUserMemory())} aria-label="Remove">
                  Remove
                </button>
              </li>
            ))}
            {voice.userMemory.recentSessionsSummary.slice(0, 6).map((s) => (
              <li key={s.timestamp} className="rounded-lg bg-recessed p-3">
                {s.task} · {s.outcome.replace('_', ' ')}
              </li>
            ))}
            {!voice.userMemory.name && voice.userMemory.facts.length === 0 && voice.userMemory.recentSessionsSummary.length === 0 && (
              <li className="text-ink-2">Nothing yet. Tell Stay what you are working on and it will remember.</li>
            )}
          </ul>
          <button type="button" className="btn btn-danger mt-4" onClick={() => (clearAllUserMemories(), voice.refreshUserMemory())}>
            Forget everything
          </button>
        </Sheet>
      )}

      {voice.topicShape === 5 && (
        <Sheet title="Game" onClose={() => voice.setTopicShape(0)}>
          <OrbCognitiveGames
            activeGame={voice.activeGame}
            onSelectGame={voice.setActiveGame}
            difficulty={voice.gameDifficulty}
            onSelectDifficulty={voice.setGameDifficulty}
            onSpeak={(t) => voice.speakProactively(t)}
            lastUserUtterance={voice.partialUserTranscript}
            onClose={() => voice.setTopicShape(0)}
          />
        </Sheet>
      )}

      {grounding && <GroundingPanel isOpen={grounding} onClose={() => setGrounding(false)} />}
    </div>
  );
}
