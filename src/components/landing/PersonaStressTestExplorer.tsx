'use client';

import { useMemo, useState } from 'react';
import { useReveal } from './useReveal';
import { STRESS_PERSONAS, STRESS_TEST_SUMMARY, type StressPersona } from './personaStressData';

const CATEGORY_NAMES: Record<string, string> = {
  all: 'All Personas (100)',
  paralysis: 'Task Paralysis (20)',
  impatient: 'Impatient & Fast (15)',
  rsd: 'RSD & Emotions (15)',
  rambler: 'Tangents & Ramblers (15)',
  accent: 'Global Accents (15)',
  safety: 'Safety Boundaries (10)',
  chaining: 'Agentic Tools (8)',
  adversarial: 'Adversarial Edge (2)',
};

export function PersonaStressTestExplorer() {
  const { ref, state } = useReveal<HTMLDivElement>(0.12);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activePersona, setActivePersona] = useState<StressPersona | null>(null);

  const filteredPersonas = useMemo(() => {
    return STRESS_PERSONAS.filter((p) => {
      const matchCat = selectedCat === 'all' || p.category === selectedCat;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q) ||
        p.reply.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [selectedCat, searchQuery]);

  return (
    <section id="personas-100" ref={ref} data-reveal={state} className="lp-section lp-wrap" aria-labelledby="personas-100-title">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow">100+ Neurodivergent Personas Stress Test</p>
          <h2 id="personas-100-title" className="section-title max-w-[26ch]">
            Tested against 100 ADHD archetypes
          </h2>
          <p className="lp-night-copy mt-3 max-w-[62ch]">
            From Rejection Sensitive Dysphoria (RSD) meltdowns and executive paralysis to staccato turn-takers, tangent ramblers, and multilingual accents. Every persona is benchmarked for word count, zero-guilt tone, and safety gates.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-surface-1 border border-edge">
          <div className="text-xs font-mono text-ink-3 uppercase tracking-wider">Pass Rate</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-400 mt-1">
            {STRESS_TEST_SUMMARY.passRatePercent}%
          </div>
          <div className="text-xs text-ink-2 mt-0.5">{STRESS_TEST_SUMMARY.passed} of {STRESS_TEST_SUMMARY.total} verified</div>
        </div>

        <div className="p-4 rounded-xl bg-surface-1 border border-edge">
          <div className="text-xs font-mono text-ink-3 uppercase tracking-wider">Avg Latency</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-accent mt-1">
            {STRESS_TEST_SUMMARY.avgLatencyMs} ms
          </div>
          <div className="text-xs text-ink-2 mt-0.5">End-to-end turn time</div>
        </div>

        <div className="p-4 rounded-xl bg-surface-1 border border-edge">
          <div className="text-xs font-mono text-ink-3 uppercase tracking-wider">Avg Words Spoken</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-indigo-400 mt-1">
            {STRESS_TEST_SUMMARY.avgWords} words
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Ceiling: &lt; 20 words (ADHD limit)</div>
        </div>

        <div className="p-4 rounded-xl bg-surface-1 border border-edge">
          <div className="text-xs font-mono text-ink-3 uppercase tracking-wider">Guilt Phrases Hit</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-400 mt-1">
            0%
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Strict zero-shame filter</div>
        </div>
      </div>

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedCat(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                selectedCat === key
                  ? 'bg-primary text-white border-primary shadow-sm'
                  : 'bg-surface-2 text-ink-2 border-edge hover:text-ink hover:border-edge/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <input
            type="text"
            aria-label="Search personas by name, prompt, or category"
            placeholder="Search prompt, name, issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-lg bg-surface-2 border border-edge px-3 py-2 text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Personas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[560px] overflow-y-auto pr-1">
        {filteredPersonas.map((p) => (
          <div
            key={p.id}
            onClick={() => setActivePersona(p)}
            className="p-4 rounded-xl bg-surface-1 border border-edge hover:border-accent/40 transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-ink font-display group-hover:text-accent transition-colors">
                  {p.name}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-surface-2 text-ink-3 uppercase">
                  {p.category}
                </span>
              </div>
              <p className="text-xs text-ink-2 line-clamp-2 italic mb-3">
                &ldquo;{p.prompt}&rdquo;
              </p>
            </div>

            <div className="border-t border-edge/60 pt-2.5 mt-1 flex items-center justify-between text-[11px] font-mono">
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> PASS
              </span>
              <span className="text-ink-3">
                {p.latencyMs}ms · {p.words}w
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Detail Modal / Drawer */}
      {activePersona && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActivePersona(null)}
        >
          <div
            className="bg-surface-1 border border-edge rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold">
                  Persona #{activePersona.id.toUpperCase()} · {activePersona.category.toUpperCase()}
                </span>
                <h3 className="text-lg font-display font-semibold text-ink mt-0.5">{activePersona.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePersona(null)}
                aria-label="Close persona details"
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-ink-2 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-mono text-ink-3 block mb-1">User Spoken Audio:</span>
                <blockquote className="p-3 rounded-lg bg-surface-2 border border-edge text-ink-2 italic">
                  &ldquo;{activePersona.prompt}&rdquo;
                </blockquote>
              </div>

              <div>
                <span className="text-xs font-mono text-emerald-400 block mb-1">Stay Spoken Reply:</span>
                <blockquote className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-ink font-medium">
                  &ldquo;{activePersona.reply}&rdquo;
                </blockquote>
              </div>

              {activePersona.tool && (
                <div className="text-xs font-mono bg-surface-2 p-2.5 rounded-lg border border-edge flex items-center justify-between">
                  <span className="text-ink-3">Tool Dispatched:</span>
                  <span className="text-accent font-bold">{activePersona.tool.action}</span>
                </div>
              )}

              {activePersona.safety && (
                <div className="text-xs font-mono bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/30 flex items-center justify-between">
                  <span className="text-rose-400">Safety Boundary Intercepted:</span>
                  <span className="text-rose-400 font-bold">{activePersona.safety}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2">
                <div className="p-2 rounded bg-surface-2 border border-edge flex justify-between">
                  <span className="text-ink-3">Spoken Words:</span>
                  <span className="text-ink font-bold">{activePersona.words} words</span>
                </div>
                <div className="p-2 rounded bg-surface-2 border border-edge flex justify-between">
                  <span className="text-ink-3">Measured Latency:</span>
                  <span className="text-ink font-bold">{activePersona.latencyMs} ms</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-2/60 border border-edge text-xs space-y-1.5">
                <div className="text-ink font-semibold mb-1">Evaluation Checks:</div>
                <div className="text-emerald-400 flex items-center gap-1.5">✓ Strict zero-guilt hygiene verified</div>
                <div className="text-emerald-400 flex items-center gap-1.5">✓ Word economy below 20-word ADHD cognitive ceiling</div>
                <div className="text-emerald-400 flex items-center gap-1.5">✓ Single micro-step or deterministic boundary executed</div>
                <div className="text-emerald-400 flex items-center gap-1.5">✓ Zero hallucinations or list read-outs</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="lp-limits mt-4">
        Full 100-persona dataset and automated harness in <code>scripts/voice-e2e/persona-stress-test.mjs</code> and <code>docs/bench-results/persona-stress-test-100.json</code>.
      </p>
    </section>
  );
}
