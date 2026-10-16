'use client';

import { useEffect, useState } from 'react';

interface GroundingPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type BreathPhase = 'inhale' | 'hold1' | 'exhale' | 'hold2';

const BREATH_STEPS: Record<BreathPhase, { label: string; duration: number; instruction: string }> = {
  inhale: { label: 'Inhale', duration: 4, instruction: 'Breathe in slowly through your nose...' },
  hold1: { label: 'Hold', duration: 4, instruction: 'Gently hold your breath...' },
  exhale: { label: 'Exhale', duration: 4, instruction: 'Release softly through your mouth...' },
  hold2: { label: 'Rest', duration: 4, instruction: 'Rest in stillness...' },
};

export function GroundingPanel({ isOpen, onClose }: GroundingPanelProps) {
  const [phase, setPhase] = useState<BreathPhase>('inhale');
  const [secondsLeft, setSecondsLeft] = useState(4);
  const [groundingStep, setGroundingStep] = useState(0);

  const sensoryItems = [
    { count: '5', label: 'Things you can SEE', hint: 'Look around. Notice colors, shapes, light.' },
    { count: '4', label: 'Things you can TOUCH', hint: 'Feel your clothes, desk, feet on floor.' },
    { count: '3', label: 'Things you can HEAR', hint: 'Room tone, distant traffic, hum of computer.' },
    { count: '2', label: 'Things you can SMELL', hint: 'Coffee, fresh air, your sleeve.' },
    { count: '1', label: 'Slow intentional breath', hint: 'Feel your chest expand and settle.' },
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
      <div className="card w-full max-w-lg p-6 bg-surface border border-line shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">🌿</span>
            <div>
              <h3 id="grounding-title" className="font-display font-semibold text-ink text-lg">
                Sensory Grounding &amp; Box Breathing
              </h3>
              <p className="text-xs text-ink-3">Stay is right here. Nothing else matters for the next 2 minutes.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-3 hover:text-ink text-xl font-medium px-2 py-1"
            aria-label="Close grounding panel"
          >
            ✕
          </button>
        </div>

        {/* Visual Box Breathing Circle */}
        <div className="my-6 flex flex-col items-center justify-center">
          <div
            className={`w-36 h-36 rounded-full border-4 border-accent/40 bg-accent/10 flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${scale}`}
          >
            <span className="font-display text-accent font-semibold text-xl tracking-wide uppercase">
              {current.label}
            </span>
            <span className="text-2xl font-mono text-ink mt-1 font-bold">{secondsLeft}s</span>
          </div>
          <p className="text-sm text-ink-2 mt-4 text-center italic">{current.instruction}</p>
        </div>

        {/* 5-4-3-2-1 Grounding Sequence */}
        <div className="mt-4 pt-4 border-t border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-3 block mb-2">
            5-4-3-2-1 Somatic Grounding Checklist
          </span>
          <div className="space-y-1.5">
            {sensoryItems.map((item, idx) => {
              const done = groundingStep > idx;
              return (
                <button
                  key={item.count}
                  type="button"
                  onClick={() => setGroundingStep(idx + 1)}
                  className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between border transition-colors ${
                    done
                      ? 'bg-accent/10 border-accent/30 text-ink'
                      : 'bg-surface-recessed border-line text-ink-2 hover:bg-surface-recessed/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[0.7rem] font-bold ${
                        done ? 'bg-accent text-white' : 'bg-surface border border-line text-ink-3'
                      }`}
                    >
                      {item.count}
                    </span>
                    <div>
                      <span className="font-medium text-ink block">{item.label}</span>
                      <span className="text-[0.72rem] text-ink-3">{item.hint}</span>
                    </div>
                  </div>
                  {done && <span className="text-accent font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-line flex justify-between items-center">
          <span className="text-xs text-ink-3">Take all the time you need.</span>
          <button type="button" onClick={onClose} className="btn btn-primary py-1.5 px-4 text-xs">
            I feel grounded now
          </button>
        </div>
      </div>
    </div>
  );
}
