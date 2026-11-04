'use client';

import { useEffect, useRef, useState } from 'react';
import { useModalFocus } from '@/lib/ui/useModalFocus';

interface GroundingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

const BREATH_STEPS: Record<BreathPhase, { label: string; duration: number; instruction: string }> = {
  inhale: { label: 'Inhale', duration: 4, instruction: 'Breathe in through your nose.' },
  hold1: { label: 'Hold', duration: 4, instruction: 'Hold it.' },
  exhale: { label: 'Exhale', duration: 4, instruction: 'Breathe out through your mouth.' },
  hold2: { label: 'Rest', duration: 4, instruction: 'Rest.' },
};

export function GroundingPanel({ isOpen, onClose }: GroundingPanelProps) {
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [groundingStep, setGroundingStep] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  useModalFocus(box, isOpen);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const sensoryItems = [
    { count: '5', label: 'Things you can see', hint: 'Look around. Notice colors, shapes, light.' },
    { count: '4', label: 'Things you can touch', hint: 'Feel your clothes, desk, feet on floor.' },
    { count: '3', label: 'Things you can hear', hint: 'Room tone, distant traffic, hum of computer.' },
    { count: '2', label: 'Things you can smell', hint: 'Coffee, fresh air, your sleeve.' },
    { count: '1', label: 'One slow breath', hint: 'Feel your chest expand and settle.' },
  ];

  // Box Breathing 4-4-4-4 cycle
  useEffect(() => {
    if (!isOpen) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setPhase((current) => {
            if (current === 'inhale') return 'hold1';
            if (current === 'hold1') return 'exhale';
            if (current === 'exhale') return 'hold2';
            return 'inhale';
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const current = BREATH_STEPS[phase];
  const scale = phase === 'inhale' ? 'scale-110' : phase === 'exhale' ? 'scale-90' : 'scale-100';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="grounding-title"
    >
      <div ref={box} tabIndex={-1} className="card w-full max-w-lg p-6 bg-surface border border-line shadow-2xl relative outline-none">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <div>
              <h3 id="grounding-title" className="font-display font-semibold text-ink text-lg">
                Breathing and grounding
              </h3>
              <p className="text-xs text-ink-3">Two minutes. Nothing else needs doing.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost !px-2 text-ink-2"
            aria-label="Close grounding panel"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {/* Visual Box Breathing Circle */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div
            className={`w-36 h-36 rounded-full border-4 border-accent/40 bg-accent/10 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${scale}`}
          >
            <span className="font-display text-accent font-semibold text-xl">
              {current.label}
            </span>
            <span className="tnum mt-1 text-2xl font-bold text-ink">{secondsLeft}s</span>
          </div>
          <p className="text-sm text-ink-2 mt-4 text-center italic">{current.instruction}</p>
        </div>

        {/* 5-4-3-2-1 Grounding Sequence */}
        <div className="mt-4 pt-4 border-t border-line">
          <span className="text-xs font-semibold text-ink-3 block mb-2">
            5-4-3-2-1 grounding
          </span>
          <div className="space-y-1.5">
            {sensoryItems.map((item, idx) => {
              const done = groundingStep > idx;
              return (
                <button
                  key={item.count}
                  type="button"
                  onClick={() => setGroundingStep(idx + 1)}
                  className={`w-full min-h-11 text-left p-2 rounded-lg text-xs flex items-center justify-between border transition-colors ${
                    done
                      ? 'bg-accent/10 border-accent/30 text-ink'
                      : 'bg-recessed border-line text-ink-2 hover:bg-recessed/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[0.7rem] font-bold ${
                        done ? 'bg-accent text-[#05080C]' : 'bg-surface border border-line text-ink-3'
                      }`}
                    >
                      {item.count}
                    </span>
                    <div>
                      <span className="font-medium text-ink block">{item.label}</span>
                      <span className="text-[0.72rem] text-ink-3">{item.hint}</span>
                    </div>
                  </div>
                  {done && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent" aria-label="Done" role="img">
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-line flex justify-between items-center gap-3">
          <span className="text-xs text-ink-3">Take all the time you need.</span>
          <button type="button" onClick={onClose} className="btn btn-primary shrink-0 whitespace-nowrap px-4 text-xs">
            I feel grounded now
          </button>
        </div>
      </div>
    </div>
  );
}
