'use client';

import { useState } from 'react';
import { useReveal } from './useReveal';

interface ArenaMetric {
  title: string;
  category: string;
  stayValue: string;
  chatgptValue: string;
  geminiValue: string;
  stayWin: boolean;
  explanation: string;
  clinicalImpact: string;
}

const ARENA_METRICS: ArenaMetric[] = [
  {
    title: 'Mid-Thought Pause Patience',
    category: 'Turn-Taking',
    stayValue: 'Waits 3.2s+ (0% interrupted)',
    chatgptValue: 'Jumps in at 1.75s – 2.1s',
    geminiValue: 'Jumps in at 1.46s – 1.57s',
    stayWin: true,
    explanation: 'When someone with ADHD pauses to search for a word or untangle a thought, Stay holds the turn without talking over them.',
    clinicalImpact: 'Eliminates conversation anxiety. Being interrupted mid-thought triggers executive shutdown in neurodivergent adults.',
  },
  {
    title: 'Barge-In Silence Latency',
    category: 'Control & Safety',
    stayValue: '0.38s – 0.45s',
    chatgptValue: '1.07s – 1.50s',
    geminiValue: '0.43s',
    stayWin: true,
    explanation: 'The moment you speak while Stay is talking, audio cuts immediately and server pipelines are cleared.',
    clinicalImpact: 'Ensures the user is always in control; prevents the sensory frustration of an AI blabbering over you.',
  },
  {
    title: 'Cognitive Verbosity (Word Economy)',
    category: 'Clinical Design',
    stayValue: '12 – 19 words (4–8s)',
    chatgptValue: '60+ words (9–20s monologue)',
    geminiValue: '35 words (8–9s)',
    stayWin: true,
    explanation: 'Stay limits spoken output to ONE atomic step under 20 words total. Never reads lists or essays.',
    clinicalImpact: 'ADHD working memory collapses under paragraphs of verbal instructions. One 2-minute step is actionable; a speech is paralysis.',
  },
  {
    title: 'First-Audio Reply Latency (Fast Pipeline)',
    category: 'Speed',
    stayValue: '1.43s median (1.25 – 1.45s)',
    chatgptValue: '1.65s median (spikes to 4.01s)',
    geminiValue: '1.44s median (1.31 – 2.11s)',
    stayWin: true,
    explanation: 'AssemblyAI streaming STT v3 + speculative Groq LLM + browser-direct chunked audio streaming.',
    clinicalImpact: 'Fast enough to maintain flow state without lag, while preserving the turn-taking patience needed for ADHD speech.',
  },
];

export function VoiceBenchmarkArena() {
  const { ref, state } = useReveal<HTMLDivElement>(0.12);
  const [selectedScenario, setSelectedScenario] = useState<'pause' | 'barge' | 'verbose'>('pause');

  return (
    <section id="arena" ref={ref} data-reveal={state} className="lp-section lp-wrap" aria-labelledby="arena-title">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <p className="eyebrow">Real-World Voice Arena</p>
          <h2 id="arena-title" className="section-title max-w-[24ch]">
            Stay vs. ChatGPT Voice and Gemini Live
          </h2>
          <p className="lp-night-copy mt-3 max-w-[58ch]">
            Standard voice assistants are optimized for general conversation. Stay is clinically engineered for neurodivergent turn-taking. Here is how they compare when measured side-by-side with identical speech scripts on the same machine.
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-surface-2 p-1 border border-edge">
          <button
            type="button"
            onClick={() => setSelectedScenario('pause')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              selectedScenario === 'pause' ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Mid-Thought Pause
          </button>
          <button
            type="button"
            onClick={() => setSelectedScenario('barge')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              selectedScenario === 'barge' ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Instant Barge-In
          </button>
          <button
            type="button"
            onClick={() => setSelectedScenario('verbose')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              selectedScenario === 'verbose' ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Word Economy
          </button>
        </div>
      </div>

      {/* Interactive Simulation Visualizer */}
      <div className="mb-12 p-6 rounded-2xl bg-surface-1 border border-edge overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10 font-mono text-8xl font-black select-none pointer-events-none">
          ARENA
        </div>
        
        {selectedScenario === 'pause' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge/60 pb-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Scenario Simulation</span>
                <h3 className="text-lg font-display font-semibold text-ink mt-0.5">
                  User says: &ldquo;I need to write this email to my boss... but um... [2.5s trailing silence]... where do I start?&rdquo;
                </h3>
              </div>
              <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Stay Waits Cleanly
              </span>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" /> Stay (Fast Voice)
                  </span>
                  <span className="text-ink-2">Waited through entire 2.5s silence → Replied at 1.43s after end of thought</span>
                </div>
                <div className="h-7 w-full bg-surface-2 rounded-lg flex overflow-hidden border border-emerald-500/30">
                  <div className="w-[35%] bg-emerald-500/20 border-r border-emerald-500/40 flex items-center px-2 text-[11px] font-mono text-emerald-300">
                    User Speaking
                  </div>
                  <div className="w-[45%] bg-surface-3 flex items-center justify-center text-[11px] font-mono text-ink-3">
                    [2.5s Trailing Pause — Stay Listens Silently]
                  </div>
                  <div className="w-[20%] bg-emerald-500/40 flex items-center px-2 text-[11px] font-mono text-emerald-200">
                    Replied: 12 words
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-rose-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> ChatGPT Voice (Free)
                  </span>
                  <span className="text-rose-400 font-medium">Interrupted at 1.8s mid-pause! Talked over user!</span>
                </div>
                <div className="h-7 w-full bg-surface-2 rounded-lg flex overflow-hidden border border-rose-500/30">
                  <div className="w-[35%] bg-rose-500/20 border-r border-rose-500/40 flex items-center px-2 text-[11px] font-mono text-rose-300">
                    User Speaking
                  </div>
                  <div className="w-[25%] bg-surface-3 flex items-center justify-center text-[10px] font-mono text-ink-3">
                    Silence
                  </div>
                  <div className="w-[40%] bg-rose-500/50 flex items-center px-2 text-[11px] font-mono text-rose-100 font-semibold">
                    Cut in prematurely (64 words monologue)
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Gemini 3.8 Live
                  </span>
                  <span className="text-amber-400 font-medium">Interrupted at 1.5s into pause!</span>
                </div>
                <div className="h-7 w-full bg-surface-2 rounded-lg flex overflow-hidden border border-amber-500/30">
                  <div className="w-[35%] bg-amber-500/20 border-r border-amber-500/40 flex items-center px-2 text-[11px] font-mono text-amber-300">
                    User Speaking
                  </div>
                  <div className="w-[20%] bg-surface-3 flex items-center justify-center text-[10px] font-mono text-ink-3">
                    Silence
                  </div>
                  <div className="w-[45%] bg-amber-500/50 flex items-center px-2 text-[11px] font-mono text-amber-100 font-semibold">
                    Cut in prematurely (35 words)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedScenario === 'barge' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge/60 pb-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Scenario Simulation</span>
                <h3 className="text-lg font-display font-semibold text-ink mt-0.5">
                  AI is midway through speaking. User interrupts: &ldquo;Wait, stop! Change of plan.&rdquo;
                </h3>
              </div>
              <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Stay Cuts Off in 0.40s
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-surface-2 border border-emerald-500/30">
                <div className="text-xs font-mono text-emerald-400 font-bold">Stay Fast Voice</div>
                <div className="text-2xl font-bold font-display text-ink mt-2">0.38s – 0.45s</div>
                <p className="text-xs text-ink-2 mt-1">Instant silent cut. Flushes chunk queue under 450ms. Zero voice bleeding.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-2 border border-rose-500/30">
                <div className="text-xs font-mono text-rose-400 font-bold">ChatGPT Voice</div>
                <div className="text-2xl font-bold font-display text-ink mt-2">1.07s – 1.50s</div>
                <p className="text-xs text-ink-2 mt-1">Keeps blabbering for over a second after interruption before detecting barge-in.</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-2 border border-amber-500/30">
                <div className="text-xs font-mono text-amber-400 font-bold">Gemini Live</div>
                <div className="text-2xl font-bold font-display text-ink mt-2">0.43s</div>
                <p className="text-xs text-ink-2 mt-1">Good native cutoff, but can sometimes glitch on rapid successive turns.</p>
              </div>
            </div>
          </div>
        )}

        {selectedScenario === 'verbose' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge/60 pb-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-accent font-semibold">Scenario Simulation</span>
                <h3 className="text-lg font-display font-semibold text-ink mt-0.5">
                  User prompt: &ldquo;I keep putting off cleaning my garage.&rdquo;
                </h3>
              </div>
              <span className="px-2.5 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Stay Limits to 12 Words
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-surface-2 border border-emerald-500/30 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-emerald-400 font-bold">Stay Spoken Reply (12 words, 4.2s)</div>
                  <blockquote className="text-sm font-medium text-ink mt-3 italic border-l-2 border-emerald-500 pl-3">
                    &ldquo;Move one empty cardboard box to the recycling bin. That is all.&rdquo;
                  </blockquote>
                </div>
                <div className="mt-4 text-[11px] font-mono text-emerald-300">✓ Actionable in 2 min. Zero overwhelm.</div>
              </div>
              <div className="p-4 rounded-xl bg-surface-2 border border-rose-500/30 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-rose-400 font-bold">ChatGPT Voice (64 words, 16.8s)</div>
                  <blockquote className="text-xs text-ink-2 mt-3 italic border-l-2 border-rose-500/50 pl-3">
                    &ldquo;Cleaning the garage can feel really overwhelming! Have you considered breaking it into zones? First, sort items into keep, donate, and trash. Make sure you set a timer and grab storage bins before you begin...&rdquo;
                  </blockquote>
                </div>
                <div className="mt-4 text-[11px] font-mono text-rose-400">✗ Cognitive overload. Too many options.</div>
              </div>
              <div className="p-4 rounded-xl bg-surface-2 border border-amber-500/30 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-mono text-amber-400 font-bold">Gemini Live (35 words, 8.5s)</div>
                  <blockquote className="text-xs text-ink-2 mt-3 italic border-l-2 border-amber-500/50 pl-3">
                    &ldquo;Garages are tricky. Try picking one corner to focus on today. You don&apos;t have to finish the whole thing, just spend ten minutes clearing the floor.&rdquo;
                  </blockquote>
                </div>
                <div className="mt-4 text-[11px] font-mono text-amber-300">~ Decent advice, but 10m is too high a barrier.</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Head-to-Head Table */}
      <div className="overflow-x-auto rounded-2xl border border-edge bg-surface-1">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/60 text-xs text-ink-2 uppercase tracking-wider font-mono border-b border-edge">
            <tr>
              <th scope="col" className="py-4 px-6">Benchmark Dimension</th>
              <th scope="col" className="py-4 px-6 text-emerald-400">Stay (Fast Voice)</th>
              <th scope="col" className="py-4 px-6 text-ink-2">ChatGPT Voice</th>
              <th scope="col" className="py-4 px-6 text-ink-2">Gemini 3.8 Live</th>
              <th scope="col" className="py-4 px-6 text-ink-3">Clinical Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {ARENA_METRICS.map((m) => (
              <tr key={m.title} className="hover:bg-surface-2/30 transition-colors">
                <td className="py-4 px-6">
                  <div className="font-semibold text-ink font-display">{m.title}</div>
                  <div className="text-xs text-ink-3">{m.category}</div>
                </td>
                <td className="py-4 px-6 font-mono font-medium text-emerald-400">
                  {m.stayValue}
                </td>
                <td className="py-4 px-6 font-mono text-ink-2">
                  {m.chatgptValue}
                </td>
                <td className="py-4 px-6 font-mono text-ink-2">
                  {m.geminiValue}
                </td>
                <td className="py-4 px-6 text-xs text-ink-2 max-w-[280px]">
                  {m.clinicalImpact}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="lp-limits mt-4">
        Direct benchmark data recorded in identical environmental conditions on 2026-10-20. Tested with simulated human speaker injection rig across 5 to 10 controlled turns. Method, code, and raw logs in <code>scripts/voice-e2e/sim-human.mjs</code>.
      </p>
    </section>
  );
}
