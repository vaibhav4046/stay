'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import type { AudioSpectrumBands, VoiceVisualState } from '@/types/domain';
import { REST_TARGET, type OrbTarget } from '@/components/orb/OrbParticles';

const OrbParticles = dynamic(() => import('./orb/OrbParticles'), { ssr: false });

export const STATE_LABELS: Record<VoiceVisualState, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting',
  listening: 'Listening',
  thinking: 'Thinking',
  speaking: 'Speaking',
  interrupted: 'Listening',
  backchannel: 'Listening',
  saving: 'Saving',
  complete: 'Logged',
  error: 'Voice unavailable',
};

/** Colour themes the user can ask for by voice; they override the shape's own colours. */
const THEMES: Record<string, [string, string]> = {
  aurora: ['#34D399', '#8B5CF6'],
  sunset: ['#FB923C', '#E11D48'],
  ocean: ['#38BDF8', '#1E3A8A'],
  cyber: ['#22D3EE', '#D946EF'],
  emerald: ['#34D399', '#047857'],
};

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Signal({
  state,
  energy = 0,
  bands,
  shape = REST_TARGET,
  thinking = false,
  colorTheme,
  size = 240,
  hideLabel = false,
  className = '',
}: {
  state: VoiceVisualState;
  energy?: number;
  bands?: AudioSpectrumBands;
  shape?: OrbTarget;
  thinking?: boolean;
  colorTheme?: string;
  size?: number;
  hideLabel?: boolean;
  className?: string;
  /** Legacy props from the previous orb; accepted and ignored so older callers keep compiling. */
  topicShape?: number;
  generativeShape?: unknown;
}) {
  const [webglOk, setWebglOk] = useState(true);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setWebglOk(hasWebGL());
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const tint = colorTheme && THEMES[colorTheme] ? THEMES[colorTheme] : null;
  const target: OrbTarget = shape;

  const onUnsupported = useCallback(() => setWebglOk(false), []);
  const onReady = useCallback(() => setReady(true), []);
  const box = className ? undefined : { width: size, height: size };

  return (
    <div className={`flex flex-col items-center gap-2 select-none ${className}`} data-signal-state={state} data-shape={shape.key}>
      <div className="relative flex h-full w-full items-center justify-center" style={box}>
        {webglOk ? (
          <>
            {/* calm placeholder until the first frame is drawn: no blank gap, no pop-in */}
            <div
              aria-hidden="true"
              className="absolute inset-[16%] rounded-full"
              style={{
                background: `radial-gradient(circle at 38% 32%, ${target.palette[0]}, ${target.palette[1]})`,
                opacity: ready ? 0 : 0.5,
                filter: 'blur(2px)',
                transition: 'opacity 700ms ease',
              }}
            />
            <div className="h-full w-full" style={{ opacity: ready ? 1 : 0, transition: 'opacity 700ms ease' }}>
              <OrbParticles
                state={state}
                energy={energy}
                bands={bands}
                target={target}
                tint={tint}
                thinking={thinking}
                reducedMotion={reducedMotion}
                onUnsupported={onUnsupported}
                onReady={onReady}
              />
            </div>
          </>
        ) : (
          <div
            aria-hidden="true"
            className="h-3/4 w-3/4 rounded-full"
            style={{ background: `radial-gradient(circle at 38% 32%, ${target.palette[0]}, ${target.palette[1]})`, transform: `scale(${1 + energy * 0.12})`, transition: 'transform 120ms ease' }}
          />
        )}
      </div>
      {!hideLabel && (
        <p className="meta text-center" aria-live="polite">
          {STATE_LABELS[state]}
        </p>
      )}
    </div>
  );
}
