'use client';

import React, { useEffect, useRef, useState } from 'react';
import { StayLogo } from '@/components/StayLogo';
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

const W = 72;
const H = 32;
const MID = H / 2;
/** Three layered sine ribbons: a calm line when idle, a flowing voice wave when live. */
const RIBBONS = [
  { stroke: 'url(#stay-wave-a)', width: 2.4, freq: 1.0, speed: 2.2, amp: 1, opacity: 1 },
  { stroke: 'url(#stay-wave-b)', width: 1.8, freq: 1.6, speed: -3.1, amp: 0.7, opacity: 0.85 },
  { stroke: 'url(#stay-wave-c)', width: 1.4, freq: 2.3, speed: 4.0, amp: 0.45, opacity: 0.7 },
];

function buildPath(phase: number, amp: number, freq: number): string {
  let d = '';
  for (let x = 0; x <= W; x += 2) {
    const u = x / W;
    const env = Math.sin(Math.PI * u) ** 1.6; // taper to a point at both ends
    const y = MID + Math.sin(u * Math.PI * 2 * freq + phase) * amp * env;
    d += `${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(2)} `;
  }
  return d;
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
  const [hovered, setHovered] = useState(false);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const live = useRef({ energy: 0, bands: 0, state: 'idle' as VoiceVisualState, on: false, hovered: false });

  const isActiveState = visualState === 'speaking' || visualState === 'thinking' || visualState === 'listening';
  const isLive = (isConnected || isActiveState) && visualState !== 'error';
  const isSpeaking = visualState === 'speaking';
  const isThinking = visualState === 'thinking';

  live.current.energy = Math.max(0, Math.min(1, audioEnergy));
  live.current.bands = audioBands ? Math.max(audioBands.low, audioBands.mid, audioBands.high) : audioEnergy;
  live.current.state = visualState;
  live.current.on = isLive && !isHandsFreePaused;
  live.current.hovered = hovered;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const h = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  useEffect(() => {
    let raf = 0;
    let amp = 0;
    let t0 = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const s = live.current;
      const breathe =
        s.state === 'speaking'
          ? 0.34 + 0.18 * Math.sin(now / 150)
          : s.state === 'thinking'
            ? 0.22 + 0.1 * Math.sin(now / 260)
            : 0.14 + 0.06 * Math.sin(now / 600);
      const hoverPulse = s.hovered ? 0.18 + 0.06 * Math.sin(now / 320) : 0;
      const target = s.on ? Math.max(breathe, Math.min(1, s.energy * 1.65 + s.bands * 0.55)) : hoverPulse;
      amp += (target - amp) * Math.min(1, dt * 10);
      const px = amp * (H / 2 - 4);
      const speedBoost = s.state === 'speaking' ? 1.35 : 1.0;
      const phaseBase = reducedMotion ? 0 : (now / 1000) * speedBoost;
      RIBBONS.forEach((r, i) => {
        const el = pathRefs.current[i];
        if (el) el.setAttribute('d', buildPath(phaseBase * r.speed, px * r.amp, r.freq));
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reducedMotion]);

  const label = isSpeaking ? 'Speaking' : isThinking ? 'Thinking' : !isConnected ? 'Talk to Stay' : isHandsFreePaused ? 'Paused' : 'Listening';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`inline-flex items-center gap-1 rounded-full border bg-white/90 px-2 py-1 backdrop-blur-md transition-all duration-500 dark:bg-stone-900/90 ${
        isLive ? 'border-transparent shadow-[0_0_0_1.5px_rgba(111,126,255,0.55),0_6px_24px_-6px_rgba(111,126,255,0.55)]' : 'border-stone-200 shadow-sm hover:border-stone-300'
      } ${className}`}
    >
      <button
        type="button"
        onClick={onToggleVoice}
        aria-label={isConnected ? 'End live voice' : 'Start live voice'}
        aria-pressed={isConnected}
        data-testid="mic-button"
        className="group flex h-10 items-center gap-2 rounded-full px-2 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <StayLogo size={22} className="shrink-0 transition-transform duration-300 group-hover:scale-110 drop-shadow-sm ml-0.5" />
        {(isLive || hovered) && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" data-testid="voice-wave-svg" className="shrink-0 overflow-visible transition-opacity duration-300">
            <defs>
              <linearGradient id="stay-wave-a" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#4285F4" /><stop offset="0.5" stopColor="#9B72CB" /><stop offset="1" stopColor="#D96570" />
              </linearGradient>
              <linearGradient id="stay-wave-b" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#00D2FF" /><stop offset="1" stopColor="#8E75FF" />
              </linearGradient>
              <linearGradient id="stay-wave-c" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="#D96570" /><stop offset="1" stopColor="#4285F4" />
              </linearGradient>
            </defs>
            {RIBBONS.map((r, i) => (
              <path
                key={i}
                ref={(el) => { pathRefs.current[i] = el; }}
                d={buildPath(0, 0, r.freq)}
                fill="none"
                stroke={r.stroke}
                strokeWidth={r.width}
                strokeLinecap="round"
                opacity={r.opacity}
              />
            ))}
          </svg>
        )}
        <span className="min-w-[4.5rem] text-left text-xs font-medium tracking-wide text-stone-700 dark:text-stone-200">{label}</span>
      </button>

      {isLive && onToggleHandsFreeMute && (
        <button
          type="button"
          onClick={onToggleHandsFreeMute}
          aria-label={isHandsFreePaused ? 'Resume auto microphone' : 'Pause auto microphone'}
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            {isHandsFreePaused ? <polygon points="6 3 20 12 6 21" /> : (<><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>)}
          </svg>
        </button>
      )}
    </div>
  );
}
