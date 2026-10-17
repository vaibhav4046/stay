'use client';

import { useMemo, useState } from 'react';
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
  onToggleQuietMode,
  quietMode,
  onSwitchToWorkspace,
  actionReceipt,
  userEmail,
}: OrbCompanionViewProps) {
  const [typedMessage, setTypedMessage] = useState('');
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [orbExecTab, setOrbExecTab] = useState<'reality' | 'brainstorm' | 'path' | null>('reality');
  const execReality = useMemo(() => calculateTaskReality(plan?.taskText || taskText || 'Current task'), [plan?.taskText, taskText]);
  const execBrainstorm = useMemo(() => brainstormStarterAngles(plan?.taskText || taskText || 'Current task'), [plan?.taskText, taskText]);
  const execPath = useMemo(() => synthesizeTaskPath(plan?.taskText || taskText || 'Current task'), [plan?.taskText, taskText]);

  const currentLang =
    voice.supportedLanguages.find((l) => l.code === voice.selectedLanguage) ||
    voice.supportedLanguages[0];

  const getStatusText = () => {
    if (quietMode) return 'Quiet Mode Active (Text Only)';
    if (!voice.isConnected) return 'Tap Orb or Say "Hey Stay" to Wake';
    if (voice.isHandsFreePaused) return 'Listening Paused · Say "Hey Stay" to Resume';
    switch (voice.visualState) {
      case 'connecting':
        return 'Connecting voice session...';
      case 'listening':
        return voice.partialUserTranscript ? 'Listening...' : 'Listening · Speak anytime';
      case 'thinking':
        return 'Finding the lightest first step...';
      case 'speaking':
        return 'Stay speaking...';
      case 'backchannel':
        return 'Listening closely...';
      default:
        return 'Ready · Tap or speak to start';
    }
  };

  return (
    <div className="relative min-h-[82vh] flex flex-col justify-between items-center rounded-3xl bg-radial from-canvas via-surface to-canvas p-4 sm:p-8 border border-line/80 shadow-2xl overflow-hidden">
      {/* Top Floating Control Bar */}
      <header className="w-full max-w-4xl flex flex-wrap items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-surface-recessed px-3 py-1.5 border border-line shadow-xs">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                !voice.isConnected
                  ? 'bg-ink-3'
                  : voice.isHandsFreePaused
                  ? 'bg-amber-500'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="text-xs font-semibold tracking-wide text-ink">
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
            className="chip text-[0.8rem] flex items-center gap-1.5 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
            title="Somatic Grounding & Box Breathing for acute overwhelm (Key: G)"
          >
            <span>🌿</span>
            <span className="font-medium hidden sm:inline">Ground Me</span>
          </button>

          {/* Named Voice Persona Pill (Tap to view personas or speak 'switch to Oliver') */}
          <button
            type="button"
            onClick={onOpenVoiceSelector}
            className="chip text-[0.78rem] flex items-center gap-1.5 border border-line bg-surface hover:bg-line transition-colors rounded-full px-2.5 py-1 text-ink font-medium"
            title="Voice Persona (Click to browse or say 'change voice to Oliver')"
            aria-label="Change Voice Persona"
          >
            <span>🎙️</span>
            <span className="capitalize">{voice.selectedVoice}</span>
          </button>

          {/* Multilingual 32-Language Status Pill */}
          <button
            type="button"
            onClick={() => {
              const next = voice.selectedLanguage === 'auto' ? 'en-GB' : 'auto';
              voice.setSelectedLanguage(next);
            }}
            className="chip text-[0.78rem] flex items-center gap-1.5 border border-line bg-surface hover:bg-line transition-colors rounded-full px-2.5 py-1 text-ink font-medium"
            title={`Language: ${currentLang?.label || 'Universal Auto'} (Say 'switch to Spanish', 'speak Hindi', or tap to toggle Auto)`}
            aria-label="Toggle language auto detection"
          >
            <span>{currentLang?.flag || '🌐'}</span>
            <span>{currentLang?.code === 'auto' ? 'Auto (32L)' : currentLang?.label}</span>
          </button>
        </div>

        {/* Center / Right Control Chips */}
        <div className="flex items-center gap-2">
          {onOpenHistory && (
            <button
              type="button"
              onClick={onOpenHistory}
              className="chip text-[0.8rem] flex items-center gap-1.5 border border-line hover:bg-line transition-colors"
              title="View session history and past transcripts (or say 'show history')"
            >
              <span>📜</span>
              <span className="font-medium hidden sm:inline">History</span>
              {typeof sessionCount === 'number' && (
                <span className="font-mono text-[0.72rem]">({sessionCount})</span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenMemory}
            className="chip text-[0.8rem] flex items-center gap-1.5 border border-accent/20 bg-accent/5 text-accent hover:bg-accent/10 transition-colors"
            title="Inspect Stay's persistent cognitive memory"
          >
            <span>🧬</span>
            <span className="font-medium hidden sm:inline">Memory</span>
            <span className="font-mono text-[0.72rem]">
              ({voice.userMemory.facts.length + voice.userMemory.recentSessionsSummary.length})
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenTraining}
            className="chip text-[0.8rem] flex items-center gap-1 border border-line hover:bg-line transition-colors"
            title="Self-improving model settings"
          >
            <span>🧠</span>
            <span className="hidden md:inline text-xs font-medium">Model</span>
          </button>

          <button
            type="button"
            onClick={onOpenAuth}
            className="chip text-[0.8rem] flex items-center gap-1.5 border border-line hover:bg-line transition-colors"
            title="Google Sign In & Cloud Sync"
          >
            <span>{userEmail ? '👤' : '🔐'}</span>
            <span className="hidden sm:inline font-medium">
              {userEmail ? userEmail.split('@')[0] : 'Sign in'}
            </span>
          </button>

          <button
            type="button"
            onClick={onSwitchToWorkspace}
            className="chip text-[0.8rem] border border-line hover:bg-line transition-colors"
            title="Switch to detailed grid workspace view"
            data-testid="switch-to-grid"
          >
            <span className="hidden sm:inline">Grid View</span>
            <span className="sm:hidden">Grid</span>
          </button>
        </div>
      </header>

      {/* Main Living Centerpiece: The Living AGI Orb */}
      <main className="relative my-auto flex flex-col items-center justify-center z-10 w-full max-w-xl py-6">
        {/* Glow halo & ambient aura */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-[320px] sm:w-[420px] h-[320px] sm:h-[420px] rounded-full blur-3xl transition-opacity duration-700 ${
              voice.visualState === 'speaking'
                ? 'bg-accent/25 opacity-100 scale-105'
                : voice.visualState === 'listening'
                ? 'bg-emerald-500/15 opacity-80 animate-pulse'
                : voice.visualState === 'thinking'
                ? 'bg-purple-500/20 opacity-80'
                : 'bg-accent/10 opacity-40'
            }`}
          />
        </div>

        {/* The 3D GLSL Marvel Eternity Wave Orb */}
        <button
          type="button"
          onClick={() => {
            if (!voice.isConnected) {
              voice.startVoiceSession();
            } else {
              voice.toggleHandsFreeMute();
            }
          }}
          className="relative mx-auto flex items-center justify-center w-[260px] sm:w-[320px] h-[260px] sm:h-[320px] rounded-full cursor-pointer group outline-none focus:outline-none ring-0 focus-visible:ring-0 transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98] select-none border-0 bg-transparent p-0"
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
            className="w-full h-full filter drop-shadow-2xl"
          />

          {/* Living Pulsing Rings around the Orb */}
          {voice.isConnected && !voice.isHandsFreePaused && (
            <div className="absolute inset-0 rounded-full border-2 border-accent/30 animate-ping pointer-events-none" />
          )}

          {/* Ambient outer circular halo boundary */}
          <div className="absolute -inset-2 rounded-full border border-accent/15 pointer-events-none" />

          {/* Center Play/Pause Overlay indicator on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="rounded-full bg-black/60 text-white px-3 py-1.5 text-xs font-semibold backdrop-blur-xs shadow-md">
              {!voice.isConnected ? 'Wake Voice' : voice.isHandsFreePaused ? 'Resume' : 'Pause'}
            </span>
          </div>
        </button>

        {/* Status text subtitle & Morph Resonance Pill */}
        <div className="mt-4 text-center flex flex-col items-center gap-2">
          {voice.topicShape > 0 && TOPIC_SHAPE_LABELS[voice.topicShape] && (
            <span
              data-testid="orb-morph-badge"
              data-topic-shape={voice.topicShape}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 border border-accent/35 px-3.5 py-1 text-xs font-semibold text-accent shadow-xs animate-fadeIn"
            >
              <span>{TOPIC_SHAPE_LABELS[voice.topicShape].icon}</span>
              <span>{TOPIC_SHAPE_LABELS[voice.topicShape].label}</span>
            </span>
          )}

          {/* Interactive Live Shape Morph Selector (Auto-morphs on speech/typing or click to preview) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5" data-testid="orb-shape-switcher">
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
                className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium transition-all flex items-center gap-1 border ${
                  voice.topicShape === s.id
                    ? 'bg-accent text-white border-accent shadow-xs scale-105'
                    : 'bg-surface/70 text-ink-2 border-line hover:border-accent/40'
                }`}
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          <p className="text-sm font-medium text-ink transition-colors">{getStatusText()}</p>
          <p className="text-[0.76rem] text-ink-3">
            Speak messy thoughts, ramble, or command: &ldquo;I&apos;m stuck&rdquo; · &ldquo;Show me memory&rdquo; · &ldquo;Show chat history&rdquo; · &ldquo;Start 20m&rdquo;
          </p>
        </div>

        {/* Active Timer Halo Bar */}
        {running && (
          <div className="mt-5 w-full max-w-xs rounded-2xl bg-surface p-3 border border-accent/30 shadow-lg flex items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-accent animate-ping" />
              <div>
                <span className="text-xs text-ink-3 block">Focus Block</span>
                <span className="font-mono text-lg font-bold text-ink">{formatClock(remaining)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowOutcomeDialog(true)}
                className="btn btn-primary py-1 px-3 text-xs"
              >
                Log Done
              </button>
              <button
                type="button"
                onClick={onStopTimer}
                className="btn btn-secondary py-1 px-2.5 text-xs"
                title="Cancel timer"
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {/* Floating ADHD First-Step Card */}
        {plan && !running && (
          <div className="mt-5 w-full max-w-md rounded-2xl bg-surface/95 backdrop-blur-md p-4 sm:p-5 border border-line shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-[0.75rem] font-semibold text-accent border border-accent/20">
                {plan.strategyLabel}
              </span>
              <span className="text-xs font-mono text-ink-3">{timerMinutes}m sprint</span>
            </div>

            <p className="mt-2 text-[0.95rem] font-medium text-ink leading-snug" data-testid="orb-first-step">
              {plan.firstStep}
            </p>

            {/* Compact Executive Engine Pills (Calculate · Brainstorm · Path) */}
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
              <button
                type="button"
                onClick={() => setOrbExecTab(orbExecTab === 'reality' ? null : 'reality')}
                aria-pressed={orbExecTab === 'reality'}
                className="chip text-[0.72rem] py-0.5 px-2"
                data-testid="orb-exec-reality"
              >
                ⏱️ Reality (~{execReality.perceivedMinutes}m → {execReality.microEntrySeconds}s)
              </button>
              <button
                type="button"
                onClick={() => setOrbExecTab(orbExecTab === 'brainstorm' ? null : 'brainstorm')}
                aria-pressed={orbExecTab === 'brainstorm'}
                className="chip text-[0.72rem] py-0.5 px-2"
                data-testid="orb-exec-brainstorm"
              >
                💡 3 Angles
              </button>
              <button
                type="button"
                onClick={() => setOrbExecTab(orbExecTab === 'path' ? null : 'path')}
                aria-pressed={orbExecTab === 'path'}
                className="chip text-[0.72rem] py-0.5 px-2"
                data-testid="orb-exec-path"
              >
                🧭 3-Phase Path
              </button>
            </div>

            {orbExecTab === 'reality' && (
              <div className="mt-2.5 rounded-xl bg-surface-recessed p-2.5 text-[0.76rem] text-ink-2" data-testid="orb-panel-reality">
                <div className="flex items-center justify-between font-mono text-xs text-ink font-semibold mb-1">
                  <span>Dread: ~{execReality.perceivedMinutes}m</span>
                  <span className="text-accent">Entry: {execReality.microEntrySeconds}s</span>
                  <span className="text-emerald-700 dark:text-emerald-400">{execReality.inertiaBreakRate}% momentum</span>
                </div>
                <p className="leading-snug">{execReality.neuroInsight}</p>
              </div>
            )}

            {orbExecTab === 'brainstorm' && (
              <div className="mt-2.5 grid gap-1.5" data-testid="orb-panel-brainstorm">
                {execBrainstorm.angles.map((angle, idx) => (
                  <button
                    key={angle.id}
                    type="button"
                    onClick={() => onSelectFirstStep?.(angle.prompt, angle.name)}
                    className="text-left rounded-lg border border-line bg-surface-recessed p-2 hover:border-accent transition-colors"
                    data-testid={`orb-angle-${idx}`}
                  >
                    <div className="flex items-center justify-between text-[0.78rem] font-semibold text-ink">
                      <span>{angle.name}</span>
                      <span className="font-mono text-[0.68rem] text-accent">~{angle.timeSeconds}s</span>
                    </div>
                    <p className="text-[0.74rem] text-ink-2 leading-snug mt-0.5">{angle.prompt}</p>
                  </button>
                ))}
              </div>
            )}

            {orbExecTab === 'path' && (
              <div className="mt-2.5 space-y-1.5" data-testid="orb-panel-path">
                {execPath.phases.map((p) => (
                  <div key={p.phase} className="rounded-lg bg-surface-recessed p-2 text-[0.76rem]">
                    <div className="flex items-center justify-between font-semibold text-ink">
                      <span>Phase {p.phase}: {p.name}</span>
                      <span className="font-mono text-[0.7rem] text-accent">{p.durationMinutes}m</span>
                    </div>
                    <p className="text-ink-2 leading-snug mt-0.5">{p.action}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStartTimer(timerMinutes)}
                className="btn btn-primary flex-1 py-2 text-xs font-semibold"
                data-testid="start-halo-timer"
              >
                Start {timerMinutes}-Minute Sprint
              </button>
              <button
                type="button"
                onClick={() => {
                  voice.sendUserTextMessage('Break this down even smaller please');
                }}
                className="btn btn-secondary py-2 px-3 text-xs"
                title="Make this step even smaller"
              >
                Smaller
              </button>
            </div>
          </div>
        )}

        {/* Zero-Friction ADHD Brain-Dump & Freeze Rescue Hooks when Idle */}
        {!plan && !running && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-lg">
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
                className="chip text-[0.74rem] py-1 px-2.5 bg-surface/80 hover:bg-surface transition-colors"
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {/* Real-Time NLU Comprehension Chips */}
        {voice.streamingAnalysis && (voice.partialUserTranscript || voice.visualState === 'listening') && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {voice.streamingAnalysis.detectedTask && (
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[0.72rem] font-medium text-accent border border-accent/20">
                Task: <strong>{voice.streamingAnalysis.detectedTask}</strong>
              </span>
            )}
            <span className="rounded-full bg-surface px-2.5 py-0.5 text-[0.72rem] font-medium text-ink-2 border border-line">
              Barrier: {BARRIER_DEFINITIONS[voice.streamingAnalysis.detectedBarrier as BarrierType]?.label || voice.streamingAnalysis.detectedBarrier}
            </span>
          </div>
        )}
      </main>

      {/* Bottom Floating Transcript Stream & Multimodal Input */}
      <footer className="w-full max-w-2xl flex flex-col gap-2 z-20">
        {actionReceipt && (
          <div className="mx-auto rounded-full bg-surface-recessed px-3 py-1 text-xs text-accent font-mono border border-line shadow-xs animate-fadeIn">
            ✓ {actionReceipt}
          </div>
        )}

        {/* Floating Captions Area */}
        <div className="max-h-24 overflow-y-auto px-4 py-2 text-center text-xs text-ink-2 space-y-1">
          {voice.partialUserTranscript && (
            <p className="italic text-ink font-medium animate-fadeIn">
              &ldquo;{voice.partialUserTranscript}&rdquo;
            </p>
          )}
          {voice.transcripts.length > 0 && !voice.partialUserTranscript && (
            <p className="text-ink-2 truncate">
              <strong className="text-accent">
                {voice.transcripts[voice.transcripts.length - 1].role === 'user' ? 'You' : 'Stay'}:
              </strong>{' '}
              {voice.transcripts[voice.transcripts.length - 1].text}
            </p>
          )}
        </div>

        {/* Seamless Voice/Text Hybrid Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const clean = typedMessage.trim();
            if (!clean) return;
            setTypedMessage('');
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
          className="flex items-center gap-2 bg-surface/90 backdrop-blur-md p-1.5 rounded-full border border-line shadow-lg"
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
                ? 'bg-accent text-white shadow-xs'
                : 'bg-surface-recessed text-ink-2 hover:bg-line'
            }`}
            title="Toggle mic"
          >
            {voice.isConnected && !voice.isHandsFreePaused ? '🎙️' : '🎤'}
          </button>

          <input
            type="text"
            className="flex-1 bg-transparent px-3 py-1 text-xs sm:text-sm text-ink outline-hidden"
            data-testid="task-input"
            placeholder={
              voice.isConnected
                ? 'Speak naturally or type a reply...'
                : 'Type task or press Spacebar to talk...'
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
            className="btn btn-primary py-1.5 px-3.5 text-xs rounded-full disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </footer>

      {/* Outcome Selection Dialog */}
      {showOutcomeDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-sm p-5 bg-surface border border-line shadow-2xl">
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
