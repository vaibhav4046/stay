'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import type { VoiceVisualState } from '@/types/domain';

const SignalScene = dynamic(() => import('./SignalScene'), {
  ssr: false,
  loading: () => <SignalFallbackSvg state="idle" />,
});

export const STATE_LABELS: Record<VoiceVisualState, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  interrupted: 'Go ahead',
  saving: 'Saving',
  complete: 'Logged',
  error: 'Voice unavailable',
};

const FALLBACK_COLOR: Record<VoiceVisualState, string> = {
  idle: '#006A67',
  connecting: '#626B66',
  listening: '#006A67',
  thinking: '#3C7F7C',
  speaking: '#006A67',
  interrupted: '#9A6318',
  saving: '#626B66',
  complete: '#236B48',
  error: '#B23A2E',
};

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function SignalFallbackSvg({ state, energy = 0 }: { state: VoiceVisualState; energy?: number }) {
  const r = 34 + energy * 4;
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" data-testid="signal-fallback">
      <g className={state === 'idle' || state === 'listening' ? 'breathe' : ''} style={{ transformOrigin: '60px 60px' }}>
        <circle cx="54" cy="60" r={r} fill="none" stroke="#212422" strokeWidth="4" />
        <circle cx="66" cy="60" r="20" fill="none" stroke={FALLBACK_COLOR[state]} strokeWidth="4" />
      </g>
      <line x1="10" y1="60" x2="110" y2="60" stroke="#212422" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Signal({
  state,
  energy,
  className = '',
}: {
  state: VoiceVisualState;
  energy: number;
  className?: string;
}) {
  const [mode, setMode] = useState<'pending' | 'webgl' | 'svg'>('pending');
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    setMode(hasWebGL() ? 'webgl' : 'svg');
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const onUnsupported = useCallback(() => setMode('svg'), []);

  return (
    <div className={`relative ${className}`} data-signal-state={state}>
      <div className="aspect-square w-full">
        {mode === 'webgl' ? (
          <SignalScene state={state} energy={energy} reducedMotion={reducedMotion} onUnsupported={onUnsupported} />
        ) : (
          <SignalFallbackSvg state={state} energy={energy} />
        )}
      </div>
      <p className="meta text-center mt-1" role="status" aria-live="polite" data-testid="signal-state-label">
        {STATE_LABELS[state]}
      </p>
    </div>
  );
}
