import type { CoachSessionRecord } from '@/types/domain';
import { computeOverallMetrics, computeStrategyStats } from '@/lib/coach/patterns';

export function StrategyPatternSummary({ sessions }: { sessions: CoachSessionRecord[] }) {
  const overall = computeOverallMetrics(sessions);
  const stats = computeStrategyStats(sessions);
  const ranked = stats.filter((s) => s.attempts >= 3).sort((a, b) => (b.startRatePercent ?? 0) - (a.startRatePercent ?? 0));
  const best = ranked[0];

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="patterns-title" data-testid="strategy-patterns">
      <h2 id="patterns-title" className="card-title">What helps you start</h2>

      {overall.totalCompletedSessions === 0 ? (
        <p className="mt-3 text-ink-2">Log a few sessions and your own patterns appear here, with exact counts.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display tnum text-[2.25rem] font-semibold leading-none">
              {overall.overallStartRatePercent}%
            </span>
            <span className="meta">{overall.overallDenominatorLabel}</span>
          </div>
          {overall.isPreliminary && (
            <p className="meta mt-2" style={{ color: '#9A6318' }}>
              Early days: fewer than 5 sessions, so treat this as a hint.
            </p>
          )}
          {best && (
            <p className="mt-3 text-[0.95rem]">
              <span className="font-medium">{best.label}</span> has worked best so far ({best.denominatorLabel}). Stay will
              suggest it more often.
            </p>
          )}

          <ul className="mt-5 space-y-4">
            {stats.map((s) => (
              <li key={s.strategyKey}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[0.95rem]">{s.label}</span>
                  <span className="meta tnum shrink-0">{s.denominatorLabel}</span>
                </div>
                <div className="bar-track mt-1.5">
                  <div className="bar-fill" style={{ width: `${s.startRatePercent ?? 0}%`, opacity: s.isPreliminary ? 0.45 : 1 }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="meta mt-4">
            Personal self-tracking, not a clinical measure. Faded bars have fewer than 3 tries.
          </p>
        </>
      )}
    </section>
  );
}
