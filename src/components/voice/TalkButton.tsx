'use client';

import type { VoiceVisualState } from '@/types/domain';
import { SignalWave } from '@/components/signal/SignalWave';

export interface TalkButtonProps {
  visualState: VoiceVisualState;
  isConnected: boolean;
  isHandsFreePaused?: boolean;
  onToggleVoice: () => void;
  onToggleHandsFreeMute?: () => void;
  className?: string;
}

function labelFor(state: VoiceVisualState, connected: boolean, paused: boolean): string {
  if (!connected) return state === 'connecting' ? 'Connecting' : 'Talk';
  if (paused) return 'Paused';
  if (state === 'speaking') return 'Speaking';
  if (state === 'thinking') return 'Thinking';
  if (state === 'interrupted') return 'Interrupted';
  if (state === 'connecting' || state === 'reconnecting') return 'Connecting';
  if (state === 'error') return 'Voice off';
  return 'Listening';
}

/** The composer's Talk control: a mic and the state in one word; once live, the real signal wave (flat until there is real sound). */
export function TalkButton({ visualState, isConnected, isHandsFreePaused = false, onToggleVoice, onToggleHandsFreeMute, className = '' }: TalkButtonProps) {
  const live = isConnected && visualState !== 'error' && !isHandsFreePaused;
  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border bg-surface-2 px-1 transition-shadow duration-300 ${
        live ? 'border-transparent shadow-[0_0_0_1.5px_rgba(143,211,255,0.55),0_6px_24px_-6px_rgba(62,143,214,0.55)]' : 'border-line'
      } ${className}`}
    >
      <button
        type="button"
        onClick={onToggleVoice}
        aria-label={isConnected ? 'End live voice' : 'Start live voice'}
        aria-pressed={isConnected}
        data-testid="mic-button"
        className="group flex h-11 items-center gap-1.5 rounded-full px-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-accent transition-transform duration-200 group-hover:scale-110">
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        {isConnected && <SignalWave state={visualState} height={24} className="hidden w-10 sm:block" />}
        <span className="min-w-[2.9rem] text-left text-xs font-medium tracking-wide text-ink">{labelFor(visualState, isConnected, isHandsFreePaused)}</span>
      </button>

      {isConnected && onToggleHandsFreeMute && (
        <button
          type="button"
          onClick={onToggleHandsFreeMute}
          aria-label={isHandsFreePaused ? 'Resume auto microphone' : 'Pause auto microphone'}
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {isHandsFreePaused ? <polygon points="6 3 20 12 6 21" /> : (<><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>)}
          </svg>
        </button>
      )}
    </div>
  );
}
