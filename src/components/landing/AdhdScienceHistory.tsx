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
    title: 'Early Clinical Observation of Attention & Task Initiation',
    finding: 'Early clinical reports observing task initiation and attention difficulties in children, shifting focus toward structured environmental support.',
    stayConnection: 'Stay is strictly non-medical and never comments on medication, doses, or biological mechanisms.',
  },
  {
    year: '1980',
    author: 'DSM-III (American Psychiatric Association)',
    title: 'ADD / ADHD Recognition of Inattention',
    finding: 'Shifted focus away from purely overt physical hyperactivity to the underlying difficulty of executive attention and task persistence.',
    stayConnection: 'Supports quiet, inattentive, and overwhelmed moments without requiring high-energy interaction.',
  },
  {
    year: '1997',
    author: 'Dr. Russell Barkley (Medical University of South Carolina)',
    title: 'Executive Function at the Point of Performance',
    finding: '“ADHD is not a disorder of knowing what to do; it is a disorder of doing what you know at the point of performance across time.”',
    stayConnection: 'Stay focuses on externalising the very next small physical action right when you are trying to start.',
  },
  {
    year: '2005',
    author: 'Dr. Thomas E. Brown (Yale School of Medicine)',
    title: 'The 6-Cluster Executive Function Model',
    finding: 'Described six interacting executive functions: Activation, Focus, Effort, Emotion, Memory, and Action.',
    stayConnection: 'Informs Stay’s practical tools: tiny activation steps, an explicit local memory list, and non-shaming wording.',
  },
  {
    year: '2010',
    author: 'Safren et al. (JAMA, n=86) & Solanto et al. (Am J Psychiatry, n=88)',
    title: 'Trials of Structured Skills Training for Adult ADHD',
    finding: 'Clinical trials of clinician-led skills programs (Safren et al., 2010, JAMA, n=86; Solanto et al., 2010, Am J Psychiatry, n=88) tested breaking overwhelming tasks into small steps and using external timers.',
    stayConnection: 'Stay is not therapy or CBT, and has not been clinically trialled; it adapts the practical habit of picking one small step and an external timer.',
  },
  {
    year: '2026',
    author: 'Stay (AssemblyAI Voice Hackathon)',
    title: 'Voice-First Companion for Starting & Visit Prep',
    finding: 'Combines streaming speech-to-text, two-stage barge-in, deterministic corrections, and a one-page appointment prep handout.',
    stayConnection: 'A practical, private self-help tool — not a medical device, diagnosis, or clinician.',
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
              activeTab === 'timeline' ? 'bg-primary text-[#08090B] shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            History Timeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('neurobiology')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === 'neurobiology' ? 'bg-primary text-[#08090B] shadow-sm' : 'text-ink-2 hover:text-ink'
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
              <span className="text-xs font-mono text-accent uppercase font-semibold">Practical Task Initiation</span>
              <h3 className="text-xl font-display font-bold text-ink mt-1">
                Task Friction &amp; The Two-Minute First Step
              </h3>
              <p className="text-sm text-ink-2 mt-2 max-w-[66ch]">
                When a task feels ambiguous or emotionally heavy, executive initiation stalls. Stay is a practical self-help tool (not therapy or medical treatment) that shrinks the starting threshold to a single concrete action.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Avoidance Trap */}
              <div className="p-5 rounded-xl bg-danger/5 border border-danger/20 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-danger font-bold uppercase">
                  <span>The Paralysis Trap</span>
                  <span>Long Plans</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-surface-2 border border-danger/20 text-danger font-medium">
                    1. Overwhelming Ambiguity (&ldquo;Clean entire garage&rdquo;)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-surface-2 border border-danger/20 text-danger font-medium">
                    2. Working Memory Overload (Too many unranked steps)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-surface-2 border border-danger/20 text-danger font-medium">
                    3. Assistant gives 5-paragraph plan → Decision Fatigue
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-danger/15 border border-danger/30 text-danger font-bold">
                    4. Avoidance &amp; Guilt (&ldquo;I still haven&apos;t started&rdquo;)
                  </div>
                </div>
              </div>

              {/* Stay Micro-Activation Loop */}
              <div className="p-5 rounded-xl bg-success/5 border border-success/20 space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-success font-bold uppercase">
                  <span>Stay Small-Step Loop</span>
                  <span>Practical Self-Help</span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="p-2.5 rounded bg-surface-2 border border-success/20 text-success font-medium">
                    1. Speak or Type the Avoided Task
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-surface-2 border border-success/20 text-success font-medium">
                    2. Brief Non-Shaming Acknowledgement (≤ 6 words)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-surface-2 border border-success/20 text-success font-medium">
                    3. One Concrete 2-Minute Step (&ldquo;Pick up 1 box&rdquo;)
                  </div>
                  <div className="text-center text-ink-3">↓</div>
                  <div className="p-2.5 rounded bg-success/15 border border-success/30 text-success font-bold">
                    4. Visible Timer + Check-In (&ldquo;Keep going, smaller, or stop?&rdquo;)
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-2 border border-edge text-xs text-ink-2 space-y-1">
              <span className="font-semibold text-ink">Background Reading &amp; Limits (§2.6):</span>
              <p>• Safren, S. A., et al. (2010). Cognitive behavioral therapy vs relaxation with educational support for medication-treated adults with ADHD and persistent symptoms: a randomized controlled trial (n=86). <em>JAMA</em>, 304(8), 875–880.</p>
              <p>• Solanto, M. V., et al. (2010). Efficacy of meta-cognitive therapy for adult ADHD (n=88). <em>American Journal of Psychiatry</em>, 167(8), 958–968.</p>
              <p>• Gollwitzer, P. M., &amp; Sheeran, P. (2006). Implementation intentions and goal achievement: A meta-analysis of effects and processes (94 studies, d=0.65). <em>Advances in Experimental Social Psychology</em>, 38, 69–119.</p>
              <p>• Body doubling (working alongside another person or quiet companion) is community-reported by adults with ADHD; controlled clinical evidence is still emerging.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
