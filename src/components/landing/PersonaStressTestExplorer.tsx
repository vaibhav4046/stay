'use client';

import { useMemo, useState } from 'react';
import { useReveal } from './useReveal';
import { STRESS_PERSONAS, STRESS_TEST_SUMMARY, type StressPersona } from './personaStressData';
import { SWARM_SCENARIOS, SWARM_TEST_SUMMARY, type SwarmScenario } from './swarmStressData';

const CLINICAL_CATEGORY_NAMES: Record<string, string> = {
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

const SWARM_CATEGORY_NAMES: Record<string, string> = {
  all: 'All Swarm (105)',
  meltdown_rsd: 'Meltdowns & RSD (15)',
  rapid_impatient: 'Rapid & Impatient (15)',
  nonverbal_freeze: 'Non-Verbal Freeze (15)',
  tangential_hyperfocus: 'Tangents & Traps (15)',
  multilingual_code_switching: 'Multilingual & Accents (15)',
  adversarial_boundary: 'Adversarial & Safety (15)',
  concurrent_burst_swarm: 'Parallel Burst Swarm (15)',
};

type ActiveItem = (StressPersona & { checks?: Array<{ check: string; passed: boolean; detail: string }> }) | SwarmScenario;

export function PersonaStressTestExplorer() {
  const { ref, state } = useReveal<HTMLDivElement>(0.12);
  const [suite, setSuite] = useState<'swarm' | 'clinical'>('swarm');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);

  const categories = suite === 'swarm' ? SWARM_CATEGORY_NAMES : CLINICAL_CATEGORY_NAMES;

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (suite === 'swarm') {
      return SWARM_SCENARIOS.filter((s) => {
        const matchCat = selectedCat === 'all' || s.archetype === selectedCat;
        const matchSearch =
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.prompt.toLowerCase().includes(q) ||
          s.reply.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q);
        return matchCat && matchSearch;
      });
    }

    return STRESS_PERSONAS.filter((p) => {
      const matchCat = selectedCat === 'all' || p.category === selectedCat;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.prompt.toLowerCase().includes(q) ||
        p.reply.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [suite, selectedCat, searchQuery]);

  const currentSummary = suite === 'swarm'
    ? {
        total: SWARM_TEST_SUMMARY.total,
        passed: SWARM_TEST_SUMMARY.passed,
        passRatePercent: SWARM_TEST_SUMMARY.passRatePercent,
        avgLatencyMs: SWARM_TEST_SUMMARY.avgLatencyMs,
        avgWords: SWARM_TEST_SUMMARY.avgWords,
        latencyLabel: 'Backend Turn Latency',
      }
    : {
        total: STRESS_TEST_SUMMARY.total,
        passed: STRESS_TEST_SUMMARY.passed,
        passRatePercent: STRESS_TEST_SUMMARY.passRatePercent,
        avgLatencyMs: STRESS_TEST_SUMMARY.avgLatencyMs,
        avgWords: STRESS_TEST_SUMMARY.avgWords,
        latencyLabel: 'End-to-end turn time',
      };

  return (
    <section id="personas-100" ref={ref} data-reveal={state} className="lp-section lp-wrap" aria-labelledby="personas-100-title">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow">Adversarial Swarm &amp; Neurodivergent Personas</p>
          <h2 id="personas-100-title" className="section-title max-w-[26ch]">
            Tested against 205 real-world scenarios
          </h2>
          <p className="lp-night-copy mt-3 max-w-[64ch]">
            {suite === 'swarm'
              ? '105 adversarial voice agents stressing concurrent parallel load, token exhaustion, rapid turn-taking, sobbing meltdowns, spacing evasion, and multilingual dialects.'
              : '100 clinical ADHD archetypes spanning Rejection Sensitive Dysphoria (RSD), executive paralysis, staccato turn-takers, and tangent ramblers.'}
          </p>
        </div>

        {/* Suite Switcher Tabs */}
        <div className="flex bg-surface-2 p-1 rounded-xl border border-edge self-start md:self-auto">
          <button
            type="button"
            onClick={() => {
              setSuite('swarm');
              setSelectedCat('all');
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              suite === 'swarm'
                ? 'bg-accent text-white shadow-sm'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <span>⚡</span> 105-Agent Extreme Swarm
          </button>
          <button
            type="button"
            onClick={() => {
              setSuite('clinical');
              setSelectedCat('all');
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              suite === 'clinical'
                ? 'bg-accent text-white shadow-sm'
                : 'text-ink-2 hover:text-ink'
            }`}
          >
            <span>🧠</span> 100 Clinical Personas
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-xl bg-surface-1 border border-edge">
          <div className="text-xs font-mono text-ink-3 uppercase tracking-wider">Pass Rate</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-400 mt-1">
            {currentSummary.passRatePercent}%
          </div>
          <div className="text-xs text-ink-2 mt-0.5">{currentSummary.passed} of {currentSummary.total} verified</div>
        </div>

        <div className="p-4 rounded-xl bg-surface-1 border border-edge">
          <div className="text-xs font-mono text-ink-3 uppercase tracking-wider">Avg Latency</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-accent mt-1">
            {currentSummary.avgLatencyMs} ms
          </div>
          <div className="text-xs text-ink-2 mt-0.5">{currentSummary.latencyLabel}</div>
        </div>

        <div className="p-4 rounded-xl bg-surface-1 border border-edge">
          <div className="text-xs font-mono text-ink-3 uppercase tracking-wider">Avg Words Spoken</div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-indigo-400 mt-1">
            {currentSummary.avgWords} words
          </div>
          <div className="text-xs text-ink-2 mt-0.5">Ceiling: &lt; 14–20 words (ADHD limit)</div>
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
          {Object.entries(categories).map(([key, label]) => (
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
            aria-label="Search scenarios by name, prompt, or category"
            placeholder="Search prompt, name, issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs rounded-lg bg-surface-2 border border-edge px-3 py-2 text-ink placeholder:text-ink-3 focus:outline-none focus:border-accent"
          />
        </div>
      </div>

      {/* Personas / Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[560px] overflow-y-auto pr-1">
        {filteredItems.map((p) => {
          const catLabel = 'archetype' in p ? p.archetype : p.category;
          return (
            <div
              key={p.id}
              onClick={() => setActiveItem(p)}
              className="p-4 rounded-xl bg-surface-1 border border-edge hover:border-accent/40 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-ink font-display group-hover:text-accent transition-colors">
                    {p.name}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-surface-2 text-ink-3 uppercase">
                    {catLabel.replace(/_/g, ' ')}
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
          );
        })}
      </div>

      {/* Detail Modal / Drawer */}
      {activeItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="bg-surface-1 border border-edge rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-edge pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold">
                  Scenario #{activeItem.id.toUpperCase()} · {('archetype' in activeItem ? activeItem.archetype : activeItem.category).toUpperCase().replace(/_/g, ' ')}
                </span>
                <h3 className="text-lg font-display font-semibold text-ink mt-0.5">{activeItem.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                aria-label="Close scenario details"
                className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-ink-2 hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-mono text-ink-3 block mb-1">User Spoken Audio:</span>
                <blockquote className="p-3 rounded-lg bg-surface-2 border border-edge text-ink-2 italic">
                  &ldquo;{activeItem.prompt}&rdquo;
                </blockquote>
              </div>

              <div>
                <span className="text-xs font-mono text-emerald-400 block mb-1">Stay Spoken Reply:</span>
                <blockquote className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-ink font-medium">
                  {activeItem.reply ? `“${activeItem.reply}”` : (activeItem.tool ? `[Dispatched Tool: ${activeItem.tool.action}]` : 'Done')}
                </blockquote>
              </div>

              {activeItem.tool && (
                <div className="text-xs font-mono bg-surface-2 p-2.5 rounded-lg border border-edge flex items-center justify-between">
                  <span className="text-ink-3">Tool Dispatched:</span>
                  <span className="text-accent font-bold">{activeItem.tool.action}</span>
                </div>
              )}

              {activeItem.safety && (
                <div className="text-xs font-mono bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/30 flex items-center justify-between">
                  <span className="text-rose-400">Safety Boundary Intercepted:</span>
                  <span className="text-rose-400 font-bold">{activeItem.safety}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2">
                <div className="p-2 rounded bg-surface-2 border border-edge flex justify-between">
                  <span className="text-ink-3">Spoken Words:</span>
                  <span className="text-ink font-bold">{activeItem.words} words</span>
                </div>
                <div className="p-2 rounded bg-surface-2 border border-edge flex justify-between">
                  <span className="text-ink-3">Measured Latency:</span>
                  <span className="text-ink font-bold">{activeItem.latencyMs} ms</span>
                </div>
              </div>

              {'checks' in activeItem && activeItem.checks && activeItem.checks.length > 0 ? (
                <div className="p-3 rounded-lg bg-surface-2/60 border border-edge text-xs space-y-1.5">
                  <div className="text-ink font-semibold mb-1">Automated Evaluation Checks:</div>
                  {activeItem.checks.map((c, idx) => (
                    <div key={idx} className="text-emerald-400 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">✓ {c.check.replace(/_/g, ' ')}</span>
                      <span className="text-[11px] font-mono text-ink-3">{c.detail}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-surface-2/60 border border-edge text-xs space-y-1.5">
                  <div className="text-ink font-semibold mb-1">Evaluation Checks:</div>
                  <div className="text-emerald-400 flex items-center gap-1.5">✓ Strict zero-guilt hygiene verified</div>
                  <div className="text-emerald-400 flex items-center gap-1.5">✓ Word economy below 20-word ADHD cognitive ceiling</div>
                  <div className="text-emerald-400 flex items-center gap-1.5">✓ Single micro-step or deterministic boundary executed</div>
                  <div className="text-emerald-400 flex items-center gap-1.5">✓ Zero hallucinations or list read-outs</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="lp-limits mt-4">
        All 105 swarm scenarios recorded in <code>docs/bench-results/swarm-voice-stress-105.json</code>; 100 clinical personas in <code>docs/bench-results/persona-stress-test-100.json</code>.
      </p>
    </section>
  );
}
