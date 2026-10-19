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
import { buildMemorySystemPrompt, loadUserMemory, recordSessionMemory } from '@/lib/coach/userMemory';
import { useOrbShape } from '@/lib/orb/useOrbShape';
import { useOrbPresence } from '@/lib/orb/useOrbPresence';
import { useCrisisPanel } from '@/components/CrisisHelpPanel';
import { GroundingPanel } from '@/components/GroundingPanel';
import { OrbCognitiveGames } from '@/components/OrbCognitiveGames';
import { Signal, hasWebGL } from '@/components/Signal';
import { Sheet } from '@/components/Sheet';
import { BrainDumpSheet } from '@/components/BrainDumpSheet';
import { MemorySheet } from '@/components/MemorySheet';
import { DailyGreetingCard } from '@/components/DailyGreetingCard';
import { buildDailyGreeting, countWinsYesterday, greetingCardDue, greetingSpokenDue, markGreetingDismissed, markGreetingSpoken, openFromBefore, type DailyGreeting, type OptionId } from '@/lib/coach/dailyGreeting';
import { refreshLearnings } from '@/lib/coach/learnings';
import { loadInstructions, styleLine } from '@/lib/coach/customInstructions';
import { runAgenticAction } from '@/lib/voice/agenticActions';
import { TodayCard } from '@/components/TodayCard';
import { RoutineSheet } from '@/components/RoutineSheet';
import { ReminderSheet } from '@/components/ReminderSheet';
import { takeDue } from '@/lib/reminders';
import { showNotification } from '@/lib/reminders';
import { addToday, loadToday, moveToday, toggleToday, type TodayItem } from '@/lib/coach/todayList';
import { byokHeaders } from '@/lib/byok/config';
import { loadParked, unparkThought, type ParkedItem } from '@/lib/coach/parkingLot';

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
      return loadUserCalibration().preferredMinutes || 10;
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
  const [sheet, setSheet] = useState<null | 'menu' | 'memory' | 'voice' | 'parking' | 'dump' | 'routine' | 'remind'>(null);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const routineByVoice = useRef(false);
  const [today, setToday] = useState<TodayItem[]>([]);
  useEffect(() => setToday(loadToday()), []);
  const [parked, setParked] = useState<ParkedItem[]>([]);
  const [grounding, setGrounding] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const [daily, setDaily] = useState<DailyGreeting | null>(null);
  const dailyRef = useRef<DailyGreeting | null>(null);
  dailyRef.current = daily;
  const quietRef = useRef(quietMode);
  quietRef.current = quietMode;
  const deadline = useRef(0);
  const lastNudge = useRef(0);
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
      const valid = Math.max(1, Math.min(120, m));
      setMinutes(valid);
      deadline.current = Date.now() + valid * 60_000;
      setRemaining(valid * 60);
      setElapsed(0);
      lastNudge.current = 0;
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
      setMinutes(p.timerMinutes === 0 ? loadUserCalibration().preferredMinutes || 10 : p.timerMinutes);
      setStep('plan');
      say('Plan ready');
    },
    onStartTimerRequested: (m, firstStep) => {
      const valid = m || loadUserCalibration().preferredMinutes || 10;
      setPlan((prev) => (prev ? { ...prev, firstStep, timerMinutes: valid } : buildDeterministicCoachPlan({ taskText: firstStep, careContext, preferredMinutes: valid })));
      startTimer(valid);
    },
    onOutcomeRecorded: (outcome, rating) => void logOutcome(outcome, rating ?? null),
    onCrisisDetected: triggerCrisis,
    onMedicalBoundaryDetected: (m) => setNote(m),
    onShowMemoryRequested: () => setSheet('memory'),
    onShowParkingRequested: () => (setParked(loadParked()), setSheet('parking')),
    onShowDumpRequested: () => setSheet('dump'),
    onRoutineRequested: (id) => (routineByVoice.current = true, setRoutineId(id), setSheet('routine')),
    onRemindersChanged: () => say('Check-in set'),
    onTodayChanged: () => setToday(loadToday()),
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
    getSessions: () => sessionsRef.current,
    getDailyGreetingSpoken: () => {
      const g = dailyRef.current;
      if (quietRef.current || !g?.spoken || !greetingSpokenDue()) return null;
      markGreetingSpoken(); // spoken once per day, on the first voice session
      return g.spoken;
    },
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

  // what Stay has worked out from your real blocks, re-derived whenever they change (a no-op while learning is off)
  useEffect(() => {
    refreshLearnings(sessions);
  }, [sessions]);

  // the calm first-open-of-the-day card; rebuilt as the day's real data (wins, what was left open) loads in
  useEffect(() => {
    if (!greetingCardDue()) return setDaily(null);
    const now = new Date();
    setDaily(buildDailyGreeting({ now, name: loadUserMemory().name, winsYesterday: countWinsYesterday(today, sessions, now), openFromBefore: openFromBefore(today, now), quiet: quietMode }));
  }, [today, sessions, quietMode]);

  // the orb turns into a person while Stay speaks (or when asked), and back to the topical shape when you talk
  const presence = useOrbPresence({
    topical: orb.target,
    speaking: voice.visualState === 'speaking',
    userTalking: !!voice.partialUserTranscript || voice.visualState === 'interrupted',
  });
  const [canShowFace, setCanShowFace] = useState(false); // the face is drawn in WebGL; without it the button would do nothing
  useEffect(() => setCanShowFace(hasWebGL()), []);

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
      const spent = minutes * 60 - left;
      if (minutes >= 25 && left > 90 && spent - lastNudge.current >= 600 && voiceRef.current.companionMode && voiceRef.current.isConnected) {
        lastNudge.current = spent;
        voiceRef.current.speakProactively('Say one very short, warm line, under eight words, so the user knows you are still here. Ask nothing.');
      }
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

  /** The agentic tools without a voice session: the same code the voice agent calls. */
  const runLocal = useCallback(
    (action: 'plan_day' | 'resume' | 'wrap_up') =>
      runAgenticAction({ action }, {
        now: () => new Date(),
        lastUserSaid: () => '',
        sessions: () => sessionsRef.current,
        startTimer: (m) => startTimer(m),
        proposePlan: (p) => {
          setPlan(p);
          setMinutes(p.timerMinutes || loadUserCalibration().preferredMinutes || 10);
          setStep('plan');
        },
        todayChanged: () => setToday(loadToday()),
        remindersChanged: () => say('Check-in set'),
        note: () => undefined,
      }),
    [startTimer, say],
  );

  const pickGreetingOption = (id: OptionId) => {
    markGreetingDismissed();
    setDaily(null);
    if (id === 'start_small') {
      inputRef.current?.focus();
      say('Type or say one small thing');
    } else if (id === 'dump') {
      setSheet('dump');
      if (voiceRef.current.isConnected) voiceRef.current.startDump();
    } else if (id === 'plan_day') {
      if (voiceRef.current.isConnected) void voiceRef.current.sendUserTextMessage('Plan my day', { skipLocalPlan: true });
      else setNote(String(runLocal('plan_day')?.say ?? ''));
    } else if (id === 'resume') {
      const r = runLocal('resume');
      if (r && r.ok === false) setNote(String(r.say));
    } else if (id === 'wrap') {
      setNote(String(runLocal('wrap_up')?.say ?? ''));
    } else if (id === 'sit_with_me') {
      voiceRef.current.setCompanionMode(true);
      if (!voiceRef.current.isConnected && !quietMode) void voiceRef.current.startVoiceSession();
    }
  };

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
          headers: { 'Content-Type': 'application/json', ...byokHeaders() },
          body: JSON.stringify({
            taskText: t,
            preferredStrategy,
            careContext,
            preferredMinutes: minutes,
            userMemoryPrompt: [styleLine(loadInstructions()), buildMemorySystemPrompt(voiceRef.current.userMemory)].filter(Boolean).join('\n').slice(0, 1990),
            strategyHistory,
          }),
        });
        const data = (await res.json()) as CoachPlanProposal & { error?: string };
        if (!res.ok || data.error) throw new Error(data.error || 'plan failed');
        const keyError = res.headers.get('x-stay-llm-key-error');
        if (keyError) setNote(`Your own key did not work (${keyError.replace('_', ' ')}), so Stay used its shared brain. Check Settings.`);
        if (data.safetyFlag === 'crisis') return triggerCrisis(data.spokenResponse);
        if (data.safetyFlag === 'medical_boundary') return setNote(data.spokenResponse);
        setPlan(data);
        setMinutes(data.timerMinutes === 0 ? loadUserCalibration().preferredMinutes || 10 : data.timerMinutes);
        setStep('plan');
        if (!quietMode && !voiceRef.current.isConnected && data.spokenResponse) voiceRef.current.speakProactively(data.spokenResponse); // a live agent already answers: never a second voice
      } catch {
        // offline or server error: the deterministic local plan keeps the loop working
        const local = buildDeterministicCoachPlan({ taskText: t, preferredStrategy, careContext, preferredMinutes: minutes, strategyHistory });
        if (local.safetyFlag === 'crisis') return triggerCrisis(local.spokenResponse);
        if (local.safetyFlag === 'medical_boundary') return setNote(local.spokenResponse);
        setPlan(local);
        setMinutes(local.timerMinutes === 0 ? loadUserCalibration().preferredMinutes || 10 : local.timerMinutes);
        setStep('plan');
        if (!quietMode && !voiceRef.current.isConnected && local.spokenResponse) voiceRef.current.speakProactively(local.spokenResponse);
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
      voiceRef.current.sendUserTextMessage(t, { skipLocalPlan: true });
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

  // due check-ins: a chime, a note you can read, a spoken nudge if the voice is live, a system notification if allowed
  useEffect(() => {
    const id = window.setInterval(() => {
      for (const r of takeDue()) {
        chime();
        setNote(`Check-in: ${r.text}`);
        showNotification('Stay', r.text);
        if (voiceRef.current.isConnected) voiceRef.current.speakProactively(`Gently remind the person: ${r.text}. Under 12 words, warm, no pressure.`);
      }
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  // restore first: it must read the stored block before the effect below can clear it
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('stay_active_block');
      if (!raw) return;
      const b = JSON.parse(raw) as { plan: CoachPlanProposal; minutes: number; endsAt: number };
      if (!b?.plan || typeof b.endsAt !== 'number' || Date.now() - b.endsAt > 6 * 3_600_000) return window.localStorage.removeItem('stay_active_block');
      setPlan(b.plan);
      setMinutes(b.minutes);
      deadline.current = b.endsAt;
      const left = Math.round((b.endsAt - Date.now()) / 1000);
      if (left > 0) {
        setRemaining(left);
        setElapsed(b.minutes * 60 - left);
        setRunning(true);
        setStep('timer');
        setNote(`Welcome back. Your block is still running, ${Math.max(1, Math.round(left / 60))} min left.`);
      } else {
        setStep('outcome');
        setNote('Your block finished while you were away. How did it go?');
      }
    } catch {
      // unreadable: start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A block survives a reload or a closed tab: save it while it runs (and while its outcome is waiting), clear it otherwise.
  const savedOnce = useRef(false);
  useEffect(() => {
    // the first run is the page loading: leave what is stored for the restore effect above to read
    if (!savedOnce.current) {
      savedOnce.current = true;
      return;
    }
    try {
      if ((step === 'timer' || step === 'outcome') && plan) {
        window.localStorage.setItem('stay_active_block', JSON.stringify({ plan, minutes, endsAt: deadline.current }));
      } else if (step === 'idle' || step === 'plan' || step === 'done') {
        window.localStorage.removeItem('stay_active_block');
      }
    } catch {
      // private mode: not remembered
    }
  }, [step, plan, minutes]);

  // arriving from onboarding or another screen: always start at the top, never mid-scroll
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
          : step === 'timer'
            ? 'Focus block running'
            : quietMode
              ? 'Type below'
              : 'Tap the orb to talk';
  const caption =
    voice.partialUserTranscript ||
    (planLoading ? '' : step === 'idle' ? lastAgent?.text : '') ||
    (step === 'idle' ? 'What are you putting off?' : '');
  const progress = step === 'timer' ? 1 - remaining / (minutes * 60) : 0;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full max-w-xl flex-col items-center justify-between gap-4 pb-2 sm:min-h-[calc(100dvh-9rem)]">
      <h1 className="sr-only">Stay</h1>

      <div className="flex w-full flex-1 flex-col items-center">
       <div className="my-auto flex w-full flex-col items-center gap-3">
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={voice.isConnected ? 'Stop listening' : 'Talk to Stay'}
          aria-pressed={voice.isConnected}
          data-testid="orb-button"
          className="relative aspect-square w-[min(74vw,36dvh,420px)] rounded-full outline-none focus-visible:ring-4 focus-visible:ring-accent/30 sm:w-[min(84vw,420px)]"
        >
          <Signal
            state={visual}
            energy={voice.audioEnergy}
            bands={voice.audioBands}
            shape={presence.target}
            thinking={orb.thinking}
            colorTheme={voice.orbColorTheme}
            hideLabel
            className="h-full w-full"
          />
        </button>

        <p className="meta" role="status" aria-live="polite" data-testid="orb-status">
          {status}
        </p>
        {canShowFace && (
          <button type="button" className="chip" aria-pressed={presence.pinned} aria-label="Show Stay's face" onClick={presence.togglePin} data-testid="face-toggle">
            Face
          </button>
        )}
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
            {[5, 10, 25, 45, 90].map((m) => (
              <button key={m} type="button" className="chip" aria-pressed={minutes === m} onClick={() => setMinutes(m)} aria-label={`${m} minute block`}>
                {m}
              </button>
            ))}
          </div>
          <p className="meta mt-2">Short blocks start easier. Pick a longer one when you are in flow, and Stay sits with you through it.</p>
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                deadline.current += 5 * 60_000;
                setMinutes((m) => m + 5);
                say('Five more minutes');
              }}
              data-testid="plus-five"
            >
              +5 min
            </button>
          </div>
          <button
            type="button"
            className="btn btn-ghost mt-3"
            onClick={() => {
              setRunning(false);
              void requestPlan(plan.taskText, 'task_shrinking');
            }}
            data-testid="too-big"
          >
            Too big? Make it smaller
          </button>
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
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {plan && (
              <button type="button" className="btn btn-primary" onClick={() => startTimer(lastOutcome === 'not_started' ? 5 : Math.min(minutes, 10))} data-testid="another-block">
                {lastOutcome === 'not_started' ? 'Try just 5 min' : `Another ${Math.min(minutes, 10)} min`}
              </button>
            )}
            <button type="button" className={plan ? 'btn btn-secondary' : 'btn btn-primary'} onClick={reset} data-testid="start-another">
              Start something else
            </button>
          </div>
        </section>
      )}

      {step === 'idle' && (
        <div className="flex w-full flex-wrap justify-center gap-2" data-testid="state-chips" role="group" aria-label="Or start from how you feel">
          {['I feel overwhelmed', "I'm stuck", 'I have no energy', "I can't focus"].map((c) => (
            <button key={c} type="button" className="chip" onClick={() => submit(c)}>
              {c}
            </button>
          ))}
          <button type="button" className="chip" onClick={() => setSheet('dump')} data-testid="chip-dump">
            Brain dump
          </button>
          <button type="button" className="chip" onClick={() => (routineByVoice.current = false, setRoutineId(null), setSheet('routine'))} data-testid="chip-routines">
            Routines
          </button>
        </div>
      )}

      {step === 'idle' && daily && (
        <DailyGreetingCard greeting={daily} onPick={pickGreetingOption} onDismiss={() => (markGreetingDismissed(), setDaily(null))} />
      )}

      {(step === 'idle' || step === 'done') && (
        <TodayCard
          items={today}
          onToggle={(id) => {
            setToday(toggleToday(id));
            say('Nice. That is a win.');
            orb.feed('proud achievement', 'typed');
          }}
          onStart={(i) => void requestPlan(i.firstStep ? `${i.text}. First step: ${i.firstStep}` : i.text)}
          onOpenDump={() => setSheet('dump')}
          onMove={(id) => setToday(moveToday(id, 'today'))}
        />
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
          placeholder="Or type it here"
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
            <button type="button" className="btn btn-secondary justify-start" onClick={() => (routineByVoice.current = false, setRoutineId(null), setSheet('routine'))}>
              Routines
            </button>
            <button type="button" className="btn btn-secondary justify-start" onClick={() => setSheet('remind')} data-testid="remind-open">
              Check-ins and reminders
            </button>
            <button type="button" className="btn btn-secondary justify-start" onClick={() => setSheet('memory')}>
              What Stay remembers
            </button>
            <button type="button" className="btn btn-secondary justify-start" onClick={() => (setParked(loadParked()), setSheet('parking'))} data-testid="parking-open">
              Parked thoughts
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
            <button type="button" className="btn btn-secondary justify-start" onClick={() => voice.setCompanionMode(!voice.companionMode)} aria-pressed={voice.companionMode} data-testid="companion-toggle">
              {voice.companionMode ? 'Stay with me all day: on' : 'Stay with me all day: off'}
            </button>
            <button type="button" className="btn btn-secondary justify-start" onClick={() => router.push('/app/history')}>
              History
            </button>
            <button type="button" className="btn btn-secondary justify-start" onClick={() => router.push('/app/settings')}>
              Settings and your own keys
            </button>
          </div>
          <p className="meta mt-4">All-day mode keeps the voice session alive for up to three hours at a time and renews it quietly while this tab stays open. Everything here also works by voice: &ldquo;ground me&rdquo;, &ldquo;show my memory&rdquo;, &ldquo;switch to Spanish&rdquo;, &ldquo;change voice to Charles&rdquo;.</p>
        </Sheet>
      )}

      {sheet === 'voice' && (
        <Sheet title="Voice and language" onClose={() => setSheet(null)}>
          <p className="label">Voice</p>
          <p className="meta mt-1">Say a name to switch, like &ldquo;change voice to Captain Crumpet&rdquo;, or &ldquo;a female American voice&rdquo;. Only the voices marked native have a real Spanish, French, German, Italian or Portuguese accent; the rest are British or American voices with a personality.</p>
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
          <label className="mt-5 flex cursor-pointer items-start gap-3" data-testid="fast-voice-row">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#006A67]" checked={voice.fastVoice} onChange={(e) => voice.setFastVoice(e.target.checked)} data-testid="fast-voice-toggle" />
            <span>
              <span className="label block">Fast voice</span>
              <span className="meta block">On by default. Faster replies, and it waits through your pauses and stops when you talk. The thinking part uses your own key if you added one. Speaks English, Spanish, French, German, Italian and Portuguese; other languages use the standard voice.</span>
            </span>
          </label>
          <p className="label mt-5">Reply speed on this device</p>
          <p className="meta mt-1" data-testid="reply-speed" data-times={voice.replyTimes.join(",")} data-engine={voice.voiceEngine ?? ""}>
            {voice.replyTimes.length === 0
              ? 'Talk to Stay and the real time from the end of your speech to the first sound of its reply shows up here.'
              : `Last ${(voice.replyTimes[voice.replyTimes.length - 1] / 1000).toFixed(1)} s, median ${(([...voice.replyTimes].sort((a, b) => a - b)[Math.floor(voice.replyTimes.length / 2)]) / 1000).toFixed(1)} s over ${voice.replyTimes.length} repl${voice.replyTimes.length === 1 ? 'y' : 'ies'}. Measured here, not a claim.`}
          </p>
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

      {sheet === 'routine' && (
        <RoutineSheet
          initialId={routineId}
          onClose={() => (setSheet(null), setRoutineId(null))}
          onSpeak={(line) => {
            // when the voice agent started the routine it is already announcing the first step
            if (routineByVoice.current) {
              routineByVoice.current = false;
              return;
            }
            if (voiceRef.current.isConnected) voiceRef.current.speakProactively(`Read this step aloud in one short sentence: ${line}`);
          }}
          onComplete={(r) => {
            const l = addToday([{ text: r.name, bucket: 'today' }]);
            setToday(toggleToday(l[0].id));
            say('Routine finished. That is a win.');
            orb.feed('proud achievement', 'typed');
          }}
        />
      )}

      {sheet === 'remind' && <ReminderSheet onClose={() => setSheet(null)} onChanged={() => say('Check-in set')} />}

      {sheet === 'dump' && (
        <BrainDumpSheet
          onClose={() => (setSheet(null), voice.dismissDump())}
          onCrisis={(m) => (setSheet(null), triggerCrisis(m || CRISIS_FIXED_MESSAGE))}
          onSaved={() => setToday(loadToday())}
          live={voice.dump}
          voiceOn={voice.isConnected}
          onTalk={() => voice.startDump()}
          onFinishLive={voice.finishDump}
          onCancelLive={voice.cancelDump}
          onStart={(i) => {
            setSheet(null);
            voice.dismissDump();
            void requestPlan(i.firstStep ? `${i.text}. First step: ${i.firstStep}` : i.text);
          }}
        />
      )}

      {sheet === 'parking' && (
        <Sheet title="Parked thoughts" onClose={() => setSheet(null)}>
          <p className="meta">Things that came up while you were starting something else. Say &ldquo;park it: call the dentist&rdquo; any time. Stored on this device.</p>
          <ul className="mt-3 space-y-2" data-testid="parking-list">
            {parked.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-recessed p-3">
                <span>{p.text}</span>
                <span className="flex shrink-0 gap-1">
                  <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => (setSheet(null), submit(p.text), setParked(unparkThought(p.id)))}>
                    Start this
                  </button>
                  <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={() => setParked(unparkThought(p.id))} aria-label={`Remove ${p.text}`}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
            {parked.length === 0 && <li className="text-ink-2">Nothing parked. Good.</li>}
          </ul>
        </Sheet>
      )}

      {sheet === 'memory' && <MemorySheet memory={voice.userMemory} onChanged={voice.refreshUserMemory} onClose={() => setSheet(null)} />}

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
