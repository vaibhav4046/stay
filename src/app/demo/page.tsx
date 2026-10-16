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
  if (!loaded) return null;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link href="/" aria-label="Stay home">
          <StayWordmark />
        </Link>
        <Link href="/app/today" className="btn btn-secondary">Use Stay for real</Link>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 sm:px-8">
        <div className="notice flex flex-wrap items-center gap-3" data-testid="demo-banner">
          <span className="sample-badge">Sample data</span>
          <span>
            Demo with a made-up week of history so you can see patterns and the report. Nothing here is saved or is a real
            person&apos;s record. Voice is live if you allow the microphone.
          </span>
        </div>

        <div className="mt-6 flex gap-1 border-b border-line" role="tablist" aria-label="Demo sections">
          {(
            [
              ['coach', 'Get started'],
              ['checkin', 'Check-in'],
              ['report', 'Clinician report'],
            ] as Array<[Tab, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              className="px-4 py-2.5 text-[0.95rem] -mb-px border-b-2"
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
