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
    name: '1. Streaming STT v3',
    role: 'Browser-Direct Speech Ingestion',
    timing: 'Sub-300ms end-of-turn',
    assemblyAiTech: 'AssemblyAI Streaming STT (universal-3-6-pro)',
    payload: '16kHz mono PCM chunks over wss://streaming.assemblyai.com',
    adhdRationale: 'Eliminates recording lag and transcribes speech live without requiring the user to hold down a button or wait.',
    details: [
      'Direct browser-to-AssemblyAI WebSocket connection with ephemeral short-lived JWT credentials from /api/voice/fast-token.',
      'Continuous partial transcripts stream back within ~120ms to update the interface in real time.',
      'Zero audio persistence on servers: audio streams straight through memory for session lifetime only.',
    ],
  },
  {
    id: 'keyterms',
    name: '2. Acoustic Keyterms Biasing',
    role: 'Phonetic Accuracy Engine',
    timing: 'Pre-session configuration',
    assemblyAiTech: 'keyterms_prompt API parameter',
    payload: 'Biased vocabulary: "wall of awful", "two-minute timer", "brain dump", 22 persona names',
    adhdRationale: 'Adults with ADHD use specialized colloquial and therapeutic phrases. Mishearing "wall of awful" or "park it" breaks trust.',
    details: [
      'Injected into the AssemblyAI session handshake via appKeyterms() configuration array.',
      'Boosts log-likelihood of clinical ADHD terminology and multi-word trigger expressions.',
      'Prevents phonetic confusion across native accents including Indian English and Mexican Spanish.',
    ],
  },
  {
    id: 'turn-gate',
    name: '3. Turn-Taking Patience Gate',
    role: 'Hesitation & Silence Evaluator',
    timing: '2.5s – 3.0s dynamic hold',
    assemblyAiTech: 'FastSocket turn-state arbitration',
    payload: 'Trailing punctuation, filler tokens ("um", "and..."), and silence duration',
    adhdRationale: 'Neurodivergent speakers experience word-finding pauses. Conventional voice assistants interrupt at 1.5s; Stay waits.',
    details: [
      'Inspects partial transcripts for syntactic completion vs trailing thoughts.',
      'Holds the turn when speech ends on trailing conjunctions or fillers rather than dispatching early.',
      'Speculatively prepares LLM response when an end-of-sentence marker arrives, saving 200–400ms when confirmed.',
    ],
  },
  {
    id: 'tts-visemes',
    name: '4. Streaming TTS & Procedural Visemes',
    role: 'Voice Synthesis & Lip-Sync',
    timing: 'Chunked audio playback',
    assemblyAiTech: 'AssemblyAI Streaming TTS',
    payload: 'Binary PCM chunks via wss://streaming-tts.assemblyai.com',
    adhdRationale: 'Provides a calm, non-demanding visual presence. Mouth moves with real voice acoustics rather than pre-rendered loops.',
    details: [
      'Decodes streaming PCM chunks into 50Hz audio envelopes measuring RMS loudness and high-frequency spectral brightness.',
      'Drives 5,200 mathematical SDF points in WebGL/Canvas to deform mouth opening, vowel width, and breathing oscillations.',
      'Emits concise replies: strictly 4 to 10 spoken words (< 20 word cognitive ceiling) to prevent executive overwhelm.',
    ],
  },
  {
    id: 'barge-in',
    name: '5. Instant Barge-In Bus',
    role: 'Hardware Stop & Pipeline Flush',
    timing: '0.38s – 0.45s cutoff',
    assemblyAiTech: 'AssemblyAI speech onset trigger + FastSocket flush',
    payload: 'Cancel packet + lipSyncBus.reset() + AudioContext buffer discard',
    adhdRationale: 'Eliminates sensory agitation. If you need to stop Stay or correct your thought, the audio immediately falls silent.',
    details: [
      'Triggers on the very first frame of user speech detected by AssemblyAI streaming STT.',
      'Immediately cuts scheduled audio in the Web Audio buffer queue.',
      'Resets therapist orb deformation back to neutral listening shape in under 450ms.',
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
        <p className="eyebrow">Technical Architecture</p>
        <h2 id="arch-title" className="section-title max-w-[28ch]">
          The AssemblyAI real-time voice pipeline
        </h2>
        <p className="mt-3 max-w-[66ch] text-ink-2">
          Stay does not use a black-box voice wrapper. We engineered a dual-socket, low-latency conversational pipeline
          using AssemblyAI streaming STT, acoustic keyterm biasing, turn-taking arbitration, and streaming TTS with
          viseme decomposition.
        </p>

        {/* Pipeline Flow Visualization */}
        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-ink/10 bg-surface p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-ink sm:text-lg">
                Conversational Pipeline Flow
              </h3>
              <p className="text-xs text-ink-2 sm:text-sm">
                Select a stage to inspect its AssemblyAI implementation, or simulate a live user turn.
              </p>
            </div>
            <button
              type="button"
              onClick={runSimulation}
              disabled={isSimulating}
              aria-label="Simulate audio packet flowing through AssemblyAI pipeline"
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-4 py-2 text-xs font-medium text-ink transition hover:border-ink/30 hover:bg-surface disabled:opacity-50"
            >
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isSimulating ? 'animate-ping bg-amber-500' : 'bg-emerald-500'
                }`}
                aria-hidden="true"
              />
              {isSimulating ? `Transmitting (Stage ${simStep + 1} of 5)...` : 'Simulate Live Turn'}
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
                  } ${isCurrentSim ? 'ring-2 ring-amber-500' : ''}`}
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
                <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  AssemblyAI Integration
                </span>
              </div>
              <h3 className="mt-2 font-display text-xl font-bold text-ink sm:text-2xl">
                {current.name}: {current.role}
              </h3>
            </div>
            <div className="rounded-lg border border-ink/10 bg-paper px-3 py-2 text-xs">
              <span className="font-semibold text-ink">AssemblyAI Technology: </span>
              <span className="font-mono text-ink-2">{current.assemblyAiTech}</span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-2">
                Wire Protocol & Payload
              </h4>
              <p className="mt-2 rounded-lg bg-ink/5 p-3 font-mono text-xs text-ink">
                {current.payload}
              </p>

              <h4 className="mt-6 text-xs font-mono font-semibold uppercase tracking-wider text-ink-2">
                ADHD Clinical Impact
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                {current.adhdRationale}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-2">
                Implementation Details
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
