'use client';

import { useState } from 'react';
import { Signal } from '@/components/Signal';
import type { CoachPlanProposal, SessionOutcome, BarrierType } from '@/types/domain';
import { BARRIER_DEFINITIONS } from '@/lib/coach/strategies';
import type { UseVoiceAgentReturn } from '@/lib/voice/useVoiceAgent';

interface OrbCompanionViewProps {
  voice: UseVoiceAgentReturn;
  taskText: string;
  onTaskTextChange: (t: string) => void;
  onTaskSubmit?: (t: string) => void;
  plan: CoachPlanProposal | null;
  running: boolean;
  remaining: number;
  timerMinutes: number;
  onStartTimer: (mins: number) => void;
  onStopTimer: () => void;
  onLogOutcome: (outcome: SessionOutcome) => void;
  onOpenMemory: () => void;
  onOpenTraining: () => void;
  onOpenGrounding: () => void;
  onOpenAuth: () => void;
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
  plan,
  running,
  remaining,
  timerMinutes,
  onStartTimer,
  onStopTimer,
  onLogOutcome,
  onOpenMemory,
  onOpenTraining,
  onOpenGrounding,
  onOpenAuth,
  onToggleQuietMode,
  quietMode,
  onSwitchToWorkspace,
  actionReceipt,
  userEmail,
}: OrbCompanionViewProps) {
  const [typedMessage, setTypedMessage] = useState('');
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);

  const getStatusText = () => {
    if (quietMode) return 'Quiet Mode Active (Text Only)';
    if (!voice.isConnected) return 'Tap Orb or Say "Hey Stay" to Wake';
    if (voice.isHandsFreePaused) return 'Listening Paused · Say "Hey Stay" to Resume';
    switch (voice.visualState) {
      case 'connecting':
        return 'Connecting Living AGI...';
      case 'listening':
        return voice.partialUserTranscript ? 'Comprehending speech...' : 'Living 24/7 · Listening for task';
      case 'thinking':
        return 'Analyzing ADHD barrier & first step...';
      case 'speaking':
        return 'Stay speaking...';
      case 'backchannel':
        return 'Attentive body-double listening...';
      default:
        return 'Living 24/7 Companion Ready';
    }
  };

  return (
    <div className="relative min-h-[82vh] flex flex-col justify-between items-center rounded-3xl bg-radial from-canvas via-surface to-canvas p-4 sm:p-8 border border-line/80 shadow-2xl overflow-hidden">
      {/* Top Floating Living AGI Control Bar */}
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
                  : 'LIVING 24/7 ACTIVE'
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
        </div>

        {/* Center / Right Control Chips */}
        <div className="flex items-center gap-2">
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
        <div
          onClick={() => {
            if (!voice.isConnected) {
              voice.startVoiceSession();
            } else {
              voice.toggleHandsFreeMute();
            }
          }}
          className="relative cursor-pointer group transition-transform duration-300 hover:scale-[1.02] active:scale-[0.98]"
          title={
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
            className="w-[260px] sm:w-[320px] h-[260px] sm:h-[320px] mx-auto filter drop-shadow-2xl"
          />

          {/* Living Pulsing Rings around the Orb */}
          {voice.isConnected && !voice.isHandsFreePaused && (
            <div className="absolute inset-0 rounded-full border border-accent/20 animate-ping pointer-events-none" />
          )}

          {/* Center Play/Pause Overlay indicator on hover */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="rounded-full bg-black/60 text-white px-3 py-1 text-xs font-semibold backdrop-blur-xs">
              {!voice.isConnected ? 'Wake Voice' : voice.isHandsFreePaused ? 'Resume' : 'Pause'}
            </span>
          </div>
        </div>

        {/* Status text subtitle */}
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-ink transition-colors">{getStatusText()}</p>
          <p className="text-[0.78rem] text-ink-3 mt-1">
            Hands-free voice: &ldquo;Stay pause&rdquo; · &ldquo;Hey Stay&rdquo; · &ldquo;Start 20m&rdquo; · &ldquo;Stay ground me&rdquo;
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

            <p className="mt-2 text-[0.95rem] font-medium text-ink leading-snug">
              {plan.firstStep}
            </p>

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
            if (onTaskSubmit) {
              onTaskSubmit(clean);
            } else {
              onTaskTextChange(clean);
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
            onChange={(e) => setTypedMessage(e.target.value)}
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
