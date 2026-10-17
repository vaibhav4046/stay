'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StayWordmark } from '@/components/StayMark';
import { useStayData } from '@/lib/storage/useStayData';
import { CoachWorkspace } from '@/components/CoachWorkspace';
import { StrategyPatternSummary } from '@/components/StrategyPatternSummary';
import { TreatmentCheckinForm } from '@/components/TreatmentCheckinForm';
import { ReportBuilder } from '@/components/ReportBuilder';

type Tab = 'coach' | 'checkin' | 'report';

export default function DemoPage() {
  const { profile, sessions, checkins, loaded, updateProfile, addSession, addCheckin } = useStayData('demo');
  const [tab, setTab] = useState<Tab>('coach');
  const [guidedTourNotice, setGuidedTourNotice] = useState<string | null>(null);

  if (!loaded) return null;

  const handleResetDemo = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('stay_demo_sessions');
      window.localStorage.removeItem('stay_demo_checkins');
      window.localStorage.removeItem('stay_demo_profile');
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <Link href="/" aria-label="Stay home">
          <StayWordmark />
        </Link>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link href="/demo/orb-diagnostic" className="btn btn-ghost text-[0.82rem] sm:text-[0.88rem] text-accent font-medium">
            Signal Orb Diagnostic
          </Link>
          <button
            type="button"
            onClick={handleResetDemo}
            className="btn btn-ghost text-[0.82rem] sm:text-[0.88rem] text-ink-2"
            title="Reset demo session to initial synthetic state"
          >
            ↻ Reset demo
          </button>
          <Link href="/app/today" className="btn btn-secondary text-[0.85rem]">
            Use Stay for real
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-8">
        {/* Persistent synthetic banner */}
        <div className="notice flex flex-wrap items-center justify-between gap-3" data-testid="demo-banner">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="sample-badge">Sample data · Demo mode</span>
            <span className="text-[0.88rem] sm:text-[0.92rem]">
              Preloaded with 7 days of synthetic sessions. Real user records in <code className="font-mono text-xs">/app</code> are completely separate.
            </span>
          </div>
          <span className="text-xs text-ink-3 font-mono">Isolated storage</span>
        </div>

        {/* Section Tabs */}
        <div className="mt-6 flex flex-wrap gap-1 border-b border-line" role="tablist" aria-label="Demo sections">
          {(
            [
              ['coach', 'Task Coach & Focus Timer'],
              ['checkin', 'Daily Treatment Check-in'],
              ['report', 'Clinician Appointment Report'],
            ] as Array<[Tab, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className="px-3 py-2 sm:px-4 sm:py-2.5 text-[0.85rem] sm:text-[0.95rem] -mb-px border-b-2 transition-colors"
              style={{
                borderColor: tab === k ? '#006A67' : 'transparent',
                color: tab === k ? '#212422' : '#626B66',
                fontWeight: tab === k ? 600 : 500,
              }}
              onClick={() => setTab(k)}
              data-testid={`demo-tab-${k}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === 'coach' && (
            <div className="space-y-6">
              <CoachWorkspace
                careContext={profile.careContext}
                sessions={sessions}
                proactiveCheckins={profile.proactiveCheckins}
                quietMode={profile.interactionMode === 'quiet_text_only'}
                onQuietModeChange={(q) => updateProfile({ interactionMode: q ? 'quiet_text_only' : 'voice_and_text' })}
                onLogSession={addSession}
                isDemo
              />
              <StrategyPatternSummary sessions={sessions} />
            </div>
          )}
          {tab === 'checkin' && (
            <div className="max-w-2xl">
              <TreatmentCheckinForm onSubmit={addCheckin} />
            </div>
          )}
          {tab === 'report' && (
            <ReportBuilder careContext={profile.careContext} sessions={sessions} checkins={checkins} isDemo />
          )}
        </div>
      </main>
    </div>
  );
}
