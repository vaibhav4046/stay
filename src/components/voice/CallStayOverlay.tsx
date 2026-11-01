'use client';

import { useEffect, useRef, useState } from 'react';
import type { VoiceVisualState } from '@/types/domain';
import { SubtleOrb } from '@/components/voice/SubtleOrb';
import { NUDGE_INSTRUCTIONS, WRAP_INSTRUCTION, formatClock, nextCallAction } from '@/lib/voice/callMode';

export interface CallVoice {
  visualState: VoiceVisualState;
  partialUserTranscript: string;
  isHandsFreePaused: boolean;
  toggleHandsFreeMute: () => void;
  speakProactively: (instructions: string) => boolean;
  disconnectVoiceSession: () => void;
}

const STATE_LABEL: Partial<Record<VoiceVisualState, string>> = {
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  listening: 'Listening',
  transcribing: 'Listening',
  backchannel: 'Listening',
  interrupted: 'Listening',
  thinking: 'Thinking',
  speaking: 'Stay is speaking',
  paused: 'You are muted',
};

/** Time Stay needs to say its closing line before the call ends. */
const WRAP_GRACE_MS = 7_000;

/**
 * Full-screen call. Stay already opens the session with its own greeting; this adds what makes it a call:
 * a running clock, mute, an end button, and Stay checking in (at most twice) if the line goes quiet.
 */
export function CallStayOverlay({ voice, onEnd }: { voice: CallVoice; onEnd: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(Date.now());
  const lastActivity = useRef(Date.now());
  const nudges = useRef(0);
  const wrapping = useRef(false);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const endRef = useRef<HTMLButtonElement>(null);

  // anyone speaking, or Stay finishing a reply, restarts the quiet timer
  useEffect(() => {
    lastActivity.current = Date.now();
  }, [voice.visualState, voice.partialUserTranscript]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (wrapping.current) return;
      const v = voiceRef.current;
      const action = nextCallAction({
        elapsedMs: t - startedAt.current,
        silentMs: t - lastActivity.current,
        nudgesSent: nudges.current,
        listening: v.visualState === 'listening' && !v.isHandsFreePaused,
      });
      if (action === 'nudge') {
        v.speakProactively(NUDGE_INSTRUCTIONS[nudges.current]);
        nudges.current += 1;
        lastActivity.current = t;
      } else if (action === 'wrap') {
        wrapping.current = true;
        v.speakProactively(WRAP_INSTRUCTION);
        window.setTimeout(onEnd, WRAP_GRACE_MS);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [onEnd]);

  useEffect(() => {
    endRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onEnd();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnd]);

  const label = voice.isHandsFreePaused ? STATE_LABEL.paused : STATE_LABEL[voice.visualState] ?? 'Connected';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Call with Stay"
      data-testid="call-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between px-6 py-12"
      style={{ background: 'var(--bg)', color: 'var(--ink)' }}
    >
      <div className="text-center">
        <p className="text-sm" style={{ color: 'var(--ink-2)' }}>Call with Stay</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums" data-testid="call-clock">
          {formatClock(now - startedAt.current)}
        </p>
      </div>

      <div className="flex flex-col items-center gap-5">
        <SubtleOrb state={voice.isHandsFreePaused ? 'paused' : voice.visualState} size={96} />
        <p aria-live="polite" className="text-lg" data-testid="call-state">{label}</p>
        <p className="min-h-[3rem] max-w-md text-center text-base" style={{ color: 'var(--ink-2)' }}>
          {voice.partialUserTranscript}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-secondary px-5 py-3" onClick={voice.toggleHandsFreeMute} data-testid="call-mute">
          {voice.isHandsFreePaused ? 'Unmute' : 'Mute'}
        </button>
        <button
          ref={endRef}
          type="button"
          className="btn px-5 py-3 text-white"
          style={{ background: 'var(--danger)' }}
          onClick={onEnd}
          data-testid="call-end"
        >
          End call
        </button>
      </div>
      <p className="mt-4 text-xs" style={{ color: 'var(--ink-2)' }}>
        Voice goes to AssemblyAI to be transcribed and spoken. Headphones work best.
      </p>
    </div>
  );
}
