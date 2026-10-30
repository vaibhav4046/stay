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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Compute 7 dynamic waveform bar heights (px) based on real-time FFT frequency bands & RMS
  const energy = Math.max(0.06, Math.min(1, audioEnergy));
  const low = Math.max(0.05, Math.min(1, audioBands?.low ?? energy));
  const mid = Math.max(0.05, Math.min(1, audioBands?.mid ?? energy));
  const high = Math.max(0.05, Math.min(1, audioBands?.high ?? energy));

  const isLive = isConnected && visualState !== 'error';
  const isListening = isLive && visualState === 'listening';
  const isSpeaking = isLive && visualState === 'speaking';
  const isThinking = isLive && visualState === 'thinking';

  // Height ranges: 3.5px (idle straight line) -> up to 34px (dynamic live audio wave expansion)
  const barHeights = isLive
    ? [
        Math.round(4 + low * 14),
        Math.round(5 + (low * 0.7 + mid * 0.3) * 20),
        Math.round(6 + (mid * 0.6 + energy * 0.4) * 26),
        Math.round(7 + energy * 30),
        Math.round(6 + (mid * 0.6 + energy * 0.4) * 26),
        Math.round(5 + (high * 0.7 + mid * 0.3) * 20),
        Math.round(4 + high * 14),
      ]
    : [3.5, 3.5, 3.5, 3.5, 3.5, 3.5, 3.5];

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-stone-200/90 bg-stone-50/95 px-3 py-1 shadow-sm backdrop-blur-md transition-all duration-300 dark:border-stone-700/80 dark:bg-stone-900/95 ${
        isLive
          ? 'ring-2 ring-indigo-500/40 shadow-[0_0_12px_rgba(66,133,244,0.18)]'
          : 'hover:border-indigo-400/50 hover:shadow-sm'
      } ${className}`}
    >
      <button
        type="button"
        onClick={onToggleVoice}
        aria-label={isConnected ? 'Disconnect Gemini Live Voice' : 'Start Gemini Live Voice Session'}
        aria-pressed={isConnected}
        data-testid="mic-button"
        className="group relative flex h-9 items-center gap-2.5 rounded-full px-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {/* Official Google Gemini Sparkle Star Icon with Multi-Stop Brand Gradient */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            className={`shrink-0 transition-transform duration-300 ${
              isLive
                ? 'scale-110 drop-shadow-[0_0_8px_rgba(66,133,244,0.7)]'
                : 'group-hover:scale-105 group-hover:drop-shadow-[0_0_5px_rgba(142,117,255,0.5)]'
            }`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="gemini-official-sparkle" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4285F4" />
                <stop offset="35%" stopColor="#8E75FF" />
                <stop offset="70%" stopColor="#D96570" />
                <stop offset="100%" stopColor="#00D2FF" />
              </linearGradient>
              <linearGradient id="gemini-accent-sparkle" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00D2FF" />
                <stop offset="60%" stopColor="#8E75FF" />
                <stop offset="100%" stopColor="#4285F4" />
              </linearGradient>
            </defs>

            {/* Primary Google Gemini 4-Point Concave Star */}
            <path
              d="M11.5 1.5C11.5 6.968 7.032 11.435 1.565 11.435C7.032 11.435 11.5 15.903 11.5 21.37C11.5 15.903 15.968 11.435 21.435 11.435C15.968 11.435 11.5 6.968 11.5 1.5Z"
              fill="url(#gemini-official-sparkle)"
            />

            {/* Secondary Accent Sparkle Star */}
            <path
              d="M19 1.5C19 3.433 17.433 5 15.5 5C17.433 5 19 6.567 19 8.5C19 6.567 20.567 5 22.5 5C20.567 5 19 3.433 19 1.5Z"
              fill="url(#gemini-accent-sparkle)"
              opacity="0.9"
            />
          </svg>
        </div>

        {/* Gemini Live Signature Line-to-Waveform Expansion Stage */}
        <div
          className="relative flex h-8 items-center justify-center px-0.5"
          style={{ width: isLive ? '58px' : '38px', transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          aria-hidden="true"
        >
          {!isLive ? (
            // Idle State: Google Gemini Signature Sleek Horizontal Line
            <div className="h-[3.5px] w-full rounded-full bg-gradient-to-r from-[#4285F4] via-[#8E75FF] to-[#D96570] shadow-[0_0_8px_rgba(142,117,255,0.45)] transition-all duration-300 group-hover:h-[4.5px] group-hover:shadow-[0_0_12px_rgba(66,133,244,0.6)]" />
          ) : (
            // Active State: Gemini Dynamic Expanding Vertical Frequency Spectrum Bars
            <div className="flex h-8 items-center justify-center gap-[3px]">
              {barHeights.map((h, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-gradient-to-t from-[#4285F4] via-[#8E75FF] to-[#00D2FF] transition-all duration-75"
                  style={{
                    height: `${h}px`,
                    transform: reducedMotion ? 'none' : undefined,
                    boxShadow: '0 0 6px rgba(142, 117, 255, 0.55)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Status / Auto-Mic Mode Label */}
        <span className="text-xs font-semibold tracking-wide text-stone-700 dark:text-stone-200">
          {!isConnected
            ? 'Gemini Live'
            : isSpeaking
            ? 'Speaking'
            : isThinking
            ? 'Thinking'
            : isHandsFreePaused
            ? 'Paused'
            : 'Auto-Mic'}
        </span>

        {/* Subtle Glowing Live Status Indicator Dot */}
        {isLive && (
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isHandsFreePaused
                  ? 'bg-amber-400'
                  : 'animate-ping bg-indigo-400'
              }`}
            />
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                isHandsFreePaused ? 'bg-amber-500' : 'bg-indigo-500'
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
          className="flex h-7 w-7 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-200/70 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
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
