'use client';

import { useMemo, useState } from 'react';
import type { CareContext, ClinicianReportConfig, CoachSessionRecord, TreatmentCheckinRecord } from '@/types/domain';
import {
  computeAdherenceSummary,
  computeBarrierBreakdown,
  computeOverallMetrics,
  computeStrategyStats,
} from '@/lib/coach/patterns';

const TOGGLES: Array<{ key: keyof ClinicianReportConfig; label: string }> = [
  { key: 'includeCareContext', label: 'Care context' },
  { key: 'includeInitiationMetrics', label: 'Start rate and focus time' },
  { key: 'includeStrategyTable', label: 'Strategies that helped' },
  { key: 'includeBarriers', label: 'Common barriers' },
  { key: 'includeTreatmentAdherence', label: 'Treatment check-ins' },
  { key: 'includeSideEffectNotes', label: 'My notes on side effects' },
  { key: 'includeQuestionsForClinician', label: 'My questions' },
];

const CARE_LABEL: Record<CareContext, string> = {
  waitlisted: 'Waiting for assessment or care',
  medicated: 'Taking prescribed ADHD medication',
  in_therapy: 'In therapy or coaching',
  self_managing: 'Self-managing',
  prefer_not_to_say: 'Not specified',
};

export function ReportBuilder({
  careContext,
  sessions,
  checkins,
  isDemo,
  onExported,
}: {
  careContext: CareContext;
  sessions: CoachSessionRecord[];
  checkins: TreatmentCheckinRecord[];
  isDemo: boolean;
  onExported?: () => void;
}) {
  const [config, setConfig] = useState<ClinicianReportConfig>({
    periodDays: 14,
    includeCareContext: true,
    includeInitiationMetrics: true,
    includeStrategyTable: true,
    includeBarriers: true,
    includeTreatmentAdherence: true,
    includeSideEffectNotes: true,
    includeQuestionsForClinician: true,
    questionsForClinician: '',
    patientDisplayName: '',
  });
  const [exporting, setExporting] = useState(false);

  const cutoff = Date.now() - config.periodDays * 86400000;
  const s = useMemo(() => sessions.filter((x) => new Date(x.createdAt).getTime() >= cutoff), [sessions, cutoff]);
  const c = useMemo(() => checkins.filter((x) => new Date(x.createdAt).getTime() >= cutoff), [checkins, cutoff]);
  const overall = computeOverallMetrics(s);
  const strategies = computeStrategyStats(s);
  const barriers = computeBarrierBreakdown(s);
  const adherence = computeAdherenceSummary(c);

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { generateClinicianReportPdf } = await import('@/lib/pdf/clinicianReport');
      const doc = generateClinicianReportPdf({ config, careContext, sessions, checkins, isSampleData: isDemo });
      doc.save(`stay-summary-${new Date().toISOString().slice(0, 10)}${isDemo ? '-sample' : ''}.pdf`);
      onExported?.();
    } finally {
      setExporting(false);
    }
  };

  const set = <K extends keyof ClinicianReportConfig>(k: K, v: ClinicianReportConfig[K]) => setConfig((p) => ({ ...p, [k]: v }));

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <section className="card p-5 sm:p-6 h-fit" aria-labelledby="report-options">
        <h2 id="report-options" className="card-title">What to include</h2>
        <p className="meta mt-1">Nothing leaves this device until you export. You choose every section.</p>

        <fieldset className="mt-5">
          <legend className="label">Period</legend>
          <div className="mt-2 flex gap-2">
            {([7, 14, 30] as const).map((d) => (
              <button key={d} type="button" className="chip tnum" aria-pressed={config.periodDays === d} onClick={() => set('periodDays', d)}>
                {d} days
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5 space-y-2.5">
          <legend className="label mb-1">Sections</legend>
          {TOGGLES.map((t) => (
            <label key={t.key} className="flex items-center gap-3 cursor-pointer text-[0.95rem]">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#006A67]"
                checked={Boolean(config[t.key])}
                onChange={(e) => set(t.key, e.target.checked as never)}
              />
              {t.label}
            </label>
          ))}
        </fieldset>

        <label htmlFor="pname" className="label mt-5 block">Name on report (optional)</label>
        <input id="pname" className="field mt-2" value={config.patientDisplayName} onChange={(e) => set('patientDisplayName', e.target.value)} maxLength={60} />

        <label htmlFor="questions" className="label mt-4 block">Questions for my appointment</label>
        <textarea
          id="questions"
          className="field mt-2 min-h-[80px]"
          maxLength={500}
          value={config.questionsForClinician}
          onChange={(e) => set('questionsForClinician', e.target.value)}
          placeholder="e.g. My focus drops after 3pm. Is that worth discussing?"
        />

        <button type="button" className="btn btn-primary w-full mt-5" onClick={exportPdf} disabled={exporting} data-testid="export-pdf">
          {exporting ? 'Preparing PDF' : 'Download one-page PDF'}
        </button>
      </section>

      <section className="card p-6 sm:p-8" aria-label="Report preview" data-testid="report-preview">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="meta">Preview</p>
          {isDemo && <span className="sample-badge">Sample data, not a real patient</span>}
        </div>
        <h3 className="section-title mt-2">Appointment summary</h3>
        <p className="meta mt-1">
          {config.patientDisplayName ? `${config.patientDisplayName} · ` : ''}Last {config.periodDays} days · Self-tracked in Stay
        </p>
        <p className="notice mt-4">
          Observational self-tracking. Not a clinical assessment, diagnosis, or medical device record.
        </p>

        <div className="mt-6 space-y-6 text-[0.95rem]">
          {config.includeCareContext && (
            <div>
              <h4 className="font-medium">Care context</h4>
              <p className="text-ink-2 mt-1">{CARE_LABEL[careContext]}</p>
            </div>
          )}
          {config.includeInitiationMetrics && (
            <div>
              <h4 className="font-medium">Starting tasks</h4>
              <p className="text-ink-2 mt-1 tnum">
                {overall.overallStartRatePercent !== null
                  ? `${overall.overallStartRatePercent}% start rate (${overall.overallDenominatorLabel}). ${overall.totalFocusedMinutes} focus minutes logged.`
                  : 'No completed sessions in this period.'}
              </p>
            </div>
          )}
          {config.includeStrategyTable && (
            <div>
              <h4 className="font-medium">Strategies</h4>
              <ul className="mt-1 text-ink-2 space-y-0.5 tnum">
                {strategies.map((x) => (
                  <li key={x.strategyKey}>
                    {x.label}: {x.startRatePercent !== null ? `${x.startRatePercent}% · ` : ''}{x.denominatorLabel}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {config.includeBarriers && (
            <div>
              <h4 className="font-medium">Common barriers</h4>
              <p className="text-ink-2 mt-1">
                {barriers.length ? barriers.slice(0, 4).map((b) => `${b.label} (${b.count})`).join(' · ') : 'None logged.'}
              </p>
            </div>
          )}
          {config.includeTreatmentAdherence && (
            <div>
              <h4 className="font-medium">Treatment check-ins</h4>
              <p className="text-ink-2 mt-1 tnum">
                {adherence.totalCheckins === 0
                  ? 'No check-ins in this period.'
                  : `${adherence.takenRatePercent !== null ? `${adherence.takenRatePercent}% · ` : ''}${adherence.denominatorLabel}. Focus ${adherence.averageFocusRating ?? '–'}/5, sleep ${adherence.averageSleepQuality ?? '–'}/5.`}
              </p>
              {config.includeSideEffectNotes && adherence.sideEffectNotes.length > 0 && (
                <ul className="mt-2 text-ink-2 space-y-1">
                  {adherence.sideEffectNotes.slice(0, 4).map((n) => (
                    <li key={n.createdAt}>
                      <span className="meta tnum">{new Date(n.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span> {n.note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {config.includeQuestionsForClinician && config.questionsForClinician.trim() && (
            <div>
              <h4 className="font-medium">My questions</h4>
              <p className="text-ink-2 mt-1 whitespace-pre-wrap">{config.questionsForClinician}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
