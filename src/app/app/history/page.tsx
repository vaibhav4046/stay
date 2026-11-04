'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useStayData } from '@/lib/storage/useStayData';
import { BARRIER_DEFINITIONS, STRATEGY_DEFINITIONS } from '@/lib/coach/strategies';
import { StrategyPatternSummary } from '@/components/StrategyPatternSummary';
import { weekTally, weekTallyLine } from '@/lib/coach/weekTally';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PageHeading } from '@/components/PageHeading';
import type { CoachSessionRecord } from '@/types/domain';

const OUTCOME_LABEL: Record<string, { text: string; color: string }> = {
  started: { text: 'Started', color: 'var(--color-success)' },
  partly_started: { text: 'Partly started', color: 'var(--color-accent)' },
  not_started: { text: 'Not started', color: 'var(--color-muted)' },
  paused_or_stopped: { text: 'Paused', color: 'var(--color-caution)' },
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
            <p className="text-xs text-ink-2 mt-0.5">Answer two quick questions on Today so Stay can fit how it helps you.</p>
          </div>
          <Link href="/app/today" className="btn btn-primary text-xs py-2 px-3">
            Start setup
          </Link>
        </div>
      )}

      <PageHeading className="mb-5">History</PageHeading>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] relative">
      <section className="card p-5 sm:p-6" aria-label="Your sessions">
        <p className="text-ink-2" data-testid="week-tally">{weekTallyLine(week)}</p>
        {sessions.length === 0 ? (
          <p className="text-ink-2 mt-3">Nothing here yet. Start one small thing and it will show up here, even if it goes badly. That is still data.</p>
        ) : (
          <ul className="mt-5 divide-y divide-line" data-testid="history-list">
            {sessions.map((s) => {
              const o = s.outcome ? OUTCOME_LABEL[s.outcome] : null;
              return (
                <li key={s.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                        className="min-h-11 cursor-pointer rounded-lg border border-transparent px-3 text-sm text-ink-2 hover:border-danger/40 hover:text-danger"
                        aria-label={`Delete log "${s.taskText}"`}
                        data-testid={`history-delete-${s.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-ink-2 text-[0.92rem] mt-1">{s.firstStep}</p>
                  <p className="meta mt-1.5 tnum flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>{new Date(s.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{BARRIER_DEFINITIONS[s.barrierType].label}</span>
                    <span>{STRATEGY_DEFINITIONS[s.strategyKey].label}</span>
                    <span>{s.plannedMinutes} min, {s.mode === 'voice' ? 'by voice' : 'typed'}</span>
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
            className="ml-2 min-h-11 cursor-pointer px-2 text-xs font-semibold text-primary hover:underline"
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
