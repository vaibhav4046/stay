'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useStayData } from '@/lib/storage/useStayData';
import { BARRIER_DEFINITIONS, STRATEGY_DEFINITIONS } from '@/lib/coach/strategies';
import { StrategyPatternSummary } from '@/components/StrategyPatternSummary';
import { weekTally, weekTallyLine } from '@/lib/coach/weekTally';
import { PageSkeleton } from '@/components/PageSkeleton';
import type { CoachSessionRecord } from '@/types/domain';

const OUTCOME_LABEL: Record<string, { text: string; color: string }> = {
  started: { text: 'Started', color: '#5BD6A0' },
  partly_started: { text: 'Partly started', color: '#8FD3FF' },
  not_started: { text: 'Not started', color: '#747A75' },
  paused_or_stopped: { text: 'Paused', color: '#F0B35A' },
};

export default function HistoryPage() {
  const { profile, sessions, checkins, loaded, removeSession, restoreSession } = useStayData('app');
  const [deletedSession, setDeletedSession] = useState<CoachSessionRecord | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  if (!loaded) return <PageSkeleton variant="history" />;
  const week = weekTally(sessions);

  const handleDelete = (s: CoachSessionRecord) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setDeletedSession(s);
    void removeSession(s.id);
    undoTimerRef.current = setTimeout(() => {
      setDeletedSession(null);
    }, 4000);
  };

  const handleUndo = () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (deletedSession) {
      void restoreSession(deletedSession);
      setDeletedSession(null);
    }
  };

  return (
    <div>
      {!profile.onboardingCompleted && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3" data-testid="onboarding-guide-banner">
          <div>
            <p className="font-semibold text-sm text-ink">Welcome to Stay</p>
            <p className="text-xs text-ink-2 mt-0.5">Complete the quick 2-question setup on Today to personalize your focus coaching.</p>
          </div>
          <Link href="/app/today" className="btn btn-primary text-xs py-2 px-3">
            Start setup
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] relative">
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
                <li key={s.id} className="group py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{s.taskText}</p>
                    <div className="flex items-center gap-2">
                      {o && (
                        <span className="meta font-medium" style={{ color: o.color }}>
                          {o.text}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs text-ink-3 hover:text-red-500 cursor-pointer px-1.5 py-0.5 rounded border border-transparent hover:border-edge"
                        aria-label={`Delete log "${s.taskText}"`}
                        data-testid={`history-delete-${s.id}`}
                      >
                        Delete
                      </button>
                    </div>
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

      {deletedSession && (
        <aside
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-edge bg-surface/95 backdrop-blur-md px-4 py-3 shadow-xl"
          role="status"
          data-testid="history-undo-toast"
        >
          <span className="text-xs sm:text-sm text-ink truncate max-w-[200px] sm:max-w-xs">
            Deleted &quot;{deletedSession.taskText}&quot;
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer ml-2"
            data-testid="history-undo-button"
          >
            Undo (4s)
          </button>
        </aside>
      )}
    </div>
    </div>
  );
}
