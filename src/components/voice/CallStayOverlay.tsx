'use client';

import { useEffect, useRef, useState } from 'react';
import type { AudioSpectrumBands, VoiceVisualState } from '@/types/domain';
import { Signal } from '@/components/Signal';
import { TransportBadge } from '@/components/voice/TransportBadge';
import type { VoiceTransportInfo } from '@/lib/voice/useVoiceAgent';
import { NUDGE_INSTRUCTIONS, WRAP_INSTRUCTION, formatClock, nextCallAction } from '@/lib/voice/callMode';
import { CALL_STYLE_INSTRUCTION, startTone } from '@/lib/voice/ringtone';

export interface CallVoice {
  visualState: VoiceVisualState;
  partialUserTranscript: string;
  isHandsFreePaused: boolean;
  toggleHandsFreeMute: () => void;
  speakProactively: (words: string) => boolean;
  instructProactively: (instructions: string) => boolean;
  injectContext: (content: string) => boolean;
  disconnectVoiceSession: () => void;
  audioEnergy: number;
  audioBands?: AudioSpectrumBands;
  transcripts: Array<{ id: string; role: string; text: string }>;
  /** the assistant's words as they are being rendered (word-synced to playback) */
  liveSpokenText: string;
  transportInfo: VoiceTransportInfo;
  replyTimes?: number[];
}

const STATE_LABEL: Partial<Record<VoiceVisualState, string>> = {
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  listening: 'Listening',
  transcribing: 'Listening',
  backchannel: 'Listening',
  interrupted: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  paused: 'You are muted',
};

/** Time Stay needs to say its closing line before the call ends. */
const WRAP_GRACE_MS = 7_000;

interface Props {
  voice: CallVoice;
  /** false while it is still ringing / connecting */
  connected: boolean;
  /** the voice the person picked, shown like a contact name */
  name: string;
  /** hold the ringback while another sheet (mic consent) is in front */
  paused?: boolean;
  onEnd: () => void;
}

/**
 * Full-screen call. It rings while the voice session connects, then shows a running clock, mute and end.
 * Stay already opens the session with its own greeting; this adds what makes it a call: the ringback tone,
 * a phone-style speaking style, and Stay checking in (at most twice) if the line goes quiet.
 */
export function CallStayOverlay({ voice, connected, name, paused = false, onEnd }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef<number | null>(null);
  const lastActivity = useRef(Date.now());
  const nudges = useRef(0);
  const wrapping = useRef(false);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const endRef = useRef<HTMLButtonElement>(null);
  const [captions, setCaptions] = useState(true);

  // ringback while we wait for the other end to pick up
  useEffect(() => {
    if (connected || paused) return;
    return startTone('ringback');
  }, [connected, paused]);

  // pick-up: start the clock, and tell Stay to talk like a person on a phone
  useEffect(() => {
    if (!connected) return;
    startedAt.current = Date.now();
    lastActivity.current = Date.now();
    voiceRef.current.injectContext(CALL_STYLE_INSTRUCTION);
  }, [connected]);

  // anyone speaking, or Stay finishing a reply, restarts the quiet timer
  useEffect(() => {
    lastActivity.current = Date.now();
  }, [voice.visualState, voice.partialUserTranscript]);

  useEffect(() => {
    if (!connected) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (wrapping.current || startedAt.current === null) return;
      const v = voiceRef.current;
      const action = nextCallAction({
        elapsedMs: t - startedAt.current,
        silentMs: t - lastActivity.current,
        nudgesSent: nudges.current,
        listening: v.visualState === 'listening' && !v.isHandsFreePaused,
      });
      if (action === 'nudge') {
        v.instructProactively(NUDGE_INSTRUCTIONS[nudges.current]);
        nudges.current += 1;
        lastActivity.current = t;
      } else if (action === 'wrap') {
        wrapping.current = true;
        v.instructProactively(WRAP_INSTRUCTION);
        window.setTimeout(onEnd, WRAP_GRACE_MS);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [connected, onEnd]);

  useEffect(() => {
    endRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onEnd();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEnd]);

  const label = !connected
    ? 'Ringing…'
    : voice.isHandsFreePaused
      ? STATE_LABEL.paused
      : STATE_LABEL[voice.visualState] ?? 'Connected';
  const signalState = !connected ? 'connecting' : voice.isHandsFreePaused ? 'paused' : voice.visualState;
  const lastUser = [...voice.transcripts].reverse().find((x) => x.role === 'user')?.text ?? '';
  const lastStay = [...voice.transcripts].reverse().find((x) => x.role === 'agent')?.text ?? '';
  const clock = connected && startedAt.current !== null ? formatClock(now - startedAt.current) : 'Calling…';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Call with ${name}`}
      data-testid="call-overlay"
      data-call-state={connected ? 'connected' : 'ringing'}
      className="fixed inset-0 z-40 flex flex-col items-center justify-between px-6"
      style={{ background: 'radial-gradient(900px 520px at 50% 22%, rgb(62 143 214 / 0.30), transparent 65%), radial-gradient(600px 400px at 100% 100%, rgb(255 255 255 / 0.05), transparent 60%), linear-gradient(180deg, #0A1018 0%, #05080C 60%, #03060A 100%)', color: 'var(--ink)', paddingTop: 'max(2.5rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
    >
      <div className="absolute right-4" style={{ top: 'max(1rem, env(safe-area-inset-top))' }}>
        <TransportBadge transport={voice.transportInfo} isConnected={connected} replyTimes={voice.replyTimes} />
      </div>
      <div className="text-center">
        <p className="text-2xl font-semibold" data-testid="call-name">{name}</p>
        <p className="mt-1 text-base tabular-nums" style={{ color: 'var(--ink-2)' }} data-testid="call-clock">
          {clock}
        </p>
      </div>

      <div className="flex flex-col items-center gap-5">
        {/* the same particle orb as the landing page */}
        <div className="h-[min(17rem,42vh)] w-[min(17rem,70vw)]" data-testid="call-orb">
          <Signal state={signalState} energy={connected && !voice.isHandsFreePaused ? voice.audioEnergy : 0} bands={connected && !voice.isHandsFreePaused ? voice.audioBands : undefined} hideLabel className="h-full w-full" />
        </div>
        <p aria-live="polite" className="text-lg" data-testid="call-state">{label}</p>
        {captions && connected && (
          <div className="min-h-[5.5rem] w-[min(32rem,88vw)] space-y-1 text-center" data-testid="call-captions">
            <p className="text-base" style={{ color: 'var(--ink-2)' }} data-testid="caption-user">{voice.partialUserTranscript || lastUser}</p>
            <p className="text-lg" data-testid="caption-stay">{voice.visualState === 'speaking' ? voice.liveSpokenText : lastStay}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          {connected && (
            <>
              <button type="button" className="btn btn-secondary px-5 py-3" onClick={voice.toggleHandsFreeMute} data-testid="call-mute">
                {voice.isHandsFreePaused ? 'Unmute' : 'Mute'}
              </button>
              <button type="button" className="btn btn-secondary px-5 py-3" aria-pressed={captions} onClick={() => setCaptions((c) => !c)} data-testid="call-captions-toggle">
                {captions ? 'Hide captions' : 'Show captions'}
              </button>
            </>
          )}
          <button
            ref={endRef}
            type="button"
            className="btn px-5 py-3 text-white"
            style={{ background: 'var(--danger-fill)' }}
            onClick={onEnd}
            data-testid="call-end"
          >
            {connected ? 'End call' : 'Cancel'}
          </button>
        </div>
        <p className="text-xs" style={{ color: 'var(--ink-2)' }}>
          Your voice goes to AssemblyAI to be transcribed and spoken. Headphones work best.
        </p>
      </div>
    </div>
  );
}
