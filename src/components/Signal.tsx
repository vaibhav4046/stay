'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import type { AudioSpectrumBands, VoiceVisualState } from '@/types/domain';

const SignalScene = dynamic(() => import('./SignalScene'), {
  ssr: false,
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

const SHAPE_PALETTES: Record<number, { primary: string; secondary: string; glow: string }> = {
  1: { primary: '#E11D48', secondary: '#881337', glow: '#FDA4AF' }, // Ice Cream / Sweet Reward (Strawberry Rose & Vanilla Cream)
  2: { primary: '#2563EB', secondary: '#1E3A8A', glow: '#60A5FA' }, // Crystalline Letterforms / Docs / Taxes (Sapphire Prism)
  3: { primary: '#9333EA', secondary: '#4C1D95', glow: '#E879F9' }, // Creative Ribbon / Music / Art (Magenta & Violet Vortex)
  4: { primary: '#0D9488', secondary: '#115E59', glow: '#5EEAD4' }, // Lotus Somatic Calm / Overwhelm Rescue (Jade & Golden Lotus)
};

function getSvgClipPathElement(topicShape: number, radius: number) {
  if (topicShape === 1) {
    // Mode 1: Ice Cream Cone + Triple Swirl Scoop Silhouette
    return (
      <path d="M 60,18 C 72,18 82,25 84,35 C 93,37 98,46 95,55 C 92,62 85,65 81,67 L 60,106 L 39,67 C 35,65 28,62 25,55 C 22,46 27,37 36,35 C 38,25 48,18 60,18 Z" />
    );
  }
  if (topicShape === 2) {
    // Mode 2: Crystalline Octagonal Diamond / Prism Letterform Silhouette
    return (
      <polygon points="60,14 86,24 104,50 96,82 60,106 24,82 16,50 34,24" />
    );
  }
  if (topicShape === 3) {
    // Mode 3: 5-Lobe Harmonic Creative Star / Infinity Wave Silhouette
    return (
      <path d="M 60,14 C 71,14 76,27 86,31 C 96,35 106,45 102,57 C 98,68 88,73 86,84 C 84,95 72,105 60,100 C 48,105 36,95 34,84 C 32,73 22,68 18,57 C 14,45 24,35 34,31 C 44,27 49,14 60,14 Z" />
    );
  }
  if (topicShape === 4) {
    // Mode 4: Sacred 8-Petal Meditative Lotus Blossom Silhouette
    return (
      <path d="M 60,12 C 69,22 75,26 85,24 C 86,35 92,41 103,47 C 96,57 96,65 102,75 C 91,79 86,86 84,97 C 73,93 67,96 60,106 C 53,96 47,93 36,97 C 34,86 29,79 18,75 C 24,65 24,57 17,47 C 28,41 34,35 35,24 C 45,26 51,22 60,12 Z" />
    );
  }
  return <circle cx="60" cy="60" r={radius} />;
}

function getSvgInteriorHologram(topicShape: number, glow: string) {
  if (topicShape === 1) {
    // Ice Cream Waffle Grid & Scoop Swirl Lines
    return (
      <g stroke="#FFFFFF" strokeOpacity="0.65" fill="none" strokeWidth="1.3">
        <path d="M 41,66 L 79,66 L 60,104 Z" fill="rgba(251, 191, 36, 0.25)" />
        <line x1="46" y1="66" x2="66" y2="92" />
        <line x1="56" y1="66" x2="72" y2="82" />
        <line x1="74" y1="66" x2="54" y2="92" />
        <line x1="64" y1="66" x2="48" y2="82" />
        <path d="M 34,52 Q 60,38 86,52" strokeWidth="2" stroke={glow} />
        <path d="M 40,38 Q 60,24 80,38" strokeWidth="1.8" stroke="#FFFFFF" />
        <circle cx="60" cy="24" r="4.5" fill="#FB7185" stroke="#FFFFFF" strokeWidth="1.2" />
      </g>
    );
  }
  if (topicShape === 2) {
    // Crystalline Document / Letterform Geometric Lattice & Lines
    return (
      <g stroke="#FFFFFF" strokeOpacity="0.7" fill="none" strokeWidth="1.2">
        <polygon points="60,20 82,30 94,52 86,78 60,98 34,78 26,52 38,30" stroke={glow} strokeOpacity="0.8" />
        <rect x="42" y="36" width="36" height="44" rx="3" fill="rgba(255,255,255,0.12)" stroke="#FFFFFF" strokeWidth="1.5" />
        <line x1="48" y1="45" x2="72" y2="45" strokeWidth="2" />
        <line x1="48" y1="53" x2="72" y2="53" strokeWidth="1.5" />
        <line x1="48" y1="61" x2="66" y2="61" strokeWidth="1.5" />
        <line x1="48" y1="69" x2="62" y2="69" strokeWidth="1.5" />
      </g>
    );
  }
  if (topicShape === 3) {
    // Dual Harmonic Spiral Ribbons & Musical/Creative Waveform
    return (
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.75">
        <path d="M 28,60 C 40,32 52,88 60,60 C 68,32 80,88 92,60" strokeWidth="2.2" stroke={glow} />
        <path d="M 28,60 C 40,88 52,32 60,60 C 68,88 80,32 92,60" strokeWidth="1.6" stroke="#FFFFFF" strokeDasharray="3 2" />
        <circle cx="60" cy="60" r="18" stroke={glow} strokeOpacity="0.5" strokeWidth="1.2" />
        <circle cx="60" cy="60" r="29" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="1" />
      </g>
    );
  }
  if (topicShape === 4) {
    // Sacred Concentric Somatic Lotus Ripples & Mandalas
    return (
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.75">
        <circle cx="60" cy="60" r="10" stroke="#FDE68A" strokeWidth="1.8" fill="rgba(253, 230, 138, 0.2)" />
        <circle cx="60" cy="60" r="20" stroke={glow} strokeWidth="1.5" strokeDasharray="4 3" />
        <circle cx="60" cy="60" r="30" stroke="#FFFFFF" strokeWidth="1.3" strokeOpacity="0.6" />
        <circle cx="60" cy="60" r="39" stroke={glow} strokeWidth="1.1" strokeOpacity="0.45" />
        <path d="M 60,30 C 68,45 68,75 60,90 C 52,75 52,45 60,30 Z" stroke="#FFFFFF" strokeOpacity="0.5" />
        <path d="M 30,60 C 45,52 75,52 90,60 C 75,68 45,68 30,60 Z" stroke="#FFFFFF" strokeOpacity="0.5" />
      </g>
    );
  }
  return null;
}

/**
 * ChatGPT Voice Wavy Liquid Orb SVG Fallback with Marvel 'Eternity' Cosmic Interior
 * and Distinct Topic-Morphing Silhouettes (Modes 0-4).
 */
export function SignalFallbackSvg({
  state,
  energy = 0,
  bands,
  topicShape = 0,
}: {
  state: VoiceVisualState;
  energy?: number;
  bands?: AudioSpectrumBands;
  topicShape?: number;
}) {
  const baseCol = FALLBACK_COLOR[state] || FALLBACK_COLOR.idle;
  const col = (topicShape > 0 && SHAPE_PALETTES[topicShape]) || baseCol;
  const lowEnergy = bands ? bands.low : energy;
  const highEnergy = bands ? bands.high : energy;
  const radius = 43 + lowEnergy * 5;
  const glowRadius = 55 + energy * 8 + highEnergy * 4;
  const waveShift = energy * 6 + lowEnergy * 3;
  const clipId = `orb-clip-${state}-${topicShape}`;

  return (
    <svg
      viewBox="0 0 120 120"
      className="h-full w-full transition-transform duration-500"
      aria-hidden="true"
      data-testid="signal-fallback"
      data-topic-shape={topicShape}
    >
      <defs>
        {/* Ambient Halo */}
        <radialGradient id={`halo-${clipId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={col.glow} stopOpacity="0.65" />
          <stop offset="60%" stopColor={col.primary} stopOpacity="0.22" />
          <stop offset="100%" stopColor={col.secondary} stopOpacity="0" />
        </radialGradient>

        {/* Dynamic Topic-Morphing Silhouette Clip Path */}
        <clipPath id={clipId}>
          {getSvgClipPathElement(topicShape, radius)}
        </clipPath>

        {/* Upper Cosmic Universe Gradient (Eternity) */}
        <radialGradient id={`cosmic-${clipId}`} cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor={col.glow} stopOpacity="0.92" />
          <stop offset="45%" stopColor={col.primary} stopOpacity="1" />
          <stop offset="100%" stopColor={col.secondary} stopOpacity="1" />
        </radialGradient>

        {/* Lower ChatGPT Luminous Cream / Pearl Liquid Gradient */}
        <linearGradient id={`cream-liquid-${clipId}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#F0FDFA" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#CCFBF1" stopOpacity="0.85" />
        </linearGradient>

        {/* Inner Radiant Core Singularity */}
        <radialGradient id={`core-singularity-${clipId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
          <stop offset="40%" stopColor={col.glow} stopOpacity="0.55" />
          <stop offset="100%" stopColor={col.glow} stopOpacity="0" />
        </radialGradient>

        {/* Specular Surface Glint */}
        <linearGradient id={`glint-${clipId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>

        {/* Wave Crest Starlight Ribbon */}
        <linearGradient id={`crest-${clipId}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="50%" stopColor={col.glow} stopOpacity="1" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* Outer Glow Aura Bloom */}
      <circle cx="60" cy="60" r={glowRadius} fill={`url(#halo-${clipId})`} />

      {/* Morphing Orb Enclosure with Clipped Fluid Wave, Hologram & Eternity Cosmos */}
      <g clipPath={`url(#${clipId})`}>
        {/* Upper Cosmic Nebula Background */}
        <rect x="8" y="8" width="104" height="104" fill={`url(#cosmic-${clipId})`} />

        {/* Eternity Celestial Stardust Points */}
        <circle cx="45" cy="38" r="1.1" fill="#FFFFFF" opacity="0.9" />
        <circle cx="72" cy="42" r="0.8" fill="#FFFFFF" opacity="0.8" />
        <circle cx="56" cy="30" r="0.9" fill="#E0F2FE" opacity="0.85" />
        <circle cx="38" cy="52" r="0.7" fill="#FFFFFF" opacity="0.75" />
        <circle cx="78" cy="56" r="1.0" fill="#E0F2FE" opacity="0.8" />
        <circle cx="64" cy="48" r="1.3" fill="#FFFFFF" opacity="0.95" />

        {/* Inner Radiant Star Singularity */}
        <circle cx="60" cy="56" r="30" fill={`url(#core-singularity-${clipId})`} />

        {/* Lower Fluid: ChatGPT Undulating Wave Horizon */}
        <path
          d={`M 10,${64 - waveShift} C 32,${54 - waveShift} 46,${72 + waveShift} 60,${64 - waveShift * 0.5} C 74,${54 - waveShift * 0.5} 88,${72 + waveShift} 110,${64 - waveShift} L 110,112 L 10,112 Z`}
          fill={`url(#cream-liquid-${clipId})`}
        />

        {/* Glowing Horizon Seam Ribbon */}
        <path
          d={`M 10,${64 - waveShift} C 32,${54 - waveShift} 46,${72 + waveShift} 60,${64 - waveShift * 0.5} C 74,${54 - waveShift * 0.5} 88,${72 + waveShift} 110,${64 - waveShift}`}
          fill="none"
          stroke={`url(#crest-${clipId})`}
          strokeWidth="1.8"
          opacity="0.9"
        />

        {/* Topic-Specific Geometric Hologram Inside the Orb */}
        {getSvgInteriorHologram(topicShape, col.glow)}
      </g>

      {/* Surface Specular Highlight */}
      <ellipse
        cx="48"
        cy="42"
        rx={radius * 0.36}
        ry={radius * 0.2}
        fill={`url(#glint-${clipId})`}
        transform="rotate(-28 48 42)"
      />
    </svg>
  );
}

export function Signal({
  state,
  energy,
  bands,
  topicShape = 0,
  hideLabel = false,
  className = '',
}: {
  state: VoiceVisualState;
  energy: number;
  bands?: AudioSpectrumBands;
  topicShape?: number;
  hideLabel?: boolean;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [supportsWebGL, setSupportsWebGL] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSupportsWebGL(hasWebGL());
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const onUnsupported = useCallback(() => setSupportsWebGL(false), []);

  return (
    <div
      className={`relative select-none ${className}`}
      data-signal-state={state}
      data-topic-shape={topicShape}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className="aspect-square w-full select-none outline-none">
        {mounted && supportsWebGL ? (
          <SignalScene
            state={state}
            energy={energy}
            bands={bands}
            topicShape={topicShape}
            reducedMotion={reducedMotion}
            onUnsupported={onUnsupported}
          />
        ) : (
          <SignalFallbackSvg state={state} energy={energy} bands={bands} topicShape={topicShape} />
        )}
      </div>
      {!hideLabel && (
        <p className="meta text-center mt-1" role="status" aria-live="polite" data-testid="signal-state-label">
          {STATE_LABELS[state]}
        </p>
      )}
    </div>
  );
}
