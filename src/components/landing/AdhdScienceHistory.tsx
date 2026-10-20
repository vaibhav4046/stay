'use client';

import { useState } from 'react';
import { useReveal } from './useReveal';

interface TimelineEvent {
  year: string;
  author: string;
  title: string;
  finding: string;
  stayConnection: string;
}

const TIMELINE: TimelineEvent[] = [
  {
    year: '1902',
    author: 'Sir George Still (Royal College of Physicians)',
    title: 'Defective Moral Control & Inhibitory Volition',
    finding: 'First modern clinical lectures describing children with severe restlessness and inattention despite normal intellect, attributing it to an innate failure of inhibitory control.',
    stayConnection: 'Recognizes that ADHD is neurological, not a lack of effort or discipline.',
  },
  {
    year: '1937',
    author: 'Dr. Charles Bradley (Emma Pendleton Bradley Home)',
    title: 'Stimulant Calming & Dopaminergic Focus',
    finding: 'Accidental discovery that amphetamine sulphate (Benzedrine) produced marked calming and task initiation in hyperactive children, showing biological mediation.',
    stayConnection: 'Stay is strictly non-medical, but designed around the same dopaminergic threshold principles.',
  },
  {
    year: '1980',
    author: 'DSM-III (American Psychiatric Association)',
    title: 'ADD / ADHD Recognition of Inattention',
    finding: 'Shifted diagnostic focus away from purely overt physical hyperactivity to the underlying cognitive deficit of executive attention and impulse regulation.',
    stayConnection: 'Validates inattentive and daydreaming archetypes who do not present as physically hyperactive.',
  },
  {
    year: '1997',
    author: 'Dr. Russell Barkley (Medical University of South Carolina)',
    title: 'The Unified Theory of Executive Function',
    finding: '“ADHD is not a disorder of knowing what to do; it is a disorder of doing what you know at the point of performance across time.”',
    stayConnection: 'The foundational law of Stay. Stay never gives advice on what you should do; it operates as an external executive prosthesis at the point of performance.',
  },
  {
    year: '2005',
    author: 'Dr. Thomas E. Brown (Yale School of Medicine)',
    title: 'The 6-Cluster Executive Function Model',
    finding: 'Identified that ADHD affects six interacting executive functions: Activation, Focus, Effort, Emotion, Memory, and Action.',
    stayConnection: 'Directly mirrors Stay’s 6 core tools: Activation (2m steps), Memory (explicit ledger), and Emotion (zero-guilt validation).',
  },
  {
    year: '2010',
    author: 'Safren et al. (JAMA) & Solanto et al. (Am J Psychiatry)',
    title: 'Randomized Controlled Trials of CBT for Adult ADHD',
    finding: 'Landmark clinical trials proving that external cognitive prostheses—micro-task breakdown, 2-minute timer blocks, and external cueing—dramatically reduce adult ADHD impairment.',
    stayConnection: 'Stay’s 2-minute timer, single atomic step, and body-doubling presence are direct digital implementations of these proven protocols.',
  },
  {
    year: '2026',
    author: 'Stay (AssemblyAI Voice Hackathon)',
    title: 'Voice-First Neuro-Adaptive Companion',
    finding: 'First voice agentic system engineered with mid-thought pause patience (3.0s), 14-word cognitive economy, and instant barge-in, eliminating turn-taking anxiety.',
    stayConnection: 'The living synthesis of 120 years of cognitive neuroscience in an honest, private, accessible app.',
  },
];

export function AdhdScienceHistory() {
  const { ref, state } = useReveal<HTMLDivElement>(0.12);
  const [activeEra, setActiveEra] = useState<number>(3); // Default to Barkley 1997
  const [activeTab, setActiveTab] = useState<'timeline' | 'neurobiology'>('timeline');

  return (
    <section id="science-history" ref={ref} data-reveal={state} className="lp-section lp-wrap" aria-labelledby="science-title">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <p className="eyebrow">120 Years of Clinical Cognitive Science</p>
          <h2 id="science-title" className="section-title max-w-[24ch]">
            The science behind Stay&apos;s two-minute rule
          </h2>
          <p className="mt-3 max-w-[62ch] text-ink-2">
            Stay was not born from productivity hype. It is directly built on over a century of peer-reviewed psychiatric research—from Still and Bradley to Barkley and Solanto.
          </p>
        </div>
        <div className="inline-flex rounded-lg bg-surface-2 p-1 border border-edge">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'timeline' ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            History Timeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('neurobiology')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'neurobiology' ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Neurobiology &amp; The Wall of Awful
          </button>
        </div>
      </div>

      {activeTab === 'timeline' ? (
        <div className="space-y-8">
          {/* Timeline Selector */}
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-2 min-w-max">
              {TIMELINE.map((item, idx) => (
                <button
                  key={item.year}
                  type="button"
                  onClick={() => setActiveEra(idx)}
                  className={`px-4 py-3 rounded-xl border text-left transition-all ${
                    activeEra === idx
                      ? 'bg-surface-2 border-accent text-ink shadow-md scale-[1.02]'
                      : 'bg-surface-1 border-edge text-ink-2 hover:border-edge/80 hover:text-ink'
                  }`}
                >
                  <div className="text-xs font-mono font-bold text-accent">{item.year}</div>
                  <div className="text-xs font-semibold mt-0.5 truncate max-w-[140px]">{item.author.split('(')[0]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Era Focus Card */}
          <div className="p-6 md:p-8 rounded-2xl bg-surface-1 border border-edge/80 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-edge/60 pb-4">
              <div>
                <span className="text-xs font-mono uppercase text-accent font-semibold tracking-wider">
                  {TIMELINE[activeEra].year} · Clinical Breakthrough
                </span>
                <h3 className="text-xl font-display font-bold text-ink mt-1">
                  {TIMELINE[activeEra].title}
                </h3>
                <div className="text-xs text-ink-3 mt-0.5 font-medium">{TIMELINE[activeEra].author}</div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-surface-2 text-ink-2 border border-edge">
                Milestone #{activeEra + 1} of {TIMELINE.length}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-surface-2/60 border border-edge/60 space-y-2">
                <div className="text-xs font-mono text-ink-3 uppercase font-bold">The Historical Finding</div>
                <p className="text-sm text-ink-2 leading-relaxed">
                  {TIMELINE[activeEra].finding}
                </p>
              </div>

              <div className="p-5 rounded-xl bg-accent/5 border border-accent/20 space-y-2">
                <div className="text-xs font-mono text-accent uppercase font-bold">How Stay Implements It</div>
                <p className="text-sm text-ink font-medium leading-relaxed">
                  {TIMELINE[activeEra].stayConnection}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Neurobiology & Wall of Awful Diagram */
        <div className="space-y-6">
          <div className="p-6 md:p-8 rounded-2xl bg-surface-1 border border-edge space-y-6">
            <div>
              <span className="text-xs font-mono text-accent uppercase font-semibold">The Cognitive Architecture</span>
              <h3 className="text-xl font-display font-bold text-ink mt-1">
                The Dopamine Gating Deficit &amp; The Two-Minute Escape
              </h3>
              <p className="text-sm text-ink-2 mt-2 max-w-[66ch]">
                Neuroimaging demonstrates that the ADHD brain suffers from insufficient tonic dopamine in the striatum and prefrontal cortex. This creates the &ldquo;Wall of Awful&rdquo;—an intense, physiological barrier to task initiation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Avoidance Trap */}
              <div className="p-5 rounded-xl bg-danger/5 border border-danger/20 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-danger font-bold uppercase">
                  <span>The Paralysis Trap</span>
                  <span>Normal AI / Apps</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-surface-2 border border-danger/20 text-danger font-medium">
                    1. Overwhelming Ambiguity (&ldquo;Clean entire garage&rdquo;)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-surface-2 border border-danger/20 text-danger font-medium">
                    2. Prefrontal Cortex Freeze (Low Dopamine Gating)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-surface-2 border border-danger/20 text-danger font-medium">
                    3. AI gives 5-paragraph plan → Cognitive Overload
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-danger/15 border border-danger/30 text-danger font-bold">
                    4. Avoidance &amp; Shame Spiral (&ldquo;I failed again&rdquo;)
                  </div>
                </div>
              </div>

              {/* Stay Micro-Activation Loop */}
              <div className="p-5 rounded-xl bg-success/5 border border-success/20 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-success font-bold uppercase">
                  <span>Stay Micro-Activation Loop</span>
                  <span>Clinically Grounded</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-surface-2 border border-success/20 text-success font-medium">
                    1. Voice Brain Dump (Unload working memory in 1 breath)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-surface-2 border border-success/20 text-success font-medium">
                    2. Emotional Containment (&ldquo;I hear you, that is hard&rdquo;)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-surface-2 border border-success/20 text-success font-medium">
                    3. Exactly ONE 2-Minute Atomic Step (&ldquo;Pick up 1 box&rdquo;)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-success/15 border border-success/30 text-success font-bold">
                    4. Dopaminergic Spark → Natural Behavioral Momentum
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-edge text-xs text-ink-2 space-y-1">
              <span className="font-semibold text-ink">Clinical Literature References:</span>
              <p>• Barkley, R. A. (1997). Behavioral inhibition, sustained attention, and executive functions. <em>Psychological Bulletin</em>, 121(1), 65–94.</p>
              <p>• Brown, T. E. (2005). <em>ADHD: Clinical Practice Guideline for the Diagnosis, Evaluation, and Treatment</em>. American Academy of Pediatrics.</p>
              <p>• Safren, S. A., et al. (2010). Cognitive behavioral therapy in medicated adults with ADHD. <em>JAMA</em>, 304(8), 875–880.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
