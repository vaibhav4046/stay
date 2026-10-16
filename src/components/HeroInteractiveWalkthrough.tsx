'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Signal } from '@/components/Signal';
import type { VoiceVisualState } from '@/types/domain';

interface WalkthroughStep {
  title: string;
  visualState: VoiceVisualState;
  stateLabel: string;
  userText?: string;
  barrierLabel?: string;
  stayResponse?: string;
  firstStep?: string;
  strategyLabel?: string;
}

const PREVIEW_STEPS: WalkthroughStep[] = [
  {
    title: '1. Describe what you are stuck on',
    visualState: 'idle',
    stateLabel: 'Preview · Step 1 of 5',
    userText: 'Reply to my landlord about the renewal.',
    barrierLabel: 'Identifying obstacle...',
  },
  {
    title: '2. Confirm the friction barrier',
    visualState: 'thinking',
    stateLabel: 'Preview · Step 2 of 5',
    userText: 'Reply to my landlord about the renewal.',
    barrierLabel: 'Perfectionism / Fear of saying the wrong thing',
    stayResponse: "Analyzing friction barrier...",
  },
  {
    title: '3. Stay shrinks it to a 90-second entry step',
    visualState: 'speaking',
    stateLabel: 'Preview · Step 3 of 5',
    userText: 'Reply to my landlord about the renewal.',
    barrierLabel: 'Perfectionism / Fear of judgment',
    stayResponse: "You don't have to send anything yet. Open the email thread and write one rough sentence in draft.",
    firstStep: 'Open thread & type one messy sentence without sending',
    strategyLabel: 'Permission for a rough draft (Cognitive reframing)',
  },
  {
    title: '4. Start a bounded focus block',
    visualState: 'speaking',
    stateLabel: 'Preview · Step 4 of 5',
    firstStep: 'Open thread & type one messy sentence without sending',
    strategyLabel: 'Cognitive reframing · 5 min timer',
    stayResponse: "I'll keep time and check in the moment your 5 minutes are up.",
  },
  {
    title: '5. Record outcome & update clinician summary',
    visualState: 'complete',
    stateLabel: 'Preview · Step 5 of 5',
    firstStep: 'Open thread & type one messy sentence without sending',
    stayResponse: 'Logged: Started (1 of 1 on Reframing). Added to your 1-page appointment summary.',
  },
];

export function HeroInteractiveWalkthrough() {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [outcomeSelected, setOutcomeSelected] = useState<'started' | 'partly' | null>(null);

  const step = PREVIEW_STEPS[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < PREVIEW_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      setCurrentStepIndex(0);
      setOutcomeSelected(null);
    }
  };

  const handleReset = () => {
    setCurrentStepIndex(0);
    setOutcomeSelected(null);
  };

  return (
    <div
      className="card flex flex-col overflow-hidden border border-line bg-surface p-5 sm:p-7 shadow-xs"
      data-testid="hero-interactive-walkthrough"
      aria-label="Interactive product walkthrough"
    >
      {/* Header bar with honest state badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-4">
        <div className="flex items-center gap-2">
          <span className="sample-badge">Guided preview · example data</span>
          <span className="text-[0.82rem] font-medium text-ink-2">No mic required</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="tnum text-[0.82rem] text-ink-3">Step {currentStepIndex + 1} of 5</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-[0.82rem] text-ink-2 hover:text-ink underline"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main interactive stage */}
      <div className="grid gap-6 pt-5 md:grid-cols-[140px_minmax(0,1fr)] items-center">
        {/* Signal state visualization */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="w-28 h-28">
            <Signal state={step.visualState} energy={step.visualState === 'speaking' ? 0.45 : 0.08} />
          </div>
          <span className="mt-2 text-[0.78rem] uppercase tracking-wider text-ink-3 font-mono">
            {step.visualState}
          </span>
        </div>

        {/* Content details */}
        <div className="space-y-3">
          <h3 className="font-display text-[1.08rem] font-semibold text-ink">
            {step.title}
          </h3>

          {/* User Turn */}
          {step.userText && (
            <div className="rounded-lg bg-surface-recessed p-3 text-[0.92rem]">
              <span className="block text-[0.75rem] font-semibold text-ink-3 uppercase tracking-wide">
                User describes task
              </span>
              <p className="mt-0.5 text-ink font-medium">&ldquo;{step.userText}&rdquo;</p>
            </div>
          )}

          {/* Barrier tag */}
          {step.barrierLabel && (
            <div className="flex items-center gap-2 text-[0.85rem]">
              <span className="text-ink-3 font-medium">Friction barrier:</span>
              <span className="inline-block rounded bg-[#E4F0EF] px-2 py-0.5 font-medium text-accent text-[0.82rem]">
                {step.barrierLabel}
              </span>
            </div>
          )}

          {/* Stay Response */}
          {step.stayResponse && (
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-[0.92rem]">
              <span className="block text-[0.75rem] font-semibold text-accent uppercase tracking-wide">
                Stay response
              </span>
              <p className="mt-0.5 text-ink leading-relaxed">&ldquo;{step.stayResponse}&rdquo;</p>
            </div>
          )}

          {/* Shrunk Action Card */}
          {step.firstStep && (
            <div className="rounded-lg border-2 border-accent bg-surface p-3.5 shadow-xs">
              <div className="flex items-center justify-between text-[0.78rem] text-accent font-semibold uppercase tracking-wide">
                <span>Agreed first step (sub-2 min)</span>
                {step.strategyLabel && <span className="text-ink-3 font-normal capitalize">{step.strategyLabel}</span>}
              </div>
              <p className="mt-1 font-medium text-ink text-[0.98rem]">{step.firstStep}</p>
            </div>
          )}

          {/* Outcome buttons on step 5 */}
          {currentStepIndex === 4 && (
            <div className="pt-2">
              <span className="block text-[0.82rem] font-medium text-ink-2 mb-2">
                Simulate your outcome response:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOutcomeSelected('started')}
                  className={`btn text-[0.88rem] py-1.5 px-3.5 ${
                    outcomeSelected === 'started' ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  ✓ I started
                </button>
                <button
                  type="button"
                  onClick={() => setOutcomeSelected('partly')}
                  className={`btn text-[0.88rem] py-1.5 px-3.5 ${
                    outcomeSelected === 'partly' ? 'btn-primary' : 'btn-secondary'
                  }`}
                >
                  ~ I partly started
                </button>
              </div>
              {outcomeSelected && (
                <p className="mt-3 text-[0.85rem] text-[#236B48] font-medium">
                  Logged to your local profile. Pattern updated: Reframing is now 1 of 1 started (100%).
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom control row */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <div className="flex items-center gap-2 text-[0.85rem] text-ink-3">
          <span className="h-2 w-2 rounded-full bg-accent/60" />
          <span>Interactive 45-second preview</span>
        </div>
        <div className="flex items-center gap-2">
          {currentStepIndex < PREVIEW_STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="btn btn-primary text-[0.9rem] py-1.5 px-4"
              data-testid="walkthrough-next-btn"
            >
              Advance preview →
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-secondary text-[0.9rem] py-1.5 px-3"
              >
                ↻ Replay
              </button>
              <Link
                href="/demo"
                className="btn btn-primary text-[0.9rem] py-1.5 px-4"
              >
                Try live in Demo →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
