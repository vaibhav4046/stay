'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useId, useState } from 'react';
import type { VoiceVisualState } from '@/types/domain';

const SignalScene = dynamic(() => import('./SignalScene'), {
  ssr: false,
  loading: () => <SignalFallbackSvg state="idle" />,
});

export const STATE_LABELS: Record<VoiceVisualState, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting voice session',
  listening: 'Listening',
  thinking: 'Finding a smaller first step',
  speaking: 'Speaking',
  interrupted: 'Listening again',
  backchannel: 'Listening closely',
  saving: 'Saving progress',
  complete: 'Focus block logged',
  error: 'Voice unavailable',
};

const FALLBACK_COLOR: Record<
  VoiceVisualState,
  { primary: string; secondary: string; wave: string; halo: string }
> = {
  idle: { primary: '#0B625B', secondary: '#063D39', wave: '#ABD5C8', halo: '#84B9AB' },
  connecting: { primary: '#627570', secondary: '#3E514D', wave: '#D0DED7', halo: '#A8BDB5' },
  listening: { primary: '#087068', secondary: '#064640', wave: '#B9E2D4', halo: '#80B7A8' },
  thinking: { primary: '#28645D', secondary: '#174943', wave: '#C0DBD1', halo: '#91B7AC' },
  speaking: { primary: '#08766C', secondary: '#044B45', wave: '#D6EADF', halo: '#82C1B0' },
  interrupted: { primary: '#89673D', secondary: '#5B4228', wave: '#EAD0A7', halo: '#C9A46E' },
  backchannel: { primary: '#1A6E60', secondary: '#0B4B42', wave: '#C8E2D6', halo: '#8ABFAF' },
  saving: { primary: '#69736D', secondary: '#454D48', wave: '#DAE0D9', halo: '#B7C0B8' },
  complete: { primary: '#34764B', secondary: '#1D5134', wave: '#D1E7CA', halo: '#90C39A' },
  error: { primary: '#914D42', secondary: '#632F29', wave: '#F0C0B4', halo: '#CB8C7F' },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function makeWavePath(row: number, energy: number, state: VoiceVisualState): string {
  const active = ['listening', 'speaking', 'backchannel', 'interrupted'].includes(state);
  const amplitude = (1.4 + energy * 6.4) * (active ? 1 : 0.55);
  const baseY = 43.5 + row * 8.2;
  let path = 'M 20 ' + baseY.toFixed(2);

  for (let x = 23; x <= 100; x += 3) {
    const progress = (x - 20) / 80;
    const primary = Math.sin(progress * 8.1 + row * 0.63 + energy * 2.8);
    const secondary = Math.sin(progress * 15.2 - row * 0.37 - energy * 4.1) * 0.22;
    const y = baseY + primary * amplitude + secondary * amplitude;
    path += ' L ' + x + ' ' + y.toFixed(2);
  }

  return path;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Lightweight fallback: contour currents subtly change shape with voice energy. */
export function SignalFallbackSvg({
  state,
  energy = 0,
}: {
  state: VoiceVisualState;
  energy?: number;
}) {
  const id = useId().replace(/:/g, '');
  const colors = FALLBACK_COLOR[state] || FALLBACK_COLOR.idle;
  const level = clamp01(energy);
  const active = ['listening', 'speaking', 'backchannel', 'interrupted'].includes(state);
  const radius = 34.5 + (active ? level * 1.4 : 0);
  const haloOpacity = 0.1 + level * 0.13;

  return (
    <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true" data-testid="signal-fallback">
      <defs>
        <radialGradient id={id + '-halo'} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={colors.halo} stopOpacity={haloOpacity} />
          <stop offset="72%" stopColor={colors.halo} stopOpacity="0.035" />
          <stop offset="100%" stopColor={colors.halo} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id + '-orb'} cx="32%" cy="24%" r="82%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="60%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </radialGradient>
        <linearGradient id={id + '-sheen'} x1="0%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.24" />
          <stop offset="48%" stopColor="#FFFFFF" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#082D2A" stopOpacity="0.18" />
        </linearGradient>
        <clipPath id={id + '-clip'}>
          <circle cx="60" cy="60" r={radius} />
        </clipPath>
      </defs>

      <circle cx="60" cy="60" r="51" fill={'url(#' + id + '-halo)'} />
      <circle
        cx="60"
        cy="60"
        r={radius + 4.2}
        fill="none"
        stroke={colors.halo}
        strokeOpacity="0.28"
        strokeWidth="0.65"
      />
      <circle cx="60" cy="60" r={radius} fill={'url(#' + id + '-orb)'} />
      <g clipPath={'url(#' + id + '-clip)'}>
        <rect x="20" y="20" width="80" height="80" fill={'url(#' + id + '-sheen)'} />
        {[-2, -1, 0, 1, 2].map((row) => (
          <g key={row}>
            <path
              d={makeWavePath(row, level, state)}
              fill="none"
              stroke={colors.wave}
              strokeWidth={row === 0 ? 2.5 : 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.08 + level * (row === 0 ? 0.26 : 0.16)}
              transform="translate(0 0.8)"
            />
            <path
              d={makeWavePath(row, level, state)}
              fill="none"
              stroke={colors.wave}
              strokeWidth={row === 0 ? 1.1 : 0.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.28 + level * (row === 0 ? 0.52 : 0.32)}
            />
          </g>
        ))}
        <ellipse
          cx="47"
          cy="37"
          rx="13"
          ry="6"
          fill="#FFFFFF"
          opacity="0.12"
          transform="rotate(-32 47 37)"
        />
      </g>
      <circle cx="60" cy="60" r={radius} fill="none" stroke="#FFFFFF" strokeOpacity="0.13" strokeWidth="0.8" />
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
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setReducedMotion(query.matches);
    updateMotionPreference();
    query.addEventListener('change', updateMotionPreference);
    setMode(hasWebGL() ? 'webgl' : 'svg');

    return () => query.removeEventListener('change', updateMotionPreference);
  }, []);

  const onUnsupported = useCallback(() => setMode('svg'), []);

  return (
    <div className={'relative ' + className} data-signal-state={state}>
      <div className="aspect-square w-full">
        {mode === 'webgl' ? (
          <SignalScene state={state} energy={clamp01(energy)} reducedMotion={reducedMotion} onUnsupported={onUnsupported} />
        ) : (
          <SignalFallbackSvg state={state} energy={energy} />
        )}
      </div>
      <p className="meta mt-1 text-center" role="status" aria-live="polite" data-testid="signal-state-label">
        {STATE_LABELS[state]}
      </p>
    </div>
  );
}
