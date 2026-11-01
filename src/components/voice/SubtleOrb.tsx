'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { VoiceVisualState } from '@/types/domain';
import { Signal, hasWebGL } from '@/components/Signal';
import { REST_TARGET, type OrbTarget } from '@/components/orb/OrbParticles';

export interface SubtleOrbProps {
  state: VoiceVisualState;
  energy?: number;
  size?: number; // <= 40 in dock, 96 in empty state (§7.5)
  shape?: OrbTarget;
  onClick?: () => void;
  className?: string;
  testId?: string;
}

/**
 * Subtle status light orb (§7.5):
 * - Status light, not a character: <= 40 px in the dock (still 96 px in empty state).
 * - No emoji, "!", pictograms, text, or faces during voice conversation.
 * - States:
 *   IDLE: still, --line (#E4DFD6) ring
 *   LISTENING: scale 1.00 -> 1.06 from mic RMS in --accent (#006A67)
 *   THINKING: opacity 0.6 <-> 1.0 breathe over 1.6 s in --think (#B45309)
 *   SPEAKING: scale 1.00 -> 1.05 from rendered output RMS in --accent (#006A67)
 *   INTERRUPTED: snap to still within 1 frame
 *   ERROR: static --danger (#B42318) dot + label
 */
export function SubtleOrb({
  state,
  energy = 0,
  size = 36,
  shape = REST_TARGET,
  onClick,
  className = '',
  testId = 'orb-button',
}: SubtleOrbProps) {
  const [playfulOrb, setPlayfulOrb] = useState(false);
  const [canWebGL, setCanWebGL] = useState(false);
  const [scale, setScale] = useState(1.0);
  const animFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    setCanWebGL(hasWebGL());
    if (typeof window !== 'undefined') {
      const isPlayful = window.localStorage.getItem('stay:playful_orb:v1') === '1';
      const isDebug = Boolean((window as Window & { __stayOrbDebug?: boolean }).__stayOrbDebug);
      setPlayfulOrb(isPlayful || isDebug);
    }
  }, []);

  // Update scale outside React re-render, capped at 30 fps (§7.5)
  useEffect(() => {
    const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isReduced || state === 'idle' || state === 'interrupted' || state === 'error') {
      setScale(1.0);
      return;
    }

    const update = (time: number) => {
      if (time - lastUpdateRef.current >= 33) {
        lastUpdateRef.current = time;
        if (state === 'listening') {
          const target = 1.0 + Math.min(0.06, energy * 0.06);
          setScale((prev) => prev + (target - prev) * 0.3);
        } else if (state === 'speaking') {
          const target = 1.0 + Math.min(0.05, energy * 0.05);
          setScale((prev) => prev + (target - prev) * 0.3);
        } else {
          setScale(1.0);
        }
      }
      animFrameRef.current = requestAnimationFrame(update);
    };

    animFrameRef.current = requestAnimationFrame(update);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [state, energy]);

  // If playful orb is explicitly opted in (or __stayOrbDebug test flag is set) AND WebGL is available, render Signal
  if (playfulOrb && canWebGL) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Talk to Stay"
        data-testid={testId}
        className={`relative rounded-full overflow-hidden flex items-center justify-center cursor-pointer transition-transform ${className}`}
        style={{ width: size, height: size, maxWidth: size, maxHeight: size }}
      >
        <Signal
          state={state}
          energy={energy}
          shape={shape}
          size={size}
          hideLabel
          className="h-full w-full"
        />
      </button>
    );
  }

  // Pure SVG/CSS subtle status light (< 40 px dock / 96 px empty state)
  const isThinking = state === 'thinking';
  const isInterrupted = state === 'interrupted';
  const isError = state === 'error';
  const isSpeaking = state === 'speaking';
  const isListening = state === 'listening';

  let fillColor = '#006A67';
  let strokeColor = '#E4DFD6';
  let ringOpacity = 1;

  if (isThinking || isInterrupted) {
    fillColor = '#B45309';
    strokeColor = '#FDE68A';
  } else if (isError) {
    fillColor = '#B42318';
    strokeColor = '#FCA5A5';
  } else if (isSpeaking || isListening) {
    fillColor = '#006A67';
    strokeColor = '#99F6E4';
  } else {
    fillColor = '#FAF8F5';
    strokeColor = '#E4DFD6';
    ringOpacity = 0.8;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Stay status orb: ${state}`}
      data-testid={testId}
      className={`relative inline-flex items-center justify-center rounded-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006A67] ${className}`}
      style={{
        width: size,
        height: size,
        maxWidth: size,
        maxHeight: size,
        transform: `scale(${scale})`,
        transition: isInterrupted ? 'none' : 'transform 120ms ease-out, background-color 150ms ease',
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{
          animation: isThinking ? 'stay-thinking-breathe 1.6s ease-in-out infinite' : 'none',
        }}
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke={strokeColor}
          strokeWidth="2"
          opacity={ringOpacity}
        />
        <circle
          cx="20"
          cy="20"
          r="12"
          fill={fillColor}
        />
      </svg>
      <style jsx>{`
        @keyframes stay-thinking-breathe {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1.0; }
        }
      `}</style>
    </button>
  );
}
