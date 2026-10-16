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
 * ChatGPT Voice Wavy Liquid Orb SVG Fallback with Marvel 'Eternity' Cosmic Interior.
 * Renders a circular clip with the iconic ChatGPT undulating fluid horizon, celestial stardust,
 * inner radiant core singularity, and specular glass rim.
 */
export function SignalFallbackSvg({ state, energy = 0 }: { state: VoiceVisualState; energy?: number }) {
  const col = FALLBACK_COLOR[state] || FALLBACK_COLOR.idle;
  const radius = 40 + energy * 4;
  const glowRadius = 54 + energy * 8;
  const waveShift = energy * 6;

  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" data-testid="signal-fallback">
      <defs>
        {/* Ambient Halo */}
        <radialGradient id={`halo-${state}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={col.glow} stopOpacity="0.55" />
          <stop offset="60%" stopColor={col.primary} stopOpacity="0.18" />
          <stop offset="100%" stopColor={col.secondary} stopOpacity="0" />
        </radialGradient>

        {/* Circular Orb Clip Path */}
        <clipPath id={`orb-clip-${state}`}>
          <circle cx="60" cy="60" r={radius} />
        </clipPath>

        {/* Upper Cosmic Universe Gradient (Eternity) */}
        <radialGradient id={`cosmic-${state}`} cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor={col.glow} stopOpacity="0.9" />
          <stop offset="45%" stopColor={col.primary} stopOpacity="1" />
          <stop offset="100%" stopColor={col.secondary} stopOpacity="1" />
        </radialGradient>

        {/* Lower ChatGPT Luminous Cream / Pearl Liquid Gradient */}
        <linearGradient id={`cream-liquid-${state}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#F0FDFA" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#CCFBF1" stopOpacity="0.85" />
        </linearGradient>

        {/* Inner Radiant Core Singularity */}
        <radialGradient id={`core-singularity-${state}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="40%" stopColor={col.glow} stopOpacity="0.5" />
          <stop offset="100%" stopColor={col.glow} stopOpacity="0" />
        </radialGradient>

        {/* Specular Surface Glint */}
        <linearGradient id={`glint-${state}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Wave Crest Starlight Ribbon */}
        <linearGradient id={`crest-${state}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="50%" stopColor={col.glow} stopOpacity="1" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Outer Glow Aura Bloom */}
      <circle cx="60" cy="60" r={glowRadius} fill={`url(#halo-${state})`} />

      {/* Glass Orb Enclosure with Clipped Fluid Wave & Eternity Cosmos */}
      <g clipPath={`url(#orb-clip-${state})`}>
        {/* Upper Cosmic Nebula Background */}
        <rect x="15" y="15" width="90" height="90" fill={`url(#cosmic-${state})`} />

        {/* Eternity Celestial Stardust Points */}
        <circle cx="45" cy="38" r="1.1" fill="#FFFFFF" opacity="0.9" />
        <circle cx="72" cy="42" r="0.8" fill="#FFFFFF" opacity="0.8" />
        <circle cx="56" cy="30" r="0.9" fill="#E0F2FE" opacity="0.85" />
        <circle cx="38" cy="52" r="0.7" fill="#FFFFFF" opacity="0.75" />
        <circle cx="78" cy="56" r="1.0" fill="#E0F2FE" opacity="0.8" />
        <circle cx="64" cy="48" r="1.3" fill="#FFFFFF" opacity="0.95" />

        {/* Inner Radiant Star Singularity */}
        <circle cx="60" cy="58" r="28" fill={`url(#core-singularity-${state})`} />

        {/* Lower Fluid: ChatGPT Undulating Wave Horizon */}
        <path
          d={`M 15,${62 - waveShift} C 34,${54 - waveShift} 46,${70 + waveShift} 60,${62 - waveShift * 0.5} C 74,${54 - waveShift * 0.5} 86,${70 + waveShift} 105,${62 - waveShift} L 105,105 L 15,105 Z`}
          fill={`url(#cream-liquid-${state})`}
        />

        {/* Glowing Horizon Seam Ribbon */}
        <path
          d={`M 15,${62 - waveShift} C 34,${54 - waveShift} 46,${70 + waveShift} 60,${62 - waveShift * 0.5} C 74,${54 - waveShift * 0.5} 86,${70 + waveShift} 105,${62 - waveShift}`}
          fill="none"
          stroke={`url(#crest-${state})`}
          strokeWidth="1.5"
          opacity="0.85"
        />
      </g>

      {/* Glass Rim Sheen */}
      <circle
        cx="60"
        cy="60"
        r={radius - 0.5}
        fill="none"
        stroke={col.glow}
        strokeWidth="1.2"
        opacity="0.45"
      />

      {/* Surface Specular Highlight */}
      <ellipse
        cx="48"
        cy="45"
        rx={radius * 0.42}
        ry={radius * 0.24}
        fill={`url(#glint-${state})`}
        transform="rotate(-28 48 45)"
      />
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
