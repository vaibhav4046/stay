'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StayWordmark } from '@/components/StayMark';
import { Signal, STATE_LABELS } from '@/components/Signal';
import type { AudioSpectrumBands, VoiceVisualState } from '@/types/domain';

const STATES: VoiceVisualState[] = [
  'idle',
  'connecting',
  'listening',
  'thinking',
  'speaking',
  'backchannel',
  'interrupted',
  'saving',
  'complete',
  'error',
];

export default function OrbDiagnosticPage() {
  const [selectedState, setSelectedState] = useState<VoiceVisualState>('idle');
  const [energy, setEnergy] = useState<number>(0.35);
  const [bandPreset, setBandPreset] = useState<'neutral' | 'vowel' | 'consonant' | 'sibilant'>('neutral');

  // Compute 3-band FFT simulation
  const bands: AudioSpectrumBands = {
    low: bandPreset === 'vowel' ? Math.min(1, energy * 1.6) : energy * 0.8,
    mid: bandPreset === 'consonant' ? Math.min(1, energy * 1.6) : energy * 0.6,
    high: bandPreset === 'sibilant' ? Math.min(1, energy * 1.8) : energy * 0.4,
    overall: energy,
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#212422]">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 border-b border-[#E9E6DF]">
        <Link href="/" aria-label="Stay home">
          <StayWordmark />
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/demo" className="btn btn-secondary text-xs">
            Back to Demo
          </Link>
          <Link href="/app/today" className="btn btn-primary text-xs">
            Live Workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#006A67]">
            Instrument Inspection & Visual Calibration
          </span>
          <h1 className="text-2xl font-bold tracking-tight mt-1 text-[#212422]">
            Stay Signal Orb Diagnostic
          </h1>
          <p className="text-sm text-[#626B66] mt-1">
            Zero-audio testbed for verifying Stay&apos;s WebGL undulating fluid horizon, Marvel Eternity cosmic interior, 
            3-band FFT deformation, and circular bounding across all 10 semantic dialogue states.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Main Orb Viewport */}
          <div className="md:col-span-6 flex flex-col items-center justify-center p-8 rounded-3xl bg-white border border-[#E9E6DF] shadow-sm">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full overflow-hidden flex items-center justify-center shadow-lg ring-1 ring-black/5 bg-[#001413]">
              <Signal
                state={selectedState}
                energy={energy}
                bands={bands}
                hideLabel
                className="w-full h-full"
              />
            </div>
            <div className="mt-6 text-center">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-[#E4F0EF] text-[#006A67]">
                State: {selectedState.toUpperCase()}
              </span>
              <p className="text-sm font-medium text-[#212422] mt-2">
                {STATE_LABELS[selectedState]}
              </p>
              <p className="text-xs text-[#747A75] mt-1 font-mono">
                Energy: {energy.toFixed(2)} | Low: {bands.low.toFixed(2)} | Mid: {bands.mid.toFixed(2)} | High: {bands.high.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Controls & State Matrix */}
          <div className="md:col-span-6 space-y-6">
            {/* Semantic State Switcher */}
            <div className="p-5 rounded-2xl bg-white border border-[#E9E6DF]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#747A75] mb-3">
                1. Select Semantic State
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STATES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedState(st)}
                    className={`px-3 py-2 text-xs rounded-xl border text-left transition-all ${
                      selectedState === st
                        ? 'border-[#006A67] bg-[#E4F0EF] text-[#006A67] font-semibold ring-1 ring-[#006A67]'
                        : 'border-[#E9E6DF] hover:bg-[#F1EFE9] text-[#212422]'
                    }`}
                  >
                    <div className="font-mono text-[11px] opacity-75">{st}</div>
                    <div className="truncate text-[10px] text-[#626B66]">{STATE_LABELS[st]}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Energy Slider */}
            <div className="p-5 rounded-2xl bg-white border border-[#E9E6DF] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#747A75]">
                  2. Audio Energy Level
                </h2>
                <span className="text-xs font-mono font-bold text-[#006A67]">
                  {(energy * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={energy}
                onChange={(e) => setEnergy(parseFloat(e.target.value))}
                className="w-full accent-[#006A67] cursor-pointer"
                aria-label="Simulated Audio Energy"
              />
              <div className="flex justify-between text-[11px] text-[#747A75]">
                <span>0% (Whisper / Silent)</span>
                <span>50% (Normal Speech)</span>
                <span>100% (High Energy / Surge)</span>
              </div>
            </div>

            {/* 3-Band FFT Presets */}
            <div className="p-5 rounded-2xl bg-white border border-[#E9E6DF]">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#747A75] mb-3">
                3. Acoustic Viseme Modulation Presets
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['neutral', 'Neutral / Flat', 'Uniform distribution across all octaves'],
                    ['vowel', 'Low-Band / Vowels', '0–700 Hz: activates organic radial core swell'],
                    ['consonant', 'Mid-Band / Consonants', '700–1500 Hz: vertical mouth-like fluid contour'],
                    ['sibilant', 'High-Band / Sibilants', '1500+ Hz: acoustic harmonic surface ripple'],
                  ] as const
                ).map(([key, label, desc]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBandPreset(key)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      bandPreset === key
                        ? 'border-[#006A67] bg-[#E4F0EF] text-[#006A67] font-semibold ring-1 ring-[#006A67]'
                        : 'border-[#E9E6DF] hover:bg-[#F1EFE9] text-[#212422]'
                    }`}
                  >
                    <div className="text-xs">{label}</div>
                    <div className="text-[10px] text-[#626B66] mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Audio Decoupling Architecture Verification */}
            <div className="p-4 rounded-xl bg-[#F1EFE9] border border-[#E9E6DF] text-xs text-[#626B66] space-y-1">
              <span className="font-semibold text-[#212422] block">
                Verification Architecture Notice:
              </span>
              <p>
                • <strong>Zero Mic Loop:</strong> Mic stream routes only to local AudioWorklet / AnalyserNode. Output buffer routes to speaker destination and taps separate AnalyserNode.
              </p>
              <p>
                • <strong>No Square Clipping:</strong> Canvas DOM and WebGL viewport are strictly bounded to 50% border radius with zero CSS outlines.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
