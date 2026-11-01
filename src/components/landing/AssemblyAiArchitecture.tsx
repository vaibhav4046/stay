'use client';

import { useState } from 'react';
import { useReveal } from './useReveal';

interface PipelineStage {
  id: string;
  name: string;
  role: string;
  timing: string;
  assemblyAiTech: string;
  payload: string;
  adhdRationale: string;
  details: string[];
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'stt-stream',
    name: 'Hears you live',
    role: 'Speech turns into text as you talk',
    timing: 'No button to hold',
    assemblyAiTech: 'AssemblyAI streaming speech-to-text (Universal-3.6 Pro)',
    payload: 'Your voice goes from your browser straight to AssemblyAI',
    adhdRationale: 'You just talk. There is nothing to hold down and no recording to wait for.',
    details: [
      'Your browser connects to AssemblyAI with a short-lived pass. Our account key stays on our server.',
      'Your words appear on screen while you are still speaking.',
      'Stay\u2019s own server never receives your audio. AssemblyAI\u2019s handling of it is in its privacy terms.',
    ],
  },
  {
    id: 'keyterms',
    name: 'Knows your words',
    role: 'Names and terms you add',
    timing: 'You set it up once',
    assemblyAiTech: 'AssemblyAI keyterms_prompt',
    payload: 'Up to 100 names and terms from Settings > My words',
    adhdRationale: 'Being misheard on your own name or a word you use often is tiring. This helps with that.',
    details: [
      'You add names and terms in Settings.',
      'The recogniser favours them when it is unsure what it heard.',
      'Accuracy for specific accents has not been measured, so none is claimed.',
    ],
  },
  {
    id: 'turn-gate',
    name: 'Waits for you to finish',
    role: 'Pauses are not the end',
    timing: 'About 2 seconds of patience',
    assemblyAiTech: 'AssemblyAI turn detection plus Stay\u2019s own hold',
    payload: 'Trailing words such as \u201cand\u2026\u201d or \u201cum\u2026\u201d, and how long the silence lasts',
    adhdRationale: 'Many people with ADHD pause mid-thought. In a small test on 19 Oct 2026 two other voice products began talking after about 1.5 to 2.1 s of silence; Stay waited. One laptop, few runs.',
    details: [
      'Notices when you trail off and keeps listening.',
      'Starts preparing a reply when a sentence looks finished, and throws it away if you keep talking.',
    ],
  },
  {
    id: 'tts-visemes',
    name: 'Speaks back',
    role: 'A calm voice, short replies',
    timing: 'One continuous voice',
    assemblyAiTech: 'AssemblyAI streaming text-to-speech (assemblyai-tts-1)',
    payload: 'Each reply is spoken as one piece so it does not stutter',
    adhdRationale: 'Short, steady, and never a wall of text.',
    details: [
      'Replies are a few words, then one small step.',
      'The words on screen follow the voice as it speaks.',
      'Measured on the live service: sending each sentence separately added about half a second of silence at every join, so Stay sends the whole reply at once.',
    ],
  },
  {
    id: 'barge-in',
    name: 'Lets you interrupt',
    role: 'Your voice is the stop button',
    timing: 'Quiets as you start',
    assemblyAiTech: 'AssemblyAI speech-start signal and cancel',
    payload: 'Stay lowers its volume when you start, and stops on your first words',
    adhdRationale: 'If you need to stop Stay or correct yourself, it stops talking. Stop time is measured in the test lab, not claimed here.',
    details: [
      'When you speak over Stay it gets quieter, then stops.',
      'It ignores its own voice coming back through your speakers.',
    ],
  },
];
export function AssemblyAiArchitecture() {
  const [activeStage, setActiveStage] = useState<string>('stt-stream');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simStep, setSimStep] = useState<number>(-1);
  const { ref, state } = useReveal<HTMLElement>();

  const current = PIPELINE_STAGES.find((s) => s.id === activeStage) || PIPELINE_STAGES[0];

  function runSimulation() {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep(0);
    setActiveStage(PIPELINE_STAGES[0].id);

    PIPELINE_STAGES.forEach((stage, index) => {
      setTimeout(() => {
        setSimStep(index);
        setActiveStage(stage.id);
        if (index === PIPELINE_STAGES.length - 1) {
          setTimeout(() => {
            setIsSimulating(false);
            setSimStep(-1);
          }, 1500);
        }
      }, index * 1200);
    });
  }

  return (
    <section
      id="architecture"
      ref={ref}
      data-reveal={state}
      className="lp-section lp-tint"
      aria-labelledby="arch-title"
      data-testid="assemblyai-architecture"
    >
      <div className="lp-wrap">
        <p className="eyebrow">How it works</p>
        <h2 id="arch-title" className="section-title max-w-[28ch]">
          How Stay hears you and talks back
        </h2>
        <p className="mt-3 max-w-[66ch] text-ink-2">
          Everything runs on AssemblyAI: it turns your speech into text as you talk, and it speaks the reply. Stay adds the patience, the short replies and the one small step.
        </p>

        {/* Pipeline Flow Visualization */}
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-ink sm:text-lg">
                From your voice to Stay's reply
              </h3>
              <p className="text-xs text-ink-2 sm:text-sm">
                Pick a step to see what happens, or replay the steps one by one.
              </p>
            </div>
            <button
              type="button"
              onClick={runSimulation}
              disabled={isSimulating}
              aria-label="Replay the five steps one by one"
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-4 py-2 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-surface disabled:opacity-50"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isSimulating ? 'animate-ping bg-caution' : 'bg-success'
                }`}
                aria-hidden="true"
              />
              {isSimulating ? `Step ${simStep + 1} of 5...` : 'Replay the steps'}
            </button>
          </div>

          {/* Stepper Grid */}
          <div className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2 md:grid-cols-5">
            {PIPELINE_STAGES.map((s, idx) => {
              const isSelected = activeStage === s.id;
              const isCurrentSim = simStep === idx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveStage(s.id)}
                  aria-pressed={isSelected}
                  aria-label={`View stage ${s.name}: ${s.role}`}
                  className={`group flex flex-col items-start rounded-xl p-3 text-left transition ${
                    isSelected
                      ? 'border-2 border-ink bg-surface shadow-md'
                      : 'border border-ink/10 bg-paper/60 hover:border-ink/20 hover:bg-paper'
                  } ${isCurrentSim ? 'ring-2 ring-caution' : ''}`}
                >
                  <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-ink-2">
                    {s.timing}
                  </span>
                  <span className="mt-1 font-display text-sm font-semibold text-ink group-hover:text-ink">
                    {s.name}
                  </span>
                  <span className="mt-1 text-xs text-ink-2 line-clamp-1">{s.role}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stage Deep Dive Card */}
        <div className="mt-6 rounded-2xl border border-ink/10 bg-surface p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-ink/5 px-2.5 py-1 text-xs font-mono font-medium text-ink">
                  {current.timing}
                </span>
                <span className="rounded-md bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                  Made with AssemblyAI
                </span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">
                {current.name}: {current.role}
              </h3>
            </div>
            <div className="rounded-lg border border-ink/10 bg-paper px-3 py-2 text-xs">
              <span className="font-semibold text-ink">AssemblyAI feature: </span>
              <span className="font-mono text-ink-2">{current.assemblyAiTech}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-2">
                What is sent
              </h4>
              <p className="mt-2 rounded-lg bg-ink/5 p-3 font-mono text-xs text-ink">
                {current.payload}
              </p>

              <h4 className="mt-6 text-xs font-mono font-semibold uppercase tracking-wider text-ink-2">
                Why this helps
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                {current.adhdRationale}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-2">
                What Stay does
              </h4>
              <ul className="mt-2 space-y-2.5 text-sm text-ink-2">
                {current.details.map((d) => (
                  <li key={d} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
