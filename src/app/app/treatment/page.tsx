'use client';

import Link from 'next/link';
import { useStayData } from '@/lib/storage/useStayData';
import { TreatmentCheckinForm } from '@/components/TreatmentCheckinForm';
import { computeAdherenceSummary } from '@/lib/coach/patterns';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PageHeading } from '@/components/PageHeading';

export default function TreatmentPage() {
  const { profile, checkins, loaded, addCheckin } = useStayData('app');
  if (!loaded) return <PageSkeleton variant="treatment" />;
  const summary = computeAdherenceSummary(checkins.filter((c) => Date.now() - new Date(c.createdAt).getTime() < 14 * 86400000));
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCheckin = checkins.find((c) => c.createdAt.slice(0, 10) === todayKey);

  return (
    <div>
      {!profile.onboardingCompleted && (
        <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3" data-testid="onboarding-guide-banner">
          <div>
            <p className="font-semibold text-sm text-ink">Welcome to Stay</p>
            <p className="text-xs text-ink-2 mt-0.5">Answer two quick questions on Today so Stay can fit its check-ins to you.</p>
          </div>
          <Link href="/app/today" className="btn btn-primary text-xs py-2 px-3">
            Start setup
          </Link>
        </div>
      )}

      <PageHeading className="mb-5">Check-in</PageHeading>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <TreatmentCheckinForm
            onSubmit={addCheckin}
            showTreatment={profile.careContext === 'medicated'}
            initialCheckin={todayCheckin}
          />
        </div>
        <section className="card p-5 sm:p-6 h-fit" aria-labelledby="adh-title">
          <h2 id="adh-title" className="card-title">Last 14 days</h2>
          {summary.totalCheckins === 0 ? (
            <p className="text-ink-2 mt-2">No check-ins yet.</p>
          ) : (
            <dl className="mt-3 space-y-3 text-[0.95rem]">
              <div>
                <dt className="meta">Treatment logged as taken</dt>
                <dd className="tnum">{summary.takenRatePercent !== null ? `${summary.takenRatePercent}%` : '–'} <span className="meta">({summary.denominatorLabel})</span></dd>
              </div>
              <div>
                <dt className="meta">Average focus</dt>
                <dd className="tnum">{summary.averageFocusRating ?? '–'} / 5</dd>
              </div>
              <div>
                <dt className="meta">Average sleep</dt>
                <dd className="tnum">{summary.averageSleepQuality ?? '–'} / 5</dd>
              </div>
              <div>
                <dt className="meta">Days with something to mention</dt>
                <dd className="tnum">{summary.sideEffectsCount}</dd>
              </div>
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
