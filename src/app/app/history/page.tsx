'use client';

import { useStayData } from '@/lib/storage/useStayData';
import { BARRIER_DEFINITIONS, STRATEGY_DEFINITIONS } from '@/lib/coach/strategies';
import { StrategyPatternSummary } from '@/components/StrategyPatternSummary';
import { weekTally, weekTallyLine } from '@/lib/coach/weekTally';

const OUTCOME_LABEL: Record<string, { text: string; color: string }> = {
  started: { text: 'Started', color: '#236B48' },
  partly_started: { text: 'Partly started', color: '#006A67' },
  not_started: { text: 'Not started', color: '#747A75' },
  paused_or_stopped: { text: 'Paused', color: '#9A6318' },
};

export default function HistoryPage() {
  const { sessions, checkins, loaded } = useStayData('app');
  if (!loaded) return null;
  const week = weekTally(sessions);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="card p-5 sm:p-6" aria-labelledby="hist-title">
        <h1 id="hist-title" className="section-title">History</h1>
        <p className="mt-2 text-ink-2" data-testid="week-tally">{weekTallyLine(week)}</p>
        {sessions.length === 0 ? (
          <p className="text-ink-2 mt-3">Nothing here yet. Start one small thing and it will show up here, even if it goes badly. That is still data.</p>
        ) : (
          <ul className="mt-5 divide-y divide-line" data-testid="history-list">
            {sessions.map((s) => {
              const o = s.outcome ? OUTCOME_LABEL[s.outcome] : null;
              return (
                <li key={s.id} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{s.taskText}</p>
                    {o && (
                      <span className="meta" style={{ color: o.color }}>
                        {o.text}
                      </span>
                    )}
                  </div>
                  <p className="text-ink-2 text-[0.92rem] mt-1">{s.firstStep}</p>
                  <p className="meta mt-1.5 tnum">
                    {new Date(s.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {BARRIER_DEFINITIONS[s.barrierType].label}
                    {' · '}
                    {STRATEGY_DEFINITIONS[s.strategyKey].label}
                    {' · '}
                    {s.plannedMinutes} min · {s.mode}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="space-y-6">
        <StrategyPatternSummary sessions={sessions} />
        <section className="card p-5 sm:p-6">
          <h2 className="card-title">Check-ins</h2>
          <p className="meta mt-1 tnum">{checkins.length} logged</p>
          <ul className="mt-3 space-y-2 text-[0.92rem]">
            {checkins.slice(0, 7).map((c) => (
              <li key={c.id} className="flex justify-between gap-3">
                <span className="tnum text-ink-2">
                  {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
                <span>{c.takenStatus.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
