'use client';

import { useEffect, useMemo, useState } from 'react';
import { Signal } from '@/components/Signal';
import { StayLogo } from '@/components/StayLogo';
import { OrbCognitiveGames } from '@/components/OrbCognitiveGames';
import type { CoachPlanProposal, SessionOutcome, BarrierType } from '@/types/domain';
import { BARRIER_DEFINITIONS } from '@/lib/coach/strategies';
import { detectTopicShape, TOPIC_SHAPE_LABELS, type UseVoiceAgentReturn, type OrbColorTheme } from '@/lib/voice/useVoiceAgent';
import { parseMultiIntentUtterance, type MultiIntentParseResult } from '@/lib/voice/voiceCommands';
import { IntelligentTaskCanvas } from '@/components/IntelligentTaskCanvas';
import {
  calculateTaskReality,
  brainstormStarterAngles,
  synthesizeTaskPath,
} from '@/lib/coach/executiveEngine';
import {
  ADHD_CLINICAL_ENCYCLOPEDIA,
  analyzeUserAdhdPhenotype,
  generateLiveAgenticArtifact,
} from '@/lib/coach/adhdClinicalEngine';

interface OrbCompanionViewProps {
  voice: UseVoiceAgentReturn;
  taskText: string;
  onTaskTextChange: (t: string) => void;
  onTaskSubmit?: (t: string) => void;
  onSelectFirstStep?: (newStep: string, angleName: string) => void;
  plan: CoachPlanProposal | null;
  running: boolean;
  remaining: number;
  timerMinutes: number;
  onStartTimer: (mins: number) => void;
  onStopTimer: () => void;
  onLogOutcome: (outcome: SessionOutcome) => void;
  onOpenMemory: () => void;
  onOpenHistory?: () => void;
  sessionCount?: number;
  onOpenTraining: () => void;
  onOpenGrounding: () => void;
  onOpenAuth: () => void;
  onOpenVoiceSelector?: () => void;
  onToggleQuietMode: () => void;
  quietMode: boolean;
  onSwitchToWorkspace: () => void;
  actionReceipt: string | null;
  userEmail?: string | null;
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function OrbCompanionView({
  voice,
  taskText,
  onTaskTextChange,
  onTaskSubmit,
  onSelectFirstStep,
  plan,
  running,
  remaining,
  timerMinutes,
  onStartTimer,
  onStopTimer,
  onLogOutcome,
  onOpenMemory,
  onOpenHistory,
  sessionCount,
  onOpenTraining,
  onOpenGrounding,
  onOpenAuth,
  onOpenVoiceSelector,
  quietMode,
  onSwitchToWorkspace,
  actionReceipt,
  userEmail,
}: OrbCompanionViewProps) {
  const [typedMessage, setTypedMessage] = useState('');
  const [lastIntent, setLastIntent] = useState<(MultiIntentParseResult & { utterance: string }) | null>(null);
  const [customShapePrompt, setCustomShapePrompt] = useState('');

  // One router for typed text + chips: fire every command, and if real-world
  // context rides along ("stressed about landlord... let's play"), plan it too.
  const routeUtterance = (text: string) => {
    const multi = parseMultiIntentUtterance(text);
    setLastIntent({ ...multi, utterance: text });
    const isGameUtterance =
      voice.topicShape === 5 ||
      multi.commands.some((c) => c.type === 'start_game' || c.type === 'game_action' || c.type === 'set_game_difficulty') ||
      /\b(?:emerald|sapphire|amber|violet|simon|impulse|shield|gonogo|word\s+rally|target|hit)\b/i.test(text);

    if (!isGameUtterance && (multi.commands.length === 0 || multi.conversationalContext)) {
      const taskPart = multi.conversationalContext || text;
      if (onTaskSubmit) onTaskSubmit(taskPart);
      else onTaskTextChange(taskPart);
    }
    const shape = detectTopicShape(text);
    if (shape > 0 && shape !== 8) voice.setTopicShape(shape);
    voice.sendUserTextMessage(text);
  };
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [showScienceDrawer, setShowScienceDrawer] = useState(false);
  const [orbExecTab, setOrbExecTab] = useState<
    'reality' | 'artifact' | 'brainstorm' | 'path' | 'clinical' | null
  >('reality');

  // Live Web & Clinical Research state
  const [researchQuery, setResearchQuery] = useState('ADHD dopamine working memory');
  const [researchData, setResearchData] = useState<{
    query: string;
    title: string;
    executiveSummary: string;
    keyPoints: string[];
    adhdClinicalConnection: string;
    sourceUrl: string;
    sourceTitle: string;
  }>({
    query: 'ADHD dopamine working memory',
    title: 'Dopamine D2/D3 Receptor Availability in the ADHD Mesoaccumbens Reward Pathway',
    executiveSummary:
      'PET imaging across unmedicated adults with ADHD reveals lower tonic D2/D3 receptor and dopamine transporter availability in the nucleus accumbens, explaining why mundane tasks fail to trigger initiation.',
    keyPoints: [
      'JAMA / Volkow et al. (NIH / NIDA): Mesoaccumbens reward pathway under-arousal.',
      'Russell Barkley: Externalizing time into 60-second micro-entries bypasses temporal myopia.',
      'Torkel Klingberg: 45-second visuospatial working-memory games prime prefrontal BOLD activity.',
    ],
    adhdClinicalConnection:
      'Pairing micro-steps with immediate sensory rewards (Ice Cream Swirl & Orb Cognitive Games) unlocks phasic dopamine firing.',
    sourceUrl: 'https://pubmed.ncbi.nlm.nih.gov/19738093/',
    sourceTitle: 'JAMA / Volkow et al. (NIH)',
  });
  const [researchLoading, setResearchLoading] = useState(false);
  const [isReadingAloud, setIsReadingAloud] = useState(false);

  const runLiveResearch = async (q: string) => {
    const cleanQ = q.trim() || 'ADHD executive dysfunction';
    setResearchLoading(true);
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: cleanQ }),
      });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const top = items[0];
        if (top) {
          setResearchData({
            query: data.query || cleanQ,
            title: top.title || cleanQ,
            executiveSummary: top.summary || data.spokenSynthesis || '',
            keyPoints: items.slice(0, 3).map((it: { source?: string; title?: string; summary?: string }) =>
              `${it.source ? `${it.source}: ` : ''}${it.title || it.summary || ''}`
            ),
            adhdClinicalConnection:
              top.clinicalTakeaway ||
              'Synthesized into a zero-overwhelm audio/visual card for rapid ADHD comprehension.',
            sourceUrl: top.url || 'https://pubmed.ncbi.nlm.nih.gov/',
            sourceTitle: top.source || 'Clinical Encyclopedia',
          });
        }
      }
    } catch {
      // Fallback handled gracefully
    } finally {
      setResearchLoading(false);
    }
  };

  useEffect(() => {
    if (voice.topicShape === 6 && !researchLoading) {
      void runLiveResearch(researchQuery);
    }
  }, [voice.topicShape]);

  const speakTextAloud = (textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(textToSpeak);
      u.rate = 1.02;
      u.onstart = () => setIsReadingAloud(true);
      u.onend = () => setIsReadingAloud(false);
      u.onerror = () => setIsReadingAloud(false);
      window.speechSynthesis.speak(u);
    } catch {
      setIsReadingAloud(false);
    }
  };

  const activeTaskString = plan?.taskText || taskText || 'Landlord lease letter and quarterly VAT tax paperwork';
  const execReality = useMemo(() => calculateTaskReality(activeTaskString), [activeTaskString]);
  const execBrainstorm = useMemo(() => brainstormStarterAngles(activeTaskString), [activeTaskString]);
  const execPath = useMemo(() => synthesizeTaskPath(activeTaskString), [activeTaskString]);
  const liveArtifact = useMemo(() => generateLiveAgenticArtifact(activeTaskString), [activeTaskString]);
  const adhdStudy = useMemo(
    () =>
      analyzeUserAdhdPhenotype(
        activeTaskString,
        sessionCount || 2,
        voice.userMemory.facts.length + voice.userMemory.recentSessionsSummary.length
      ),
    [activeTaskString, sessionCount, voice.userMemory.facts.length, voice.userMemory.recentSessionsSummary.length]
  );

  const [editableDraft, setEditableDraft] = useState(liveArtifact.draftContent);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [copiedDraft, setCopiedDraft] = useState(false);

  useEffect(() => {
    setEditableDraft(liveArtifact.draftContent);
    setCheckedItems({});
  }, [liveArtifact.draftContent]);

  const currentLang =
    voice.supportedLanguages.find((l) => l.code === voice.selectedLanguage) ||
    voice.supportedLanguages[0];

  const detectedLangObj =
    voice.supportedLanguages.find((l) => l.code === voice.detectedLanguageCode) ||
    currentLang;

  const lastUserTurn = useMemo(() => {
    for (let i = voice.transcripts.length - 1; i >= 0; i--) {
      if (voice.transcripts[i].role === 'user') return voice.transcripts[i];
    }
    return null;
  }, [voice.transcripts]);

  const lastAssistantTurn = useMemo(() => {
    for (let i = voice.transcripts.length - 1; i >= 0; i--) {
      if (voice.transcripts[i].role === 'agent') return voice.transcripts[i];
    }
    return null;
  }, [voice.transcripts]);

  const getStatusText = () => {
    if (quietMode) return 'Quiet Mode Active · Text Companion';
    if (!voice.isConnected) return 'Tap Sculpture or Say "Hey Stay" to Wake';
    if (voice.isHandsFreePaused) return 'Paused · Say "Hey Stay" to Resume';
    switch (voice.visualState) {
      case 'connecting':
        return 'Connecting 24kHz Universal-3 Pro voice...';
      case 'listening':
        return voice.partialUserTranscript ? 'Listening (<15ms reflex)...' : 'Listening · Speak in any of 32 languages';
      case 'thinking':
        return 'Synthesizing micro-step & pre-drafting...';
      case 'speaking':
        return 'Stay speaking...';
      case 'backchannel':
        return 'Attuned · Listening closely...';
      default:
        return '24/7 Living Companion Ready';
    }
  };

  return (
    <div
      className="relative min-h-[82vh] flex flex-col justify-between items-center rounded-[32px] p-5 sm:p-8 border border-black/[0.07] shadow-[0_24px_80px_rgba(0,0,0,0.06)] overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 100% at 50% 0%, #FFFFFF 0%, #F7F6F2 58%, #EFECE6 100%)',
      }}
    >
      {/* Sleek Apple Frosted Glass Top Control Capsule */}
      <header className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 z-20 rounded-full bg-white/80 backdrop-blur-2xl px-3.5 py-2 border border-black/[0.07] shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1.5 pr-1">
            <StayLogo size={24} />
          </div>
          <div className="flex items-center gap-2 rounded-full bg-black/[0.04] px-3 py-1">
            <span
              className={`h-2 w-2 rounded-full ${
                !voice.isConnected
                  ? 'bg-emerald-600'
                  : voice.isHandsFreePaused
                  ? 'bg-amber-500'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="text-[0.72rem] font-semibold tracking-tight text-ink">
              {voice.isConnected
                ? voice.isHandsFreePaused
                  ? 'PAUSED'
                  : 'LISTENING'
                : 'STANDBY'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenGrounding}
            className="rounded-full px-3 py-1 text-[0.76rem] font-medium text-ink hover:bg-black/[0.05] transition-colors flex items-center gap-1"
            title="Somatic Grounding & 4-7-8 Breathing (Key: G)"
          >
            <span>Ground Me</span>
          </button>

          <button
            type="button"
            onClick={onOpenVoiceSelector}
            className="rounded-full px-3 py-1 text-[0.76rem] font-medium text-ink hover:bg-black/[0.05] transition-colors capitalize"
            title="Voice Persona"
            aria-label="Change Voice Persona"
          >
            Voice: {voice.selectedVoice}
          </button>

          <button
            type="button"
            onClick={() => {
              const order = ['auto', 'hi-IN', 'ko-KR', 'es-ES', 'en-GB'];
              const idx = order.indexOf(voice.selectedLanguage);
              const next = order[(idx + 1) % order.length];
              voice.setSelectedLanguage(next);
            }}
            data-testid="language-cycle-btn"
            className="rounded-full px-3 py-1 text-[0.76rem] font-medium text-ink hover:bg-black/[0.05] transition-colors"
            title="Cycle 32-Language Auto Detection (Auto / Hindi / Korean / Spanish / English)"
            aria-label="Toggle language auto detection"
          >
            {currentLang?.code === 'auto' ? '🌐 Auto (32L)' : `${currentLang?.flag || '🌐'} ${currentLang?.nativeName || currentLang?.label}`}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => voice.setTopicShape(voice.topicShape === 5 ? 0 : 5)}
            data-testid="header-game-btn"
            className={`rounded-full px-3 py-1 text-[0.76rem] font-semibold transition-colors ${
              voice.topicShape === 5
                ? 'bg-[#006A67] text-white'
                : 'bg-[#006A67]/10 text-[#006A67] hover:bg-[#006A67]/15'
            }`}
            title="Launch Interactive ADHD Orb Cognitive Games"
          >
            🎮 Play Orb Game
          </button>

          <button
            type="button"
            onClick={() => setShowScienceDrawer((v) => !v)}
            data-testid="orb-science-btn"
            className="rounded-full px-3 py-1 text-[0.76rem] font-semibold bg-[#006A67]/10 text-[#006A67] hover:bg-[#006A67]/15 transition-colors"
            title="Open Personal ADHD Brain Study & 1775–2024 Clinical Research Encyclopedia"
          >
            Brain Study &amp; Science
          </button>

          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="rounded-full px-3 py-1 text-[0.76rem] font-medium text-ink hover:bg-black/[0.05] transition-colors"
              title="Session History"
            >
              History {typeof sessionCount === 'number' ? `(${sessionCount})` : ''}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenMemory}
            className="rounded-full px-3 py-1 text-[0.76rem] font-medium text-ink hover:bg-black/[0.05] transition-colors"
            title="Persistent Cognitive Memory"
          >
            Memory ({voice.userMemory.facts.length + voice.userMemory.recentSessionsSummary.length})
          </button>

          <button
            type="button"
            onClick={onOpenTraining}
            className="rounded-full px-2.5 py-1 text-[0.76rem] font-medium text-ink-2 hover:text-ink hover:bg-black/[0.05] transition-colors hidden md:inline-flex"
            title="Adaptive Calibration"
          >
            Calibration
          </button>

          <button
            type="button"
            onClick={onOpenAuth}
            className="rounded-full px-2.5 py-1 text-[0.76rem] font-medium text-ink-2 hover:text-ink hover:bg-black/[0.05] transition-colors hidden sm:inline-flex"
          >
            {userEmail ? userEmail.split('@')[0] : 'Sign in'}
          </button>

          <button
            type="button"
            onClick={onSwitchToWorkspace}
            className="rounded-full px-3 py-1 text-[0.76rem] font-medium bg-black/[0.05] text-ink hover:bg-black/[0.09] transition-colors"
            data-testid="switch-to-grid"
          >
            Grid View
          </button>
        </div>
      </header>

      {/* Main Living Centerpiece: Apple-Grade Smooth Parametric 3D + Vector Sculpture */}
      <main className="relative my-auto flex flex-col items-center justify-center z-10 w-full max-w-2xl py-4">
        {/* Subtle Apple Studio Ambient Backlight */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-[300px] sm:w-[380px] h-[300px] sm:h-[380px] rounded-full blur-3xl transition-all duration-700 ${
              voice.topicShape === 1
                ? 'bg-rose-400/20 opacity-95'
                : voice.topicShape === 2
                ? 'bg-sky-400/20 opacity-95'
                : voice.topicShape === 3
                ? 'bg-purple-400/20 opacity-95'
                : voice.topicShape === 4
                ? 'bg-teal-400/25 opacity-95'
                : voice.topicShape === 5
                ? 'bg-amber-400/25 opacity-95'
                : voice.topicShape === 6
                ? 'bg-cyan-400/25 opacity-95'
                : 'bg-teal-500/15 opacity-75'
            }`}
          />
        </div>

        {/* Interactive Living Sculpture */}
        <button
          type="button"
          onClick={() => {
            if (!voice.isConnected) {
              voice.startVoiceSession();
            } else {
              voice.toggleHandsFreeMute();
            }
          }}
          className="relative mx-auto flex items-center justify-center w-[250px] sm:w-[296px] h-[250px] sm:h-[296px] cursor-pointer group outline-none focus:outline-none ring-0 focus-visible:ring-0 transition-transform duration-500 hover:scale-[1.02] active:scale-[0.98] select-none border-0 bg-transparent p-0"
          style={{ WebkitTapHighlightColor: 'transparent', outline: 'none', border: 'none' }}
          aria-label={
            !voice.isConnected
              ? 'Click to wake Stay'
              : voice.isHandsFreePaused
              ? 'Click to resume listening'
              : 'Click to pause listening'
          }
        >
          <Signal
            state={quietMode ? 'idle' : voice.visualState}
            energy={voice.audioEnergy}
            bands={voice.audioBands}
            topicShape={voice.topicShape}
            generativeShape={voice.generativeShape}
            colorTheme={voice.orbColorTheme}
            hideLabel
            className="w-full h-full"
          />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="rounded-full bg-black/65 text-white px-3.5 py-1.5 text-xs font-medium backdrop-blur-md shadow-sm">
              {!voice.isConnected ? 'Wake Voice' : voice.isHandsFreePaused ? 'Resume' : 'Pause'}
            </span>
          </div>
        </button>

        {/* Apple Segmented Morphology Dock & Shapify Color Sandbox */}
        <div className="mt-3 text-center flex flex-col items-center gap-2 w-full">
          {voice.topicShape === 8 && voice.generativeShape ? (
            <span
              data-testid="orb-morph-badge"
              data-topic-shape={8}
              data-catalog-id={voice.generativeShape.catalogId}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-black/[0.08] px-3.5 py-1 text-xs font-semibold text-ink shadow-xs transition-all"
            >
              <span>{voice.generativeShape.icon}</span>
              <span data-testid="generative-shape-label">{voice.generativeShape.label}</span>
              <span className="font-mono text-[0.62rem] text-ink-2">
                #{voice.generativeShape.catalogId.toLocaleString()} / 1B
              </span>
            </span>
          ) : voice.topicShape > 0 && TOPIC_SHAPE_LABELS[voice.topicShape] && (
            <span
              data-testid="orb-morph-badge"
              data-topic-shape={voice.topicShape}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-black/[0.08] px-3.5 py-1 text-xs font-semibold text-ink shadow-xs transition-all"
            >
              <span>{TOPIC_SHAPE_LABELS[voice.topicShape].icon}</span>
              <span>{TOPIC_SHAPE_LABELS[voice.topicShape].label}</span>
            </span>
          )}

          {/* Sleek Apple Segmented Control for Smooth Real-Time Shape Morphing (8 Shapes) */}
          <div
            className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full bg-black/[0.045] p-1 border border-black/[0.06]"
            data-testid="orb-shape-switcher"
          >
            {[
              { id: 0, icon: '🌊', label: 'Fluid Wave' },
              { id: 1, icon: '🍦', label: 'Ice Cream Swirl' },
              { id: 2, icon: '✒️', label: 'Letterform Gem' },
              { id: 3, icon: '🎨', label: 'Creative Star' },
              { id: 4, icon: '🪷', label: 'Lotus Calm' },
              { id: 5, icon: '🎮', label: 'Game Arena' },
              { id: 6, icon: '🌐', label: 'Research Globe' },
              { id: 7, icon: '⏳', label: 'Hourglass' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => voice.setTopicShape(s.id)}
                data-testid={`orb-shape-btn-${s.id}`}
                aria-pressed={voice.topicShape === s.id}
                className={`rounded-full px-2.5 py-1 text-[0.71rem] font-medium transition-all duration-300 flex items-center gap-1 ${
                  voice.topicShape === s.id
                    ? 'bg-white text-ink shadow-[0_2px_10px_rgba(0,0,0,0.08)] font-semibold'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Shapify Color & Gradient Sandbox Pills */}
          <div
            className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full bg-white/70 backdrop-blur-md px-2.5 py-1 border border-black/[0.05]"
            data-testid="orb-color-switcher"
          >
            <span className="text-[0.66rem] uppercase tracking-wider font-semibold text-ink-2 mr-1">
              Orb Gradient:
            </span>
            {(
              [
                { id: 'default', label: 'Teal Studio', dot: 'bg-[#006A67]' },
                { id: 'aurora', label: 'Aurora', dot: 'bg-emerald-500' },
                { id: 'sunset', label: 'Sunset', dot: 'bg-rose-500' },
                { id: 'ocean', label: 'Ocean', dot: 'bg-sky-500' },
                { id: 'cyber', label: 'Cyber', dot: 'bg-fuchsia-500' },
                { id: 'emerald', label: 'Emerald', dot: 'bg-teal-600' },
              ] as { id: OrbColorTheme; label: string; dot: string }[]
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => voice.setOrbColorTheme(c.id)}
                data-testid={`orb-color-btn-${c.id}`}
                aria-pressed={voice.orbColorTheme === c.id}
                className={`rounded-full px-2 py-0.5 text-[0.68rem] font-medium flex items-center gap-1 transition-all ${
                  voice.orbColorTheme === c.id
                    ? 'bg-ink text-white font-semibold shadow-2xs'
                    : 'text-ink-2 hover:text-ink'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                <span>{c.label}</span>
              </button>
            ))}
          </div>

          <form
            data-testid="billion-shape-synthesizer"
            onSubmit={(e) => {
              e.preventDefault();
              const c = customShapePrompt.trim();
              if (!c) return;
              voice.synthesizeShapeByConcept(c);
              setCustomShapePrompt('');
            }}
            className="inline-flex flex-wrap items-center justify-center gap-1 rounded-full bg-white/70 backdrop-blur-md px-2 py-1 border border-black/[0.05]"
          >
            {[
              { k: 'rocket', i: '🚀' },
              { k: 'heart', i: '💖' },
              { k: 'butterfly', i: '🦋' },
              { k: 'dragon', i: '🐉' },
              { k: 'dna', i: '🧬' },
              { k: 'lightning', i: '⚡' },
            ].map((s) => (
              <button
                key={s.k}
                type="button"
                data-testid={`billion-shape-pill-${s.k}`}
                onClick={() => voice.synthesizeShapeByConcept(s.k)}
                className="h-7 w-7 rounded-full hover:bg-black/[0.06] transition-colors text-sm"
                title={`Morph into ${s.k}`}
                aria-label={`Morph into ${s.k}`}
              >
                {s.i}
              </button>
            ))}
            <button
              type="button"
              data-testid="billion-shape-random"
              onClick={() => voice.synthesizeShapeByConcept(Math.floor(Math.random() * 1_000_000_000) + 1)}
              className="h-7 rounded-full px-2 hover:bg-black/[0.06] text-[0.68rem] font-semibold text-ink"
              title="Random shape from 1,000,000,000"
            >
              ♾️ 1B
            </button>
            <input
              value={customShapePrompt}
              onChange={(e) => setCustomShapePrompt(e.target.value)}
              data-testid="billion-shape-input"
              placeholder="become anything…"
              aria-label="Describe any shape"
              className="w-28 rounded-full bg-[#F5F5F7] px-2.5 py-1 text-[0.7rem] text-ink border border-black/[0.06] focus:outline-none focus:border-[#006A67]"
            />
          </form>

          <p className="text-[0.88rem] font-medium tracking-tight text-ink">{getStatusText()}</p>
        </div>

        {/* Interactive Orb ADHD Cognitive Games Arena (Topic Shape 5) */}
        {voice.topicShape === 5 && (
          <OrbCognitiveGames
            activeGame={voice.activeGame}
            onSelectGame={voice.setActiveGame}
            difficulty={voice.gameDifficulty}
            onSelectDifficulty={voice.setGameDifficulty}
            onSpeak={speakTextAloud}
            lastUserUtterance={voice.partialUserTranscript || lastUserTurn?.text || ''}
            onClose={() => voice.setTopicShape(0)}
          />
        )}

        {/* Live Agentic Web & Clinical Research Globe Panel (Topic Shape 6) */}
        {voice.topicShape === 6 && (
          <div
            className="mt-4 w-full max-w-xl rounded-[26px] bg-white/95 backdrop-blur-2xl p-5 border border-black/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.09)] space-y-3"
            data-testid="orb-research-panel"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-[0.68rem] font-bold uppercase tracking-widest text-[#006A67] block">
                  🌐 Live Agentic Web &amp; Clinical Research Reader
                </span>
                <h3 className="text-sm font-bold text-ink">
                  Search any topic — Stay synthesizes &amp; reads it aloud for ADHD focus
                </h3>
              </div>
              <button
                type="button"
                onClick={() => voice.setTopicShape(0)}
                className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[0.72rem] font-semibold text-ink hover:bg-black/[0.09]"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runLiveResearch(researchQuery);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={researchQuery}
                onChange={(e) => setResearchQuery(e.target.value)}
                data-testid="research-query-input"
                placeholder="Search any science, ADHD, or web topic..."
                className="flex-1 rounded-full bg-[#F5F5F7] px-3.5 py-1.5 text-xs text-ink border border-black/[0.08] focus:outline-none focus:border-[#006A67]"
              />
              <button
                type="submit"
                disabled={researchLoading}
                data-testid="research-submit-btn"
                className="rounded-full bg-[#006A67] text-white px-4 py-1.5 text-xs font-semibold hover:opacity-95"
              >
                {researchLoading ? 'Searching...' : 'Search'}
              </button>
            </form>

            {researchData && (
              <div className="rounded-2xl bg-[#F5F5F7] p-3.5 border border-black/[0.06] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-ink text-sm" data-testid="research-result-title">
                    {researchData.title}
                  </strong>
                  <button
                    type="button"
                    onClick={() =>
                      speakTextAloud(
                        `${researchData.title}. ${researchData.executiveSummary} ${researchData.adhdClinicalConnection}`
                      )
                    }
                    data-testid="research-read-aloud-btn"
                    className="rounded-full bg-[#006A67] text-white px-3 py-1 text-[0.7rem] font-semibold hover:opacity-95 shrink-0"
                  >
                    {isReadingAloud ? '🔊 Reading Aloud...' : '🔊 Read Aloud to Me'}
                  </button>
                </div>
                <p className="text-ink leading-relaxed" data-testid="research-result-summary">
                  {researchData.executiveSummary}
                </p>
                <ul className="space-y-1 text-ink-2 list-disc list-inside">
                  {researchData.keyPoints.map((pt, i) => (
                    <li key={i}>{pt}</li>
                  ))}
                </ul>
                <div className="rounded-xl bg-white p-2.5 border border-black/[0.05] text-[0.73rem] text-[#006A67] font-medium">
                  🧠 {researchData.adhdClinicalConnection}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Timer Halo Bar */}
        {running && (
          <div className="mt-4 w-full max-w-sm rounded-2xl bg-white/90 backdrop-blur-2xl p-3.5 border border-black/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#006A67] animate-ping" />
              <div>
                <span className="text-[0.7rem] uppercase tracking-wider font-semibold text-ink-2 block">
                  Active Focus Sprint
                </span>
                <span className="font-mono text-xl font-bold text-ink tnum">{formatClock(remaining)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowOutcomeDialog(true)}
                className="btn btn-primary py-1.5 px-3.5 text-xs rounded-full"
              >
                Log Done
              </button>
              <button
                type="button"
                onClick={onStopTimer}
                className="btn btn-secondary py-1.5 px-3 text-xs rounded-full"
                title="Cancel timer"
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {/* Apple Bento Card: First Step + 24/7 Autonomous Agent Co-Pilot + ADHD Brain Study */}
        {plan && !running && (
          <div className="mt-4 w-full max-w-xl rounded-[24px] bg-white/92 backdrop-blur-2xl p-5 border border-black/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition-all">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#006A67]/10 px-3 py-0.5 text-[0.73rem] font-semibold text-[#006A67]">
                {plan.strategyLabel}
              </span>
              <span className="text-xs font-mono text-ink-2">{timerMinutes}m bounded sprint</span>
            </div>

            <p className="mt-2.5 text-[0.96rem] font-medium text-ink leading-snug" data-testid="orb-first-step">
              {plan.firstStep}
            </p>

            {/* 5-Mode Apple Segmented Executive & Agentic Bar */}
            <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-black/[0.06] pt-3">
              <button
                type="button"
                onClick={() => setOrbExecTab(orbExecTab === 'reality' ? null : 'reality')}
                aria-pressed={orbExecTab === 'reality'}
                className="chip text-[0.72rem] py-0.5 px-2.5"
                data-testid="orb-exec-reality"
              >
                ⏱️ Reality (~{execReality.perceivedMinutes}m → {execReality.microEntrySeconds}s)
              </button>
              <button
                type="button"
                onClick={() => setOrbExecTab(orbExecTab === 'artifact' ? null : 'artifact')}
                aria-pressed={orbExecTab === 'artifact'}
                className="chip text-[0.72rem] py-0.5 px-2.5"
                data-testid="orb-exec-artifact"
              >
                ✨ Auto-Drafted Work
              </button>
              <button
                type="button"
                onClick={() => setOrbExecTab(orbExecTab === 'brainstorm' ? null : 'brainstorm')}
                aria-pressed={orbExecTab === 'brainstorm'}
                className="chip text-[0.72rem] py-0.5 px-2.5"
                data-testid="orb-exec-brainstorm"
              >
                💡 3 Angles
              </button>
              <button
                type="button"
                onClick={() => setOrbExecTab(orbExecTab === 'path' ? null : 'path')}
                aria-pressed={orbExecTab === 'path'}
                className="chip text-[0.72rem] py-0.5 px-2.5"
                data-testid="orb-exec-path"
              >
                🧭 3-Phase Path
              </button>
              <button
                type="button"
                onClick={() => setOrbExecTab(orbExecTab === 'clinical' ? null : 'clinical')}
                aria-pressed={orbExecTab === 'clinical'}
                className="chip text-[0.72rem] py-0.5 px-2.5"
                data-testid="orb-exec-clinical"
              >
                🧬 Brain Study
              </button>
            </div>

            {/* Tab 1: Time Reality Calculator */}
            {orbExecTab === 'reality' && (
              <div
                className="mt-2.5 rounded-2xl bg-[#F5F5F7] p-3 text-[0.78rem] text-ink-2 border border-black/[0.05]"
                data-testid="orb-panel-reality"
              >
                <div className="flex items-center justify-between font-mono text-xs text-ink font-semibold mb-1">
                  <span>Dread: ~{execReality.perceivedMinutes}m</span>
                  <span className="text-[#006A67]">Entry: {execReality.microEntrySeconds}s</span>
                  <span className="text-emerald-700">{execReality.inertiaBreakRate}% momentum</span>
                </div>
                <p className="leading-snug">{execReality.neuroInsight}</p>
              </div>
            )}

            {/* Tab 2: 24/7 Autonomous Agentic Pre-Drafted Artifact */}
            {orbExecTab === 'artifact' && (
              <div
                className="mt-2.5 rounded-2xl bg-[#F5F5F7] p-3.5 text-[0.78rem] text-ink border border-black/[0.06] space-y-2.5"
                data-testid="orb-panel-artifact"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-[#006A67] block">
                      {liveArtifact.artifactType} · Autonomous Co-Pilot
                    </span>
                    <strong className="text-xs text-ink">{liveArtifact.title}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(editableDraft);
                      setCopiedDraft(true);
                      setTimeout(() => setCopiedDraft(false), 1800);
                    }}
                    className="rounded-full bg-white px-2.5 py-1 text-[0.7rem] font-semibold text-ink border border-black/[0.08] hover:bg-black/[0.03]"
                  >
                    {copiedDraft ? 'Copied' : 'Copy Draft'}
                  </button>
                </div>

                <textarea
                  value={editableDraft}
                  onChange={(e) => setEditableDraft(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl bg-white p-2.5 font-mono text-[0.74rem] text-ink border border-black/[0.08] focus:outline-none focus:border-[#006A67]"
                  aria-label="Autonomous agent starter draft"
                  data-testid="orb-artifact-editor"
                />

                <div className="space-y-1">
                  {liveArtifact.checklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-[0.74rem] cursor-pointer border border-black/[0.04]"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(checkedItems[item.id])}
                          onChange={(e) =>
                            setCheckedItems((prev) => ({ ...prev, [item.id]: e.target.checked }))
                          }
                          className="accent-[#006A67]"
                        />
                        <span className={checkedItems[item.id] ? 'line-through text-ink-2' : 'text-ink'}>
                          {item.text}
                        </span>
                      </span>
                      <span className="font-mono text-[0.68rem] text-[#006A67]">~{item.seconds}s</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: 3 Angles */}
            {orbExecTab === 'brainstorm' && (
              <div className="mt-2.5 grid gap-1.5" data-testid="orb-panel-brainstorm">
                {execBrainstorm.angles.map((angle, idx) => (
                  <button
                    key={angle.id}
                    type="button"
                    onClick={() => onSelectFirstStep?.(angle.prompt, angle.name)}
                    className="text-left rounded-xl border border-black/[0.07] bg-[#F5F5F7] p-2.5 hover:border-[#006A67] transition-colors"
                    data-testid={`orb-angle-${idx}`}
                  >
                    <div className="flex items-center justify-between text-[0.78rem] font-semibold text-ink">
                      <span>{angle.name}</span>
                      <span className="font-mono text-[0.68rem] text-[#006A67]">~{angle.timeSeconds}s</span>
                    </div>
                    <p className="text-[0.74rem] text-ink-2 leading-snug mt-0.5">{angle.prompt}</p>
                  </button>
                ))}
              </div>
            )}

            {/* Tab 4: 3-Phase Path */}
            {orbExecTab === 'path' && (
              <div className="mt-2.5 space-y-1.5" data-testid="orb-panel-path">
                {execPath.phases.map((p) => (
                  <div key={p.phase} className="rounded-xl bg-[#F5F5F7] p-2.5 text-[0.76rem] border border-black/[0.05]">
                    <div className="flex items-center justify-between font-semibold text-ink">
                      <span>
                        Phase {p.phase}: {p.name}
                      </span>
                      <span className="font-mono text-[0.7rem] text-[#006A67]">{p.durationMinutes}m</span>
                    </div>
                    <p className="text-ink-2 leading-snug mt-0.5">{p.action}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 5: Live Personal ADHD Phenotype & Neuroscience Study */}
            {orbExecTab === 'clinical' && (
              <div
                className="mt-2.5 rounded-2xl bg-[#F5F5F7] p-3.5 text-[0.76rem] text-ink border border-black/[0.06] space-y-2"
                data-testid="orb-panel-clinical"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-xs font-semibold text-ink">{adhdStudy.phenotypeTitle}</strong>
                  <span className="rounded-full bg-[#006A67]/10 px-2 py-0.5 text-[0.66rem] font-semibold text-[#006A67]">
                    Live Phenotype
                  </span>
                </div>
                <p className="text-ink-2 leading-snug">{adhdStudy.personalizedInsight}</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-xl bg-white p-2 border border-black/[0.05]">
                    <span className="text-[0.66rem] text-ink-2 block">Mesoaccumbens Dopamine Drive</span>
                    <span className="font-mono text-xs font-semibold text-emerald-700">
                      {adhdStudy.tonicDopamineBefore}% → {adhdStudy.tonicDopamineAfter}%
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2 border border-black/[0.05]">
                    <span className="text-[0.66rem] text-ink-2 block">Working Memory Load</span>
                    <span className="font-mono text-xs font-semibold text-[#006A67]">
                      {adhdStudy.workingMemoryLoadBefore}% → {adhdStudy.workingMemoryLoadAfter}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStartTimer(timerMinutes)}
                className="btn btn-primary flex-1 py-2 text-xs font-semibold rounded-full"
                data-testid="start-halo-timer"
              >
                Start {timerMinutes}-Minute Sprint
              </button>
              <button
                type="button"
                onClick={() => {
                  voice.sendUserTextMessage('Break this down even smaller please');
                }}
                className="btn btn-secondary py-2 px-3.5 text-xs rounded-full"
                title="Make this step even smaller"
              >
                Smaller
              </button>
            </div>
          </div>
        )}

        {(plan || lastIntent) && (voice.topicShape !== 5 || lastIntent?.isMultiContext) && (
          <IntelligentTaskCanvas
            intent={lastIntent}
            taskText={activeTaskString}
            firstStep={plan?.firstStep || null}
            steps={liveArtifact.checklist}
            draftTitle={liveArtifact.title}
            shapeLabel={voice.topicShape === 8 && voice.generativeShape ? voice.generativeShape.label : null}
          />
        )}

        {/* Sleek Apple Quick-Launch Hooks when Idle */}
        {!plan && !running && voice.topicShape !== 5 && voice.topicShape !== 6 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-xl">
            {[
              {
                label: '🫠 "Brain is fried, 10 tabs open, landlord + taxes..."',
                text: "Ugh my brain is completely fried, I have ten tabs open, landlord emails and quarterly VAT tax paperwork and I can't even move",
              },
              {
                label: '🎮 "I want to play an ADHD focus game"',
                text: 'I want to play a game',
              },
              {
                label: '🇮🇳 "मुझे ध्यान केंद्रित करने में मदद करो (Hindi)"',
                text: 'मुझे ध्यान केंद्रित करने में मदद करो',
              },
              {
                label: '🇰🇷 "집중할 수 있게 도와줘 (Korean)"',
                text: '집중할 수 있게 도와줘',
              },
              {
                label: '🍦 "Need a sweet ice cream reward to start writing..."',
                text: 'I am so stuck on writing this proposal draft, I need an ice cream reward after',
              },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => routeUtterance(chip.text)}
                className="rounded-full text-[0.74rem] py-1.5 px-3.5 bg-white/85 backdrop-blur-xl border border-black/[0.07] text-ink hover:bg-white shadow-2xs transition-all"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Real-Time NLU Comprehension Chips */}
        {voice.streamingAnalysis && (voice.partialUserTranscript || voice.visualState === 'listening') && (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {voice.streamingAnalysis.detectedTask && (
              <span className="rounded-full bg-[#006A67]/10 px-3 py-0.5 text-[0.72rem] font-medium text-[#006A67]">
                Target: <strong>{voice.streamingAnalysis.detectedTask}</strong>
              </span>
            )}
            <span className="rounded-full bg-white/80 px-3 py-0.5 text-[0.72rem] font-medium text-ink-2 border border-black/[0.06]">
              Barrier:{' '}
              {BARRIER_DEFINITIONS[voice.streamingAnalysis.detectedBarrier as BarrierType]?.label ||
                voice.streamingAnalysis.detectedBarrier}
            </span>
          </div>
        )}
      </main>

      {/* Bottom Apple Intelligence-Style Omnibar + Real-Time Multilingual Transcription & Reaction Bar */}
      <footer className="w-full max-w-2xl flex flex-col gap-2 z-20">
        {actionReceipt && (
          <div
            data-testid="action-receipt-banner"
            className="mx-auto rounded-full bg-white/90 backdrop-blur-xl px-3.5 py-1 text-xs text-[#006A67] font-medium border border-black/[0.07] shadow-xs"
          >
            ✓ {actionReceipt}
          </div>
        )}

        {/* Always-Visible Real-Time Multilingual Transcription & Reaction Bar */}
        <div
          data-testid="live-transcript-bar"
          className="rounded-2xl bg-white/88 backdrop-blur-xl px-3.5 py-2.5 border border-black/[0.07] shadow-2xs space-y-1.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[0.68rem]">
            <div className="flex items-center gap-1.5">
              <span
                data-testid="detected-language-badge"
                className="inline-flex items-center gap-1 rounded-full bg-[#006A67]/10 px-2.5 py-0.5 font-semibold text-[#006A67]"
              >
                <span>{detectedLangObj?.flag || '🌐'}</span>
                <span>{detectedLangObj?.nativeName || detectedLangObj?.label || 'Auto (32L)'}</span>
                <span className="font-mono opacity-75">({voice.detectedLanguageCode})</span>
              </span>
              <span
                data-testid="u3-pro-badge"
                className="rounded-full bg-black/[0.04] px-2 py-0.5 font-mono text-ink-2"
              >
                u3-rt-pro · &lt;15ms Reflex
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="quick-hindi-btn"
                onClick={() => {
                  const msg = 'मुझे ध्यान केंद्रित करने में मदद करो';
                  onTaskSubmit?.(msg);
                  voice.sendUserTextMessage(msg);
                }}
                className="rounded-full bg-black/[0.04] hover:bg-black/[0.08] px-2 py-0.5 font-medium text-ink transition-colors"
                title="Test Live Hindi Detection & Native Reaction"
              >
                🇮🇳 हिन्दी
              </button>
              <button
                type="button"
                data-testid="quick-korean-btn"
                onClick={() => {
                  const msg = '집중할 수 있게 도와줘';
                  onTaskSubmit?.(msg);
                  voice.sendUserTextMessage(msg);
                }}
                className="rounded-full bg-black/[0.04] hover:bg-black/[0.08] px-2 py-0.5 font-medium text-ink transition-colors"
                title="Test Live Korean Detection & Native Reaction"
              >
                🇰🇷 한국어
              </button>
              <button
                type="button"
                data-testid="quick-game-btn"
                onClick={() => voice.sendUserTextMessage('I want to play a game')}
                className="rounded-full bg-black/[0.04] hover:bg-black/[0.08] px-2 py-0.5 font-medium text-ink transition-colors"
                title="Transform Orb into ADHD Cognitive Game"
              >
                🎮 Game
              </button>
              <button
                type="button"
                data-testid="quick-research-btn"
                onClick={() => voice.sendUserTextMessage('search web for ADHD dopamine')}
                className="rounded-full bg-black/[0.04] hover:bg-black/[0.08] px-2 py-0.5 font-medium text-ink transition-colors"
                title="Transform Orb into Research Globe"
              >
                🌐 Research
              </button>
              <span
                data-testid="token-saver-badge"
                className="hidden sm:inline-block rounded-full bg-emerald-500/10 text-emerald-800 px-2 py-0.5 font-mono"
                title="Compliant Multi-Key Pool + Semantic Cache + Prompt Compression"
              >
                Saved {voice.tokenTelemetry.tokensSavedTotal} tok · Pool {voice.tokenTelemetry.assemblyPool.totalKeysConfigured + voice.tokenTelemetry.groqPool.totalKeysConfigured} keys
              </span>
            </div>
          </div>

          <div className="text-xs space-y-1 text-left">
            {voice.partialUserTranscript ? (
              <p className="italic text-ink font-medium" data-testid="live-transcript-partial">
                🎙️ &ldquo;{voice.partialUserTranscript}&rdquo;
              </p>
            ) : lastUserTurn ? (
              <p className="text-ink-2 truncate" data-testid="live-transcript-user">
                <strong className="text-ink">You ({voice.detectedLanguageCode}):</strong> {lastUserTurn.text}
              </p>
            ) : (
              <p className="text-ink-2/75 text-[0.73rem]" data-testid="live-transcript-placeholder">
                Speak or type in English, हिन्दी (Hindi), 한국어 (Korean), Español, or any of 32 languages — live transcription &amp; instant reaction appear here.
              </p>
            )}

            {lastAssistantTurn && (
              <p className="text-ink font-medium leading-snug" data-testid="live-transcript-stay">
                <strong className="text-[#006A67]">Stay:</strong> {lastAssistantTurn.text}
              </p>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = typedMessage.trim();
            if (!clean) return;
            setTypedMessage('');
            if (/\b(?:brain study|adhd science|research adhd|study my psychology)\b/i.test(clean)) {
              setShowScienceDrawer(true);
              return;
            }
            routeUtterance(clean);
          }}
          className="flex items-center gap-2 bg-white/90 backdrop-blur-2xl p-1.5 rounded-full border border-black/[0.08] shadow-[0_12px_36px_rgba(0,0,0,0.06)]"
        >
          <button
            type="button"
            onClick={() => {
              if (!voice.isConnected) {
                voice.startVoiceSession();
              } else {
                voice.toggleHandsFreeMute();
              }
            }}
            className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              voice.isConnected && !voice.isHandsFreePaused
                ? 'bg-[#006A67] text-white'
                : 'bg-black/[0.05] text-ink hover:bg-black/[0.09]'
            }`}
            title="Toggle microphone"
          >
            {voice.isConnected && !voice.isHandsFreePaused ? '🎙️' : '🎤'}
          </button>

          <input
            type="text"
            className="flex-1 bg-transparent px-3 py-1 text-xs sm:text-sm text-ink outline-hidden"
            data-testid="task-input"
            placeholder={
              voice.isConnected
                ? 'Speak naturally (32 languages), play a game, or command Stay...'
                : 'Speak or type in English, हिन्दी, 한국어, or say "I want to play a game"...'
            }
            value={typedMessage}
            onChange={(e) => {
              const val = e.target.value;
              setTypedMessage(val);
              if (val.trim().length > 2 && voice.topicShape !== 5) {
                const shape = detectTopicShape(val);
                if (shape > 0) {
                  voice.setTopicShape(shape);
                }
              }
            }}
          />

          <button
            type="submit"
            disabled={!typedMessage.trim()}
            className="btn btn-primary py-1.5 px-4 text-xs rounded-full disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </footer>

      {/* Apple-Style ADHD Brain Study & Clinical History Encyclopedia Modal */}
      {showScienceDrawer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          data-testid="orb-science-modal"
        >
          <div className="w-full max-w-2xl max-h-[82vh] overflow-y-auto rounded-[28px] bg-white/95 backdrop-blur-2xl p-6 border border-black/[0.08] shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[0.68rem] font-bold uppercase tracking-widest text-[#006A67]">
                  24/7 Longitudinal Psychology &amp; Clinical Neuroscience Engine
                </span>
                <h3 className="text-xl font-bold tracking-tight text-ink mt-0.5">
                  Personal ADHD Phenotype &amp; Clinical Research (1775–2024)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScienceDrawer(false)}
                className="rounded-full bg-black/[0.06] px-3 py-1 text-xs font-semibold text-ink hover:bg-black/[0.1]"
              >
                Close
              </button>
            </div>

            {/* Live Phenotype Card */}
            <div className="rounded-2xl bg-[#F5F5F7] p-4 border border-black/[0.06] space-y-2.5">
              <div className="flex items-center justify-between">
                <strong className="text-sm text-ink">{adhdStudy.phenotypeTitle}</strong>
                <span className="text-xs font-mono text-[#006A67] font-semibold">Active Calibration</span>
              </div>
              <p className="text-xs text-ink-2 leading-relaxed">{adhdStudy.personalizedInsight}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="rounded-xl bg-white p-3 border border-black/[0.05]">
                  <span className="text-[0.7rem] text-ink-2 block">Prefrontal &amp; Dopamine State</span>
                  <strong className="text-xs text-ink block mt-0.5">{adhdStudy.pfcState}</strong>
                </div>
                <div className="rounded-xl bg-white p-3 border border-black/[0.05]">
                  <span className="text-[0.7rem] text-ink-2 block">Network Coupling</span>
                  <strong className="text-xs text-ink block mt-0.5">{adhdStudy.dmnStatus}</strong>
                </div>
              </div>
            </div>

            {/* Historical & Clinical Neuroscience Timeline (1775 - Present) */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-2">
                Evidence-Based ADHD History &amp; Mechanisms Built Into Stay
              </h4>
              {ADHD_CLINICAL_ENCYCLOPEDIA.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white p-3.5 border border-black/[0.07] shadow-2xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs font-semibold text-ink">{item.title}</strong>
                    <span className="font-mono text-[0.68rem] text-[#006A67] font-semibold shrink-0">
                      {item.eraOrYear}
                    </span>
                  </div>
                  <p className="text-[0.7rem] font-medium text-ink-2">{item.researchers}</p>
                  <p className="text-[0.74rem] text-ink leading-snug">{item.clinicalMechanism}</p>
                  <p className="text-[0.72rem] text-[#006A67] font-medium pt-0.5">
                    → In Stay: {item.howStayAppliesIt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Outcome Selection Dialog */}
      {showOutcomeDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-sm p-5 bg-white border border-black/[0.08] shadow-2xl rounded-3xl">
            <h4 className="font-semibold text-ink text-sm">How did your focus block go?</h4>
            <div className="mt-3 grid gap-2">
              {[
                { key: 'started', label: 'I started and made progress' },
                { key: 'partly_started', label: 'I partly started' },
                { key: 'not_started', label: "I didn't start (that's okay)" },
                { key: 'paused_or_stopped', label: 'I had to stop early' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => {
                    onLogOutcome(opt.key as SessionOutcome);
                    setShowOutcomeDialog(false);
                  }}
                  className="chip text-left justify-start py-2 px-3 text-xs"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowOutcomeDialog(false)}
              className="btn btn-ghost w-full mt-3 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
