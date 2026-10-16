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
  connecting: 'Connecting voice session',
  listening: 'Listening to your voice',
  thinking: 'Synthesizing strategy',
  speaking: 'Speaking',
  interrupted: 'Listening (interrupted)',
  backchannel: 'Listening closely',
  saving: 'Saving progress',
  complete: 'Focus block logged',
  error: 'Voice unavailable',
};

const FALLBACK_COLOR: Record<VoiceVisualState, { primary: string; secondary: string; glow: string }> = {
  idle: { primary: '#006A67', secondary: '#004D40', glow: '#38B2AC' },
  connecting: { primary: '#64748B', secondary: '#334155', glow: '#94A3B8' },
  listening: { primary: '#028090', secondary: '#005F5B', glow: '#00F5D4' },
  thinking: { primary: '#4338CA', secondary: '#312E81', glow: '#818CF8' },
  speaking: { primary: '#008080', secondary: '#005F5B', glow: '#70E000' },
  interrupted: { primary: '#B45309', secondary: '#78350F', glow: '#FBBF24' },
  backchannel: { primary: '#059669', secondary: '#064E3B', glow: '#34D399' },
  saving: { primary: '#4B5563', secondary: '#1F2937', glow: '#9CA3AF' },
  complete: { primary: '#16A34A', secondary: '#14532D', glow: '#86EFAC' },
  error: { primary: '#DC2626', secondary: '#7F1D1D', glow: '#FCA5A5' },
};

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * 3D Luminous Orb SVG fallback.
 * Renders a layered radial gradient sphere with specular highlight and ambient glow aura.
 */
export function SignalFallbackSvg({ state, energy = 0 }: { state: VoiceVisualState; energy?: number }) {
  const col = FALLBACK_COLOR[state] || FALLBACK_COLOR.idle;
  const radius = 38 + energy * 6;
  const glowRadius = 52 + energy * 10;

  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" data-testid="signal-fallback">
      <defs>
        {/* Ambient Halo */}
        <radialGradient id={`halo-${state}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={col.glow} stopOpacity="0.45" />
          <stop offset="70%" stopColor={col.primary} stopOpacity="0.12" />
          <stop offset="100%" stopColor={col.secondary} stopOpacity="0" />
        </radialGradient>

        {/* 3D Spherical Core Shading */}
        <radialGradient id={`orb-${state}`} cx="35%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="22%" stopColor={col.glow} stopOpacity="0.95" />
          <stop offset="65%" stopColor={col.primary} stopOpacity="1" />
          <stop offset="100%" stopColor={col.secondary} stopOpacity="1" />
        </radialGradient>

        {/* Specular Glint */}
        <linearGradient id={`glint-${state}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Outer Glow Aura */}
      <circle cx="60" cy="60" r={glowRadius} fill={`url(#halo-${state})`} />

      {/* Inner 3D Sphere */}
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill={`url(#orb-${state})`}
        className={state === 'listening' || state === 'speaking' || state === 'idle' ? 'breathe' : ''}
        style={{ transformOrigin: '60px 60px' }}
      />

      {/* Surface Specular Highlight */}
      <ellipse cx="48" cy="46" rx={radius * 0.45} ry={radius * 0.28} fill={`url(#glint-${state})`} transform="rotate(-25 48 46)" />
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
