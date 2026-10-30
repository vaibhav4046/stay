'use client';

import React, { useEffect, useState } from 'react';
import type { VoiceVisualState, AudioSpectrumBands } from '@/types/domain';

export interface GeminiLiveVoiceVisualizerProps {
  visualState: VoiceVisualState;
  isConnected: boolean;
  audioEnergy: number;
  audioBands?: AudioSpectrumBands;
  isHandsFreePaused?: boolean;
  onToggleVoice: () => void;
  onToggleHandsFreeMute?: () => void;
  className?: string;
}

export function GeminiLiveVoiceVisualizer({
  visualState,
  isConnected,
  audioEnergy,
  audioBands,
  isHandsFreePaused = false,
  onToggleVoice,
  onToggleHandsFreeMute,
  className = '',
}: GeminiLiveVoiceVisualizerProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Compute 5 dynamic bar heights (px) based on real-time FFT frequency bands & RMS
  const energy = Math.max(0.06, Math.min(1, audioEnergy));
  const low = Math.max(0.05, Math.min(1, audioBands?.low ?? energy));
  const mid = Math.max(0.05, Math.min(1, audioBands?.mid ?? energy));
  const high = Math.max(0.05, Math.min(1, audioBands?.high ?? energy));

  const isLive = isConnected && visualState !== 'error';
  const isListening = isLive && visualState === 'listening';
  const isSpeaking = isLive && visualState === 'speaking';
  const isThinking = isLive && visualState === 'thinking';

  // Height ranges: 3px (straight line) -> up to 34px (full live wave expansion)
  const barHeights = isLive
    ? [
        Math.round(4 + low * 18),
        Math.round(4 + (low * 0.5 + energy * 0.5) * 26),
        Math.round(6 + energy * 32),
        Math.round(4 + (mid * 0.5 + energy * 0.5) * 26),
        Math.round(4 + high * 20),
      ]
    : [3, 3, 3, 3, 3];

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-stone-50/90 px-3 py-1.5 shadow-sm backdrop-blur-md transition-all duration-300 dark:border-stone-700/80 dark:bg-stone-900/90 ${
        isLive ? 'ring-2 ring-teal-500/30' : 'hover:border-teal-500/50'
      } ${className}`}
    >
      <button
        type="button"
        onClick={onToggleVoice}
        aria-label={isConnected ? 'Disconnect Gemini Live Voice' : 'Start Gemini Live Voice Session'}
        aria-pressed={isConnected}
        data-testid="mic-button"
        className="group relative flex h-9 items-center gap-2 rounded-full px-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        {/* Gemini 4-Point Sparkle Icon */}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 transition-transform duration-300 ${
            isLive ? 'scale-110 text-teal-600 dark:text-teal-400' : 'text-stone-500 group-hover:scale-105 dark:text-stone-400'
          }`}
          aria-hidden="true"
        >
          <path
            d="M12 2C12 7.52285 7.52285 12 2 12C7.52285 12 12 16.4771 12 22C12 16.4771 16.4771 12 22 12C16.4771 12 12 7.52285 12 2Z"
            fill="currentColor"
          />
        </svg>

        {/* Gemini Live Line-to-Waveform Expansion Stage */}
        <div
          className="relative flex h-8 items-center justify-center px-1"
          style={{ width: isLive ? '52px' : '36px', transition: 'width 300ms ease' }}
          aria-hidden="true"
        >
          {!isLive ? (
            // Idle State: Gemini Signature Smooth Straight Line
            <div className="h-[3px] w-full rounded-full bg-gradient-to-r from-teal-500 via-sky-400 to-teal-600 shadow-[0_0_8px_rgba(20,184,166,0.35)] transition-all duration-300 group-hover:h-[4px]" />
          ) : (
            // Live State: Expanding Vertical Audio Spectrum Bars
            <div className="flex h-8 items-center justify-center gap-1">
              {barHeights.map((h, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-gradient-to-t from-teal-600 via-teal-400 to-sky-400 transition-all duration-75 dark:from-teal-400 dark:via-sky-400 dark:to-amber-300"
                  style={{
                    height: `${h}px`,
                    transform: reducedMotion ? 'none' : undefined,
                    boxShadow: '0 0 6px rgba(45, 212, 191, 0.4)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Status / Auto-Mic Mode Label */}
        <span className="text-xs font-semibold tracking-wide text-stone-700 dark:text-stone-200">
          {!isConnected
            ? 'Live Voice'
            : isSpeaking
            ? 'Speaking'
            : isThinking
            ? 'Thinking'
            : isHandsFreePaused
            ? 'Paused'
            : 'Auto-Mic'}
        </span>

        {/* Subtle Live Status Indicator Dot */}
        {isLive && (
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isHandsFreePaused
                  ? 'bg-amber-400'
                  : 'animate-ping bg-teal-400'
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                isHandsFreePaused ? 'bg-amber-500' : 'bg-teal-500'
              }`}
            />
          </span>
        )}
      </button>

      {/* Quick Pause / Mute Toggle Button when Live */}
      {isLive && onToggleHandsFreeMute && (
        <button
          type="button"
          onClick={onToggleHandsFreeMute}
          aria-label={isHandsFreePaused ? 'Resume auto microphone' : 'Pause auto microphone'}
          className="flex h-7 w-7 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/60 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
        >
          {isHandsFreePaused ? (
            // Play/Resume Icon
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          ) : (
            // Pause Icon
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
