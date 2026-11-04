'use client';

import { useStayData } from '@/lib/storage/useStayData';
import { ReportBuilder } from '@/components/ReportBuilder';
import { appendAuditEvent } from '@/lib/storage/repository';
import { PageSkeleton } from '@/components/PageSkeleton';
import { PageHeading } from '@/components/PageHeading';

export default function ReportsPage() {
  const { profile, sessions, checkins, loaded } = useStayData('app');
  if (!loaded) return <PageSkeleton variant="reports" />;
  return (
    <div>
      <PageHeading className="mb-2">Report for your clinician</PageHeading>
      <p className="text-ink-2 mb-6 max-w-[65ch]">
        One page, useful in a short appointment. Preview it, choose what to share, then download.
      </p>
      <ReportBuilder
        careContext={profile.careContext}
        sessions={sessions}
        checkins={checkins}
        isDemo={false}
        onExported={() => void appendAuditEvent('report_exported', 'Exported clinician PDF summary')}
      />
    </div>
  );
}
