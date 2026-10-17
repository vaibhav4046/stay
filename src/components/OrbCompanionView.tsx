'use client';

import { useEffect, useMemo, useState } from 'react';
import { Signal } from '@/components/Signal';
import type { CoachPlanProposal, SessionOutcome, BarrierType } from '@/types/domain';
import { BARRIER_DEFINITIONS } from '@/lib/coach/strategies';
import { detectTopicShape, TOPIC_SHAPE_LABELS, type UseVoiceAgentReturn } from '@/lib/voice/useVoiceAgent';
import { detectVoiceCommand } from '@/lib/voice/voiceCommands';
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
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [showScienceDrawer, setShowScienceDrawer] = useState(false);
  const [orbExecTab, setOrbExecTab] = useState<
    'reality' | 'artifact' | 'brainstorm' | 'path' | 'clinical' | null
  >('reality');

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

  const getStatusText = () => {
    if (quietMode) return 'Quiet Mode Active · Text Companion';
    if (!voice.isConnected) return 'Tap Sculpture or Say "Hey Stay" to Wake';
    if (voice.isHandsFreePaused) return 'Paused · Say "Hey Stay" to Resume';
    switch (voice.visualState) {
      case 'connecting':
        return 'Connecting 24kHz full-duplex voice...';
      case 'listening':
        return voice.partialUserTranscript ? 'Listening...' : 'Listening · Speak naturally';
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
              const next = voice.selectedLanguage === 'auto' ? 'en-GB' : 'auto';
              voice.setSelectedLanguage(next);
            }}
            className="rounded-full px-3 py-1 text-[0.76rem] font-medium text-ink hover:bg-black/[0.05] transition-colors"
            title="Toggle 32-Language Auto Detection"
            aria-label="Toggle language auto detection"
          >
            {currentLang?.code === 'auto' ? 'Auto (32L)' : currentLang?.label}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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
            hideLabel
            className="w-full h-full"
          />

          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="rounded-full bg-black/65 text-white px-3.5 py-1.5 text-xs font-medium backdrop-blur-md shadow-sm">
              {!voice.isConnected ? 'Wake Voice' : voice.isHandsFreePaused ? 'Resume' : 'Pause'}
            </span>
          </div>
        </button>

        {/* Apple Segmented Morphology Dock & Status */}
        <div className="mt-3 text-center flex flex-col items-center gap-2.5 w-full">
          {voice.topicShape > 0 && TOPIC_SHAPE_LABELS[voice.topicShape] && (
            <span
              data-testid="orb-morph-badge"
              data-topic-shape={voice.topicShape}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-xl border border-black/[0.08] px-3.5 py-1 text-xs font-semibold text-ink shadow-xs transition-all"
            >
              <span>{TOPIC_SHAPE_LABELS[voice.topicShape].icon}</span>
              <span>{TOPIC_SHAPE_LABELS[voice.topicShape].label}</span>
            </span>
          )}

          {/* Sleek Apple Segmented Control for Smooth Real-Time Shape Morphing */}
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
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => voice.setTopicShape(s.id)}
                data-testid={`orb-shape-btn-${s.id}`}
                aria-pressed={voice.topicShape === s.id}
                className={`rounded-full px-3 py-1 text-[0.72rem] font-medium transition-all duration-300 flex items-center gap-1 ${
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

          <p className="text-[0.88rem] font-medium tracking-tight text-ink">{getStatusText()}</p>
        </div>

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

        {/* Sleek Apple Quick-Launch Hooks when Idle */}
        {!plan && !running && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-xl">
            {[
              {
                label: '🫠 "Brain is fried, 10 tabs open, landlord + taxes..."',
                text: "Ugh my brain is completely fried, I have ten tabs open, landlord emails and quarterly VAT tax paperwork and I can't even move",
              },
              {
                label: '🍦 "Need a sweet ice cream reward to start writing..."',
                text: 'I am so stuck on writing this proposal draft, I need an ice cream reward after',
              },
              {
                label: '🪷 "Spiraling & overwhelmed, calm my head first"',
                text: 'Stay ground me',
              },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  const cmd = detectVoiceCommand(chip.text);
                  if (!cmd) {
                    onTaskSubmit?.(chip.text);
                  }
                  const shape = detectTopicShape(chip.text);
                  if (shape > 0) voice.setTopicShape(shape);
                  voice.sendUserTextMessage(chip.text);
                }}
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

      {/* Bottom Apple Intelligence-Style Omnibar */}
      <footer className="w-full max-w-2xl flex flex-col gap-2 z-20">
        {actionReceipt && (
          <div className="mx-auto rounded-full bg-white/90 backdrop-blur-xl px-3.5 py-1 text-xs text-[#006A67] font-medium border border-black/[0.07] shadow-xs">
            ✓ {actionReceipt}
          </div>
        )}

        <div className="max-h-20 overflow-y-auto px-4 py-1 text-center text-xs text-ink-2 space-y-1">
          {voice.partialUserTranscript && (
            <p className="italic text-ink font-medium">&ldquo;{voice.partialUserTranscript}&rdquo;</p>
          )}
          {voice.transcripts.length > 0 && !voice.partialUserTranscript && (
            <p className="text-ink-2 truncate">
              <strong className="text-ink">
                {voice.transcripts[voice.transcripts.length - 1].role === 'user' ? 'You' : 'Stay'}:
              </strong>{' '}
              {voice.transcripts[voice.transcripts.length - 1].text}
            </p>
          )}
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
            const cmd = detectVoiceCommand(clean);
            if (!cmd) {
              if (onTaskSubmit) {
                onTaskSubmit(clean);
              } else {
                onTaskTextChange(clean);
              }
            }
            voice.sendUserTextMessage(clean);
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
                ? 'Speak naturally, brain-dump, or command Stay...'
                : 'Tell Stay what is on your mind, or press Spacebar to talk...'
            }
            value={typedMessage}
            onChange={(e) => {
              const val = e.target.value;
              setTypedMessage(val);
              if (val.trim().length > 2) {
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
