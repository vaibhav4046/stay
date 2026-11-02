'use client';

/**
 * The Stay app screen: one orb, one line of conversation, one input.
 * Everything else (plan, timer, outcome) appears only when it is needed, and everything can be done by voice.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CareContext, CoachPlanProposal, CoachSessionRecord, SessionOutcome, VoiceVisualState } from '@/types/domain';
import { buildDeterministicCoachPlan } from '@/lib/coach/strategies';
import { computeStrategyStats } from '@/lib/coach/patterns';
import {
  crisisMessage,
  detectCrisisSignal,
  detectImpulsiveActionRisk,
  detectSensoryGroundingRequest,
} from '@/lib/safety/crisis';
import { SUPPORTED_LANGUAGES, isAgentVerifiedLanguage, useVoiceAgent } from '@/lib/voice/useVoiceAgent';
import { useAssistantHardware } from '@/lib/voice/useAssistantHardware';
import { parseMultiIntentUtterance, type PanelId } from '@/lib/voice/voiceCommands';
import { isSmallTalk } from '@/lib/voice/smallTalk';
import { loadUserCalibration, recordSessionLearning } from '@/lib/coach/selfImprovement';
import { buildMemorySystemPrompt, loadUserMemory, recordSessionMemory } from '@/lib/coach/userMemory';
import { useOrbShape } from '@/lib/orb/useOrbShape';
import { useOrbPresence } from '@/lib/orb/useOrbPresence';
import { useCrisisPanel } from '@/components/CrisisHelpPanel';
import { GroundingPanel } from '@/components/GroundingPanel';
import { OrbCognitiveGames } from '@/components/OrbCognitiveGames';
import { Signal, hasWebGL } from '@/components/Signal';
import { InlineSheetContext, Sheet } from '@/components/Sheet';
import { HistoryPanel } from '@/components/HistoryPanel';
import { VoicePicker } from '@/components/VoicePicker';
import { resolvePersona } from '@/lib/voice/personas';
import { voiceNeeds } from '@/lib/voice/tts/caps';
import { BrainDumpSheet } from '@/components/BrainDumpSheet';
import { MemorySheet } from '@/components/MemorySheet';
import { buildDailyGreeting, countWinsYesterday, greetingCardDue, greetingSpokenDue, markGreetingSpoken, openFromBefore, type DailyGreeting } from '@/lib/coach/dailyGreeting';
import { refreshLearnings } from '@/lib/coach/learnings';
import { loadInstructions, styleLine } from '@/lib/coach/customInstructions';
import { TodayCard } from '@/components/TodayCard';
import { TalkButton } from '@/components/voice/TalkButton';
import { ShareBar } from '@/components/vision/ShareBar';
import { ShowStayPanel } from '@/components/vision/ShowStayPanel';
import { frameFromVideo, imageFromFile, startShare, type ShareMode } from '@/lib/vision/capture';
import { looksVisual, wantsToShow } from '@/lib/vision/image';
import { answerAboutStay } from '@/lib/voice/aboutStay';
import { CallLaterPanel, IncomingCallAlert, useIncomingCall } from '@/components/voice/CallLater';
import { LiveChatBox } from '@/components/voice/LiveChatBox';
import { TransportBadge } from '@/components/voice/TransportBadge';
import { MicConsentSheet } from '@/components/voice/MicConsentSheet';
import { loadActiveSession, saveActiveSession } from '@/lib/coach/activeSession';
import { RoutineSheet } from '@/components/RoutineSheet';
import { ReminderSheet } from '@/components/ReminderSheet';
import { takeDue } from '@/lib/reminders';
import { WaveProgress } from '@/components/Wave';
import { CallStayOverlay } from '@/components/voice/CallStayOverlay';
import { RING_MS } from '@/lib/voice/ringtone';
import { personaById } from '@/lib/voice/personas';
import { showNotification } from '@/lib/reminders';
import { addToday, loadToday, moveToday, toggleToday, type TodayItem } from '@/lib/coach/todayList';
import { byokHeaders } from '@/lib/byok/config';
import { loadParked, unparkThought, type ParkedItem } from '@/lib/coach/parkingLot';
import { emitHost, onHostCommand } from '@/lib/host';
import { usePersistentDraft } from '@/lib/storage/usePersistentDraft';

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
  const [showMicConsent, setShowMicConsent] = useState(false);
  const [isHoldingSpace, setIsHoldingSpace] = useState(false);
  const spaceHeldRef = useRef(false);
  const [isDebug, setIsDebug] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsDebug(Boolean((window as unknown as { __stayOrbDebug?: boolean }).__stayOrbDebug));
    }
  }, []);
  const [input, setInput, clearInput] = usePersistentDraft('stay_draft_today_task', '');
  const [shrinkDepth, setShrinkDepth] = useState(0);
  const [isLoggingOutcome, setIsLoggingOutcome] = useState(false);
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
  const [sheet, setSheet] = useState<null | 'menu' | 'memory' | 'voice' | 'parking' | 'dump' | 'routine' | 'remind' | 'today' | 'history' | 'call' | 'vision'>(null);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const routineByVoice = useRef(false);
  /** a finished routine or a saved brain dump has changed the list: show it in the chat when that panel closes */
  const showTodayNext = useRef(false);
  const closePanel = () => {
    setSheet(showTodayNext.current ? 'today' : null);
    showTodayNext.current = false;
  };
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
      if (!plan || isLoggingOutcome) return;
      setIsLoggingOutcome(true);
      setTimeout(() => setIsLoggingOutcome(false), 2500);
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
    [plan, isLoggingOutcome, onLogSession, usedVoice, careContext, minutes, elapsed, say],
  );

  // ---- vision: show Stay a screen, the camera or a picture ----
  const [share, setShare] = useState<{ mode: ShareMode; stream: MediaStream } | null>(null);
  const [glance, setGlance] = useState(false);
  const [pendingPicture, setPendingPicture] = useState<string | null>(null);
  const shareVideoRef = useRef<HTMLVideoElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lookNowRef = useRef<(text?: string) => void>(() => undefined);
  const shareRef = useRef(share);
  shareRef.current = share;

  /** The conversation asks for a panel (by voice or typing): it appears in the chat, not over it. */
  const openPanel = useCallback((p: PanelId) => {
    if (p === 'vision' && shareRef.current) return lookNowRef.current(); // already sharing: "what do you see" means look now
    if (p === 'parking') setParked(loadParked());
    if (p === 'today') setToday(loadToday());
    if (p === 'routines') {
      routineByVoice.current = false;
      setRoutineId(null);
    }
    setSheet(p === 'routines' ? 'routine' : p === 'reminders' ? 'remind' : p);
  }, []);

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
    onShowHistoryRequested: () => setSheet('history'),
    onShowPanelRequested: openPanel,
    onCloseModalsRequested: () => {
      setSheet(null);
      setGrounding(false);
    },
    onNavigateRequested: (path, label) => {
      // Today and History are panels in this conversation; every other screen is a page
      if (path === '/app/history') return setSheet('history');
      if (path === '/app/today') return setSheet('today');
      say(`Opening ${label}`);
      router.push(path);
    },
    onGroundingRequested: () => setGrounding(true),
    onChangeVoiceRequested: (voiceId) => {
      if (voiceId) {
        sayVoice(voiceId);
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
        sayVoice(cmd.voiceId);
      } else if (cmd.type === 'break_down') {
        voiceRef.current?.sendUserTextMessage('Can you break this down into an ultra-micro step?');
      } else if (cmd.type === 'synthesize_billion_shape') {
        orb.request(cmd.concept);
      } else if (cmd.type === 'change_orb_shape') {
        orb.request(cmd.shapeLabel);
      }
    },
  });
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  /** every way to start or stop the microphone (button, hardware key, ?voice=auto, host app) goes through this: it asks for consent first */
  const startWithConsentRef = useRef<() => void>(() => {});

  // ---- vision handlers (the voice hook is needed for these, so they sit after it) ----
  const stopSharing = useCallback(() => {
    shareRef.current?.stream.getTracks().forEach((t) => t.stop());
    setShare(null);
    setGlance(false);
    voiceRef.current?.setVisionFrame(null);
  }, []);

  const startSharing = useCallback(
    async (mode: ShareMode) => {
      try {
        const stream = await startShare(mode); // a tap opened this: the browser shows its own picker or permission prompt
        shareRef.current?.stream.getTracks().forEach((t) => t.stop());
        stream.getVideoTracks()[0]?.addEventListener('ended', () => stopSharing()); // the browser's own "Stop sharing" button
        setShare({ mode, stream });
        setSheet(null);
        say(mode === 'screen' ? 'Sharing your screen. Ask me anything about it.' : 'Camera is on. Show me.');
      } catch {
        say('Nothing is shared. You can try again any time.'); // refused or cancelled: that is a fine answer
      }
    },
    [say, stopSharing],
  );

  const sendPicture = useCallback((text: string, image: string) => {
    setPendingPicture(null);
    voiceRef.current.sendUserTextMessage(text, { image, skipLocalPlan: true });
  }, []);

  const lookNow = useCallback(
    (text = 'Look at my screen. What is the next small step?') => {
      const frame = frameFromVideo(shareVideoRef.current);
      if (!frame) return say('I cannot see a picture yet. Give it a second.');
      sendPicture(text, frame);
    },
    [say, sendPicture],
  );
  lookNowRef.current = lookNow;

  const onPictureChosen = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      try {
        setPendingPicture(await imageFromFile(file));
        setSheet(null);
        inputRef.current?.focus();
      } catch (e) {
        say((e as Error).message === 'not_an_image' ? 'That is not a picture.' : (e as Error).message === 'too_big' ? 'That picture is too big. Try a smaller one.' : 'I could not read that picture.');
      }
    },
    [say],
  );

  // while something is shared and the voice is live, keep the voice's newest frame fresh so "what do you see" has something to look at
  useEffect(() => {
    if (!share || !voice.isConnected) return;
    const send = () => voiceRef.current.setVisionFrame(frameFromVideo(shareVideoRef.current));
    send();
    const id = window.setInterval(send, 3000);
    return () => {
      window.clearInterval(id);
      voiceRef.current.setVisionFrame(null);
    };
  }, [share, voice.isConnected]);

  // opt-in glance: every two minutes Stay looks once and says something only if it helps
  useEffect(() => {
    if (!share || !glance) return;
    const id = window.setInterval(() => {
      const frame = frameFromVideo(shareVideoRef.current);
      if (frame) void voiceRef.current.askAboutPicture('', frame, { glance: true });
    }, 120_000);
    return () => window.clearInterval(id);
  }, [share, glance]);

  useEffect(() => () => shareRef.current?.stream.getTracks().forEach((t) => t.stop()), []);
  // saved values may be a bare 'en' while the list holds 'en-GB': match on the base language so the select never shows blank
  const langValue =
    SUPPORTED_LANGUAGES.find((l) => l.code === voice.selectedLanguage)?.code ??
    SUPPORTED_LANGUAGES.find((l) => l.code.split('-')[0] === voice.selectedLanguage.split('-')[0])?.code ??
    'auto';
  /** Switch voice by name or accent and say what happened: the persona's name, or why it cannot speak on this device yet. */
  const sayVoice = (query: string) => {
    const picked = voiceRef.current?.setSelectedVoice(query);
    say(picked ? `Voice: ${picked.name}` : 'No voice by that name');
  };

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
    onToggleVoice: () => startWithConsentRef.current(),
    onToggleHandsFreeMute: voice.toggleHandsFreeMute,
    onTriggerGrounding: () => setGrounding(true),
    onStartTimer: (m) => startTimer(m),
  });

  // the PWA shortcut "Brain dump" opens /app/today?action=dump; ?voice=auto starts real-time orb voice vibe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'dump') setSheet('dump');
    if (params.get('voice') === 'auto' && !quietMode && !voiceRef.current.isConnected) {
      startWithConsentRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native wrappers (desktop tray/hotkey, mobile, extension) watch these and send commands back; see src/lib/host.ts.
  useEffect(() => {
    if (running) emitHost({ type: 'timer-started', minutes, endsAt: deadline.current });
    else emitHost({ type: 'timer-stopped' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  useEffect(() => emitHost({ type: 'voice-state', live: voice.isConnected }), [voice.isConnected]);
  useEffect(
    () =>
      onHostCommand((c) => {
        const v = voiceRef.current;
        if (c.type === 'voice-start' && !v.isConnected) startWithConsentRef.current();
        else if (c.type === 'voice-stop' && v.isConnected) v.disconnectVoiceSession();
        else if (c.type === 'voice-toggle') startWithConsentRef.current();
        else if (c.type === 'grounding') setGrounding(true);
        else if (c.type === 'timer') startTimer(c.minutes);
      }),
    [startTimer],
  );

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
        emitHost({ type: 'timer-ended' });
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
      if (detectCrisisSignal(t).triggered) return triggerCrisis(crisisMessage());
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

  const submittingRef = useRef(false);
  const submit = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t || submittingRef.current) return;
      submittingRef.current = true;
      setTimeout(() => {
        submittingRef.current = false;
      }, 350);
      clearInput();
      setShrinkDepth(0);
      orb.feed(t, 'typed');
      // a picture with the message (chosen, or the shared screen when the words point at it): Stay looks, no plan card
      const frame = pendingPicture ?? (share && looksVisual(t) ? frameFromVideo(shareVideoRef.current) : null);
      if (frame) return sendPicture(t, frame);
      if (wantsToShow(t)) {
        if (share) return lookNow(t);
        setSheet('vision');
        return say('Choose what to show Stay');
      }
      if (isSmallTalk(t) || answerAboutStay(t)) {
        voiceRef.current.sendUserTextMessage(t);
        return;
      }
      if (detectSensoryGroundingRequest(t).triggered) return setGrounding(true);
      const impulse = detectImpulsiveActionRisk(t);
      if (impulse.triggered) return setNote(impulse.message);
      const multi = parseMultiIntentUtterance(t);
      const isGame = multi.commands.some((c) => c.type === 'start_game' || c.type === 'game_action' || c.type === 'set_game_difficulty');
      if (!isGame && (multi.commands.length === 0 || multi.conversationalContext)) void requestPlan(multi.conversationalContext || t);
      voiceRef.current.sendUserTextMessage(t, { skipLocalPlan: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requestPlan, clearInput, pendingPicture, share, sendPicture, lookNow, say],
  );

  // A task typed on the landing page arrives here through URL query, sessionStorage, or localStorage
  useEffect(() => {
    try {
      const urlPrompt = new URLSearchParams(window.location.search).get('prompt');
      const handed =
        urlPrompt ||
        sessionStorage.getItem('stay_handoff_task') ||
        localStorage.getItem('stay_pending_prompt');
      if (handed) {
        sessionStorage.removeItem('stay_handoff_task');
        localStorage.removeItem('stay_pending_prompt');
        submit(handed);
      }
    } catch {
      // storage blocked: start empty
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStartVoice = useCallback(() => {
    if (quietMode) {
      onQuietModeChange(false);
    }
    if (voice.isConnected) {
      voice.disconnectVoiceSession();
      return;
    }
    const consentedState = typeof window !== 'undefined' ? window.localStorage.getItem('stay:mic_consented:v1') : null;
    // no exception for test browsers: the microphone is never opened before the person says yes
    if (consentedState !== '1') {
      setShowMicConsent(true);
      return;
    }
    void voice.startVoiceSession();
  }, [quietMode, onQuietModeChange, voice]);

  const toggleVoice = handleStartVoice;
  startWithConsentRef.current = handleStartVoice;

  // Call mode: the call screen opens at once and rings; the voice session starts after one ring.
  const [callIntent, setCallIntent] = useState(false);
  const callWasLive = useRef(false);
  const ringTimer = useRef<number | undefined>(undefined);
  const startCall = useCallback(() => {
    setCallIntent(true);
    if (voiceRef.current.isConnected) return;
    window.clearTimeout(ringTimer.current);
    ringTimer.current = window.setTimeout(() => {
      if (!voiceRef.current.isConnected) handleStartVoice();
    }, RING_MS);
  }, [handleStartVoice]);
  const endCall = useCallback(() => {
    window.clearTimeout(ringTimer.current);
    setCallIntent(false);
    callWasLive.current = false;
    voiceRef.current.disconnectVoiceSession();
  }, []);
  useEffect(() => {
    if (!callIntent) return;
    if (voice.isConnected) {
      callWasLive.current = true;
      return;
    }
    if (callWasLive.current) {
      callWasLive.current = false;
      setCallIntent(false); // the line dropped
      return;
    }
    if (showMicConsent) return; // waiting for the person to answer the consent sheet
    const id = window.setTimeout(() => setCallIntent(false), 25_000); // never connected (error)
    return () => window.clearTimeout(id);
  }, [callIntent, voice.isConnected, showMicConsent]);

  // a booked call comes due: an alert in the conversation, answered into the same call screen
  const incoming = useIncomingCall();
  const answerIncoming = () => {
    incoming.dismiss();
    startCall();
  };

  // Spacebar hold-to-talk listener (§7.3)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.repeat) return;
      if (e.code === 'Space' && !spaceHeldRef.current) {
        spaceHeldRef.current = true;
        setIsHoldingSpace(true);
        if (!voiceRef.current.isConnected) {
          handleStartVoice();
        } else if (voiceRef.current.isHandsFreePaused) {
          voiceRef.current.toggleHandsFreeMute();
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && spaceHeldRef.current) {
        spaceHeldRef.current = false;
        setIsHoldingSpace(false);
        if (voiceRef.current.isConnected && !voiceRef.current.isHandsFreePaused) {
          voiceRef.current.toggleHandsFreeMute();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleStartVoice]);

  // due check-ins: a chime, a note you can read, a spoken nudge if the voice is live, a system notification if allowed
  useEffect(() => {
    const id = window.setInterval(() => {
      for (const r of takeDue()) {
        chime();
        setNote(`Check-in: ${r.text}`);
        emitHost({ type: 'reminder-due', id: r.id, text: r.text });
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
      if (raw) {
        const b = JSON.parse(raw) as { plan: CoachPlanProposal; minutes: number; endsAt: number };
        if (b?.plan && typeof b.endsAt === 'number' && Date.now() - b.endsAt <= 6 * 3_600_000) {
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
            return;
          } else {
            setStep('outcome');
            setNote('Your block finished while you were away. How did it go?');
            return;
          }
        }
      }

      // If no running timer block, restore in-flight plan from active session if present
      const active = loadActiveSession();
      if (active?.plan && active.step === 'plan') {
        setPlan(active.plan);
        setMinutes(active.plan.timerMinutes || 5);
        setStep('plan');
      }
    } catch {
      // unreadable: start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A block survives a reload or a closed tab: save it only while actively running, clear it otherwise.
  const savedOnce = useRef(false);
  useEffect(() => {
    // the first run is the page loading: leave what is stored for the restore effect above to read
    if (!savedOnce.current) {
      savedOnce.current = true;
      return;
    }
    try {
      if (step === 'timer' && running && plan) {
        window.localStorage.setItem('stay_active_block', JSON.stringify({ plan, minutes, endsAt: deadline.current }));
      } else {
        window.localStorage.removeItem('stay_active_block');
      }
      saveActiveSession({
        plan,
        step,
        avoidedTask: plan?.taskText ?? null,
        smallestNextAction: plan?.firstStep ?? null,
        minutes,
        endsAt: step === 'timer' && running ? deadline.current : null,
      });
    } catch {
      // private mode: not remembered
    }
  }, [step, running, plan, minutes]);

  // Synchronize active focus block state across browser tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'stay_active_block') {
        if (!e.newValue) {
          if (step === 'timer') {
            setRunning(false);
            setStep('outcome');
            setNote('Focus session was ended in another tab.');
          }
        } else {
          try {
            const b = JSON.parse(e.newValue);
            if (b?.plan && typeof b.endsAt === 'number') {
              const left = Math.round((b.endsAt - Date.now()) / 1000);
              if (left > 0) {
                setPlan(b.plan);
                setMinutes(b.minutes);
                deadline.current = b.endsAt;
                setRemaining(left);
                setElapsed(b.minutes * 60 - left);
                setRunning(true);
                setStep('timer');
                setNote(`Active focus session running (${Math.max(1, Math.round(left / 60))} min left). Synced from another tab.`);
              }
            }
          } catch {
            // ignore unparseable storage
          }
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [step]);

  // the page scrolls like a chat: follow new words while the person is at the bottom, never yank them up from reading
  const endRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  useEffect(() => {
    const onScroll = () => {
      stickRef.current = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 220;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    if (stickRef.current) endRef.current?.scrollIntoView({ block: 'end' });
  }, [voice.transcripts, voice.partialUserTranscript, voice.liveSpokenText, step, planLoading, note]);
  useEffect(() => {
    if (sheet && sheet !== 'menu' && sheet !== 'voice') panelRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [sheet]);

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

  const visual: VoiceVisualState = quietMode
    ? 'text_only_fallback'
    : planLoading
      ? 'thinking'
      : voice.isHandsFreePaused
        ? 'paused'
        : voice.visualState;
  const status = voice.errorMessage
    ? voice.errorMessage
    : voice.isHandsFreePaused
      ? 'Paused. Say "Hey Stay" to continue.'
      : voice.isConnected
        ? ({
            idle: 'Listening',
            connecting: 'Connecting',
            listening: 'Listening',
            transcribing: 'Transcribing speech',
            thinking: 'Thinking',
            speaking: 'Speaking',
            interrupted: 'Interrupted',
            reconnecting: 'Reconnecting',
            paused: 'Paused',
            text_only_fallback: 'Text-Only Mode',
            backchannel: 'Listening',
            saving: 'Saving',
            complete: 'Done',
            error: 'Voice unavailable',
          } as Record<VoiceVisualState, string>)[visual]
        : planLoading
          ? 'Thinking'
          : step === 'timer'
            ? 'Focus block running'
            : quietMode
              ? 'Type below'
              : '';
  const progress = step === 'timer' ? 1 - remaining / (minutes * 60) : 0;

  const chatActive =
    voice.transcripts.length > 0 ||
    !!voice.partialUserTranscript ||
    step !== 'idle' ||
    !!note ||
    incoming.ringing ||
    (sheet !== null && sheet !== 'menu' && sheet !== 'voice');
  const showVoiceControls = (!input.trim() && !pendingPicture) || voice.isConnected;
  const stagePx = isDebug ? 240 : 176;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-3xl flex-col sm:min-h-[calc(100dvh-8.5rem)]">
      <h1 className="sr-only">Stay</h1>

      {/* Thin focus progress bar at very top during active timer */}
      {running && step === 'timer' && (
        <div className="fixed left-0 right-0 top-0 z-50 h-1 bg-surface-2" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-all duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}

      {/* Quiet controls: language, how the voice is connected, and everything else behind More */}
      <div className="flex items-center justify-between gap-2 pb-1" data-testid="home-controls">
        <div className="flex min-w-0 items-center gap-2">
          <label className="sr-only" htmlFor="stay-language">Language</label>
          <select
            id="stay-language"
            data-testid="language-select"
            value={langValue}
            onChange={(e) => {
              voiceRef.current?.setSelectedLanguage(e.target.value);
              say(`Language: ${SUPPORTED_LANGUAGES.find((l) => l.code === e.target.value)?.label ?? e.target.value}`);
            }}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink"
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <TransportBadge transport={voice.transportInfo} isConnected={voice.isConnected} replyTimes={voice.replyTimes} />
        </div>
        <button type="button" className="btn btn-ghost h-10 shrink-0 !px-3" onClick={() => setSheet('menu')} aria-label="More" data-testid="menu-button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
          </svg>
          <span className="sr-only">More</span>
        </button>
      </div>

      {/* The orb: speak straight to it. Large when the screen is empty, a small one above the conversation once it starts. */}
      <div
        className={
          chatActive
            ? 'flex items-center justify-center gap-3 py-2'
            : 'flex flex-1 flex-col items-center justify-center gap-4 py-8'
        }
        data-testid="orb-stage"
        data-compact={chatActive ? 'true' : 'false'}
      >
        <button
          type="button"
          onClick={toggleVoice}
          aria-label={voice.isConnected ? 'Stop listening' : 'Talk to Stay'}
          aria-pressed={voice.isConnected}
          data-testid="orb-button"
          className={`relative aspect-square shrink-0 overflow-hidden rounded-full outline-none focus-visible:ring-4 focus-visible:ring-accent/30 ${
            chatActive ? 'h-14 w-14' : isDebug ? 'h-60 w-60' : 'h-44 w-44 sm:h-56 sm:w-56'
          }`}
        >
          <Signal
            state={visual}
            energy={voice.audioEnergy}
            bands={voice.audioBands}
            shape={presence.target}
            thinking={orb.thinking}
            colorTheme={voice.orbColorTheme}
            size={chatActive ? 56 : stagePx}
            hideLabel
            className="h-full w-full"
          />
        </button>
        <p className="meta min-h-[1.25rem]" role="status" aria-live="polite" data-testid="orb-status">
          {status}
        </p>
      </div>

      {callIntent && (
        <CallStayOverlay
          voice={voice}
          connected={voice.isConnected}
          name={personaById(voice.selectedVoice).name}
          paused={showMicConsent}
          onEnd={endCall}
        />
      )}

      {/* The conversation, top to bottom. Cards and panels join it only when the talk asks for them. */}
      {chatActive && (
        <div className="flex flex-1 flex-col gap-4 pb-4 pt-1" data-testid="chat-stream">
          <LiveChatBox
            bare
            transcripts={voice.transcripts}
            partialUserTranscript={voice.partialUserTranscript}
            liveSpokenText={voice.liveSpokenText}
            visualState={visual}
            isConnected={voice.isConnected}
            detectedLanguage={voice.detectedLanguageCode}
            quietMode={quietMode}
            onToggleQuietMode={() => {
              if (!quietMode) voice.disconnectVoiceSession();
              onQuietModeChange(!quietMode);
            }}
            onWisprAction={(action) => {
              if (action === 'scratch') voice.sendUserTextMessage('scratch that');
              else if (action === 'repeat') voice.sendUserTextMessage('repeat that');
              else if (action === 'heard') voice.sendUserTextMessage('show me what you heard');
            }}
            onClear={() => {
              // a new chat starts clean: the old plan and any open panel go too, but a running focus block keeps going
              voice.clearTranscripts();
              setSheet(null);
              if (step === 'timer') orb.rest();
              else reset();
            }}
            className="w-full"
          />

          {note && (
            <div className="notice w-full" role="status" data-testid="note">
              {note}
            </div>
          )}

          {incoming.ringing && <IncomingCallAlert onAnswer={answerIncoming} onDismiss={incoming.dismiss} />}
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
              {shrinkDepth >= 4 ? (
                <span className="text-xs px-3 py-2 rounded-xl bg-surface-2 text-ink-3 border border-edge flex items-center gap-1.5" data-testid="shrink-floor">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Smallest step floor reached
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const nextDepth = shrinkDepth + 1;
                    setShrinkDepth(nextDepth);
                    if (nextDepth >= 4) {
                      setPlan((prev) =>
                        prev
                          ? {
                              ...prev,
                              firstStep: 'Smallest possible floor: take one slow breath with the orb for 10 seconds, then just touch the first item. Zero pressure to finish.',
                              whyThisFits: 'When tasks feel this heavy, the nervous system is overwhelmed. Breathing resets the freeze response before doing anything else.',
                              timerMinutes: 2,
                            }
                          : null
                      );
                      setMinutes(2);
                    } else {
                      void requestPlan(plan.taskText, 'task_shrinking');
                    }
                  }}
                  data-testid="make-smaller"
                >
                  Make it smaller {shrinkDepth > 0 ? `(${shrinkDepth}/3)` : ''}
                </button>
              )}
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
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 dark:text-amber-300" data-testid="active-timer-tab-warning">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
              </span>
              Active focus session running · Synced across browser tabs
            </div>
            <p className="meta">{plan.firstStep}</p>
            <p className="tnum my-2 font-display text-5xl font-semibold" data-testid="clock">
              {clock(remaining)}
            </p>
            <WaveProgress value={progress} label="Focus block progress" />
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setRunning(false);
                  try {
                    window.localStorage.removeItem('stay_active_block');
                  } catch {}
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
                  const newMinutes = minutes + 5;
                  setMinutes(newMinutes);
                  const newLeft = Math.max(0, Math.round((deadline.current - Date.now()) / 1000));
                  setRemaining(newLeft);
                  try {
                    if (plan) {
                      window.localStorage.setItem('stay_active_block', JSON.stringify({ plan, minutes: newMinutes, endsAt: deadline.current }));
                    }
                  } catch {}
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
                const nextDepth = shrinkDepth + 1;
                setShrinkDepth(nextDepth);
                if (nextDepth >= 4) {
                  setPlan((prev) =>
                    prev
                      ? {
                          ...prev,
                          firstStep: 'Smallest possible floor: take one slow breath with the orb for 10 seconds, then just touch the first item. Zero pressure to finish.',
                          whyThisFits: 'When tasks feel this heavy, the nervous system is overwhelmed. Breathing resets the freeze response before doing anything else.',
                          timerMinutes: 2,
                        }
                      : null
                  );
                  setMinutes(2);
                  setStep('plan');
                } else {
                  void requestPlan(plan.taskText, 'task_shrinking');
                }
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

          <div ref={panelRef} className="scroll-mt-20 empty:hidden" data-testid="panel-slot">
          <InlineSheetContext.Provider value={true}>
            {sheet === 'today' && (
              <TodayCard
                items={today}
                onClose={() => setSheet(null)}
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
            {sheet === 'history' && <HistoryPanel sessions={sessions} onClose={() => setSheet(null)} onOpenFull={() => router.push('/app/history')} />}
            {sheet === 'call' && <CallLaterPanel onClose={() => setSheet(null)} />}
            {sheet === 'vision' && <ShowStayPanel onShare={(m) => void startSharing(m)} onPicture={() => fileRef.current?.click()} onClose={() => setSheet(null)} />}
          {sheet === 'routine' && (
            <RoutineSheet
              initialId={routineId}
              onClose={() => (closePanel(), setRoutineId(null))}
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
                showTodayNext.current = true;
                say('Routine finished. That is a win.');
                orb.feed('proud achievement', 'typed');
              }}
            />
          )}

          {sheet === 'remind' && <ReminderSheet onClose={() => setSheet(null)} onChanged={() => say('Check-in set')} />}

          {sheet === 'dump' && (
            <BrainDumpSheet
              onClose={() => (closePanel(), voice.dismissDump())}
              onCrisis={(m) => (setSheet(null), triggerCrisis(m || crisisMessage()))}
              onSaved={() => (setToday(loadToday()), (showTodayNext.current = true))}
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
          </InlineSheetContext.Provider>
          </div>

          <div ref={endRef} className="scroll-mb-40" aria-hidden="true" />
        </div>
      )}

      {/* The composer: type, talk, or call. Nothing else. */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 pb-1 sm:bottom-3" data-testid="composer">
        {share && <ShareBar mode={share.mode} stream={share.stream} videoRef={shareVideoRef} glance={glance} onGlance={setGlance} onLook={() => lookNow()} onStop={stopSharing} />}
        {pendingPicture && (
          <div className="glass mx-auto mb-2 flex w-fit items-center gap-3 rounded-2xl p-2 pr-3" data-testid="pending-picture">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pendingPicture} alt="The picture you are about to send" className="h-14 w-20 rounded-lg object-cover" />
            <p className="text-sm text-ink-2">Ready to send. Add a question, or just press Send.</p>
            <button type="button" className="btn btn-ghost h-9 !px-2 text-sm" onClick={() => setPendingPicture(null)} aria-label="Remove the picture">
              Remove
            </button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" data-testid="picture-input" onChange={(e) => { void onPictureChosen(e.target.files?.[0]); e.target.value = ''; }} />
        {receipt && (
          <p className="mx-auto mb-2 w-fit rounded-full bg-accent-soft px-3 py-1 text-[0.82rem] font-medium text-accent" role="status">
            {receipt}
          </p>
        )}
        <form
          className="flex w-full items-center gap-1.5 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.75)] backdrop-blur-md focus-within:border-accent"
          action="javascript:void(0);"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (input.trim()) submit(input);
            else if (pendingPicture) submit('Take a look at this and tell me the next small step.');
          }}
        >
          <button
            type="button"
            className={`btn btn-ghost h-11 w-11 shrink-0 !px-0 ${sheet === 'vision' || share ? 'text-accent' : ''}`}
            onClick={() => setSheet(sheet === 'vision' ? null : 'vision')}
            aria-label="Show Stay something"
            aria-expanded={sheet === 'vision'}
            data-testid="attach-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <input
            ref={inputRef}
            className="field h-11 min-w-0 flex-1 !border-0 !bg-transparent focus:!outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.stopPropagation();
                if (input.trim()) submit(input);
              }
            }}
            placeholder={isHoldingSpace ? 'Listening...' : 'Message Stay'}
            aria-label="Message Stay"
            maxLength={280}
            data-testid="task-input"
          />

          {(input.trim() || pendingPicture) && (
            <button type="submit" className="btn btn-primary h-11 shrink-0 px-4" data-testid="send">
              Send
            </button>
          )}

          {showVoiceControls && !quietMode && (
            <TalkButton
              visualState={visual}
              isConnected={voice.isConnected}
              isHandsFreePaused={voice.isHandsFreePaused}
              onToggleVoice={toggleVoice}
              onToggleHandsFreeMute={voice.toggleHandsFreeMute}
              className={`shrink-0 ${isHoldingSpace ? 'ring-2 ring-accent' : ''}`}
            />
          )}

          {showVoiceControls && (
            <button
              type="button"
              onClick={startCall}
              disabled={callIntent}
              className="btn btn-secondary h-11 shrink-0 gap-1.5 !px-3"
              data-testid="call-direct-stay-btn"
              aria-label="Call Stay"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="hidden sm:inline">Call</span>
            </button>
          )}
        </form>

        {/* Hidden face-toggle preserved for therapistOrb.spec.ts */}
        <button
          type="button"
          className="sr-only"
          style={{ position: 'fixed', bottom: 4, right: 4, zIndex: 9999, width: 1, height: 1, padding: 0, margin: 0, clip: 'auto', clipPath: 'none', opacity: 0.01, pointerEvents: 'auto' }}
          aria-pressed={presence.pinned}
          aria-label="Show Stay's face"
          onClick={presence.togglePin}
          data-testid="face-toggle"
        >
          Face
        </button>
      </div>

      {/* In-app Microphone Consent Sheet (§8.1) */}
      <MicConsentSheet
        isOpen={showMicConsent}
        onConsent={() => {
          try {
            window.localStorage.setItem('stay:mic_consented:v1', '1');
          } catch {}
          setShowMicConsent(false);
          void voice.startVoiceSession();
        }}
        onTextOnly={() => {
          try {
            window.localStorage.setItem('stay:mic_consented:v1', '0');
          } catch {}
          setShowMicConsent(false);
          setCallIntent(false);
          onQuietModeChange(true);
        }}
        onClose={() => (setShowMicConsent(false), setCallIntent(false))}
      />

      {sheet === 'menu' && (
        <Sheet title="More" onClose={() => setSheet(null)}>
          <div className="space-y-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">Calm & Focus</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => (setSheet(null), setGrounding(true))}>
                  Ground me (breathing)
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => openPanel('routines')} data-testid="menu-routines">
                  Routines
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => openPanel('dump')} data-testid="menu-dump">
                  Brain dump
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => openPanel('today')} data-testid="menu-today">
                  Today&apos;s list
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2 sm:col-span-2" onClick={() => openPanel('parking')} data-testid="parking-open">
                  Parked thoughts
                </button>
              </div>
            </div>

            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">Voice & Audio</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => setSheet('voice')}>
                  Voice and language
                </button>
                <button
                  type="button"
                  className="btn btn-secondary justify-start text-sm py-2"
                  onClick={() => {
                    if (!quietMode) voice.disconnectVoiceSession();
                    onQuietModeChange(!quietMode);
                    setSheet(null);
                  }}
                >
                  {quietMode ? 'Turn voice on' : 'Quiet mode (type only)'}
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2 sm:col-span-2" onClick={() => voice.setCompanionMode(!voice.companionMode)} aria-pressed={voice.companionMode} data-testid="companion-toggle">
                  {voice.companionMode ? 'Stay with me all day: on' : 'Stay with me all day: off'}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">Workspace & History</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => setSheet('remind')} data-testid="remind-open">
                  Check-ins & reminders
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => setSheet('memory')}>
                  What Stay remembers
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => openPanel('vision')} data-testid="menu-vision">
                  Show Stay something
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => openPanel('call')} data-testid="menu-call-later">
                  Have Stay call me
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => setSheet('history')} data-testid="menu-history">
                  History
                </button>
                <button type="button" className="btn btn-secondary justify-start text-sm py-2" onClick={() => router.push('/app/settings')}>
                  Settings & keys
                </button>
              </div>
            </div>
          </div>
          <p className="meta mt-4">Just ask, by voice or typing: &ldquo;show my history&rdquo;, &ldquo;open brain dump&rdquo;, &ldquo;what do you remember&rdquo;, &ldquo;ground me&rdquo;.</p>
        </Sheet>
      )}

      {sheet === 'voice' && (
        <Sheet title="Voice and language" onClose={() => setSheet(null)}>
          <VoicePicker selected={voice.selectedVoice} onSelect={(id) => { const p = voice.setSelectedVoice(id); if (p) setReceipt(`${p.name} armed — ready to speak`); }} fastVoice={voice.fastVoice} />
          <label className="mt-5 flex cursor-pointer items-start gap-3" data-testid="fast-voice-row">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-[#8FD3FF]" checked={voice.fastVoice} onChange={(e) => voice.setFastVoice(e.target.checked)} data-testid="fast-voice-toggle" />
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
