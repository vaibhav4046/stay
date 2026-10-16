import { jsPDF } from 'jspdf';
import type {
  CareContext,
  ClinicianReportConfig,
  CoachSessionRecord,
  TreatmentCheckinRecord,
} from '@/types/domain';
import {
  computeAdherenceSummary,
  computeBarrierBreakdown,
  computeOverallMetrics,
  computeStrategyStats,
} from '@/lib/coach/patterns';

const CARE_CONTEXT_LABELS: Record<CareContext, string> = {
  waitlisted: 'Waiting for assessment or specialist care',
  medicated: 'Taking prescribed ADHD medication',
  in_therapy: 'In CBT, therapy, or structured coaching',
  self_managing: 'Self-managing without formal clinical care',
  prefer_not_to_say: 'Prefer not to specify care context',
};

export function generateClinicianReportPdf(params: {
  config: ClinicianReportConfig;
  careContext: CareContext;
  sessions: CoachSessionRecord[];
  checkins: TreatmentCheckinRecord[];
  isSampleData?: boolean;
}): jsPDF {
  const { config, careContext, sessions, checkins, isSampleData } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const cutoff = Date.now() - config.periodDays * 24 * 60 * 60 * 1000;
  const filteredSessions = sessions.filter(
    (s) => new Date(s.createdAt).getTime() >= cutoff
  );
  const filteredCheckins = checkins.filter(
    (c) => new Date(c.createdAt).getTime() >= cutoff
  );

  const metrics = computeOverallMetrics(filteredSessions);
  const strategies = computeStrategyStats(filteredSessions);
  const barriers = computeBarrierBreakdown(filteredSessions);
  const adherence = computeAdherenceSummary(filteredCheckins);

  let y = 16;
  const left = 16;
  const right = 194;
  const contentWidth = right - left;

  // Header bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(33, 36, 34);
  doc.text('STAY — Patient Self-Tracked Appointment Summary', left, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(98, 107, 102);
  const dateStr = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const patientLabel = config.patientDisplayName.trim()
    ? `Prepared by: ${config.patientDisplayName.trim()}  |  `
    : '';
  doc.text(
    `${patientLabel}Window: Last ${config.periodDays} days  |  Generated: ${dateStr}`,
    left,
    y
  );
  y += 5;

  if (isSampleData) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(154, 99, 24);
    doc.text(
      'SAMPLE DATA PREVIEW — Synthetic demonstration records, not a real patient or clinical record.',
      left,
      y
    );
    y += 5;
  }

  // Disclaimer banner
  doc.setDrawColor(213, 209, 200);
  doc.setFillColor(241, 239, 233);
  doc.rect(left, y, contentWidth, 11, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(33, 36, 34);
  doc.text(
    'Clinical Boundary Notice: This summary contains observational self-tracking logged by the user in Stay.',
    left + 3,
    y + 4.5
  );
  doc.text(
    'Stay is not a medical device, diagnostic screener, or prescribing guide. All counts include exact sample denominators.',
    left + 3,
    y + 8.8
  );
  y += 16;

  // 1. Care Context
  if (config.includeCareContext) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 106, 103);
    doc.text('1. Care Context', left, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(33, 36, 34);
    doc.text(`Reported status: ${CARE_CONTEXT_LABELS[careContext]}`, left, y);
    y += 8;
  }

  // 2. Task Initiation Summary
  if (config.includeInitiationMetrics) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 106, 103);
    doc.text('2. Task-Initiation Overview', left, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(33, 36, 34);
    const rateLabel =
      metrics.overallStartRatePercent !== null
        ? `${metrics.overallStartRatePercent}% (${metrics.overallDenominatorLabel})`
        : 'No completed sessions in selected window';
    doc.text(`Start rate: ${rateLabel}`, left, y);
    y += 4.8;
    doc.text(
      `Breakdown: ${metrics.startedCount} started, ${metrics.partlyStartedCount} partly started, ${metrics.notStartedCount} not started, ${metrics.pausedCount} paused`,
      left,
      y
    );
    y += 4.8;
    doc.text(
      `Total logged focus time: ${metrics.totalFocusedMinutes} minutes across ${metrics.totalCompletedSessions} sessions`,
      left,
      y
    );
    y += 8;
  }

  // 3. Strategy Breakdown
  if (config.includeStrategyTable) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 106, 103);
    doc.text('3. Behavioral Strategy Effectiveness (Observational Self-Log)', left, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(33, 36, 34);

    for (const st of strategies) {
      const rateStr =
        st.startRatePercent !== null
          ? `${st.startRatePercent}% (${st.denominatorLabel})`
          : st.denominatorLabel;
      const prelimTag = st.attempts > 0 && st.isPreliminary ? ' [Preliminary <3 tries]' : '';
      doc.text(`• ${st.label}: ${rateStr}${prelimTag}`, left + 2, y);
      y += 4.8;
    }
    y += 4;
  }

  // 4. Common Barriers
  if (config.includeBarriers) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 106, 103);
    doc.text('4. Primary Initiation Barriers Reported', left, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(33, 36, 34);

    if (barriers.length === 0) {
      doc.text('• No barriers logged in this period.', left + 2, y);
      y += 5;
    } else {
      for (const b of barriers.slice(0, 4)) {
        doc.text(
          `• ${b.label}: ${b.count} session${b.count === 1 ? '' : 's'} (${b.sharePercent}%)`,
          left + 2,
          y
        );
        y += 4.8;
      }
    }
    y += 4;
  }

  // 5. Treatment Adherence & Side Effects
  if (config.includeTreatmentAdherence) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 106, 103);
    doc.text('5. Self-Reported Treatment & Daily Check-Ins', left, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(33, 36, 34);

    if (adherence.totalCheckins === 0) {
      doc.text('• No treatment check-ins logged in this period.', left + 2, y);
      y += 5;
    } else {
      const takenStr =
        adherence.takenRatePercent !== null
          ? `${adherence.takenRatePercent}% (${adherence.denominatorLabel})`
          : adherence.denominatorLabel;
      doc.text(`• Adherence log: ${takenStr}`, left + 2, y);
      y += 4.8;
      doc.text(
        `• Mean self-rated focus: ${adherence.averageFocusRating ?? 'N/A'} / 5   |   Mean sleep quality: ${adherence.averageSleepQuality ?? 'N/A'} / 5`,
        left + 2,
        y
      );
      y += 4.8;

      if (config.includeSideEffectNotes) {
        if (adherence.sideEffectNotes.length === 0) {
          doc.text('• Side-effect notes logged: None reported in this window.', left + 2, y);
          y += 5;
        } else {
          doc.text(
            `• Patient-logged side-effect / observation notes (${adherence.sideEffectNotes.length}):`,
            left + 2,
            y
          );
          y += 4.8;
          for (const item of adherence.sideEffectNotes.slice(0, 4)) {
            const d = new Date(item.createdAt).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
            });
            const wrapped = doc.splitTextToSize(`  [${d}] ${item.note}`, contentWidth - 8);
            doc.text(wrapped, left + 4, y);
            y += wrapped.length * 4.3;
          }
        }
      }
    }
    y += 4;
  }

  // 6. Patient Questions for Clinician
  if (config.includeQuestionsForClinician && config.questionsForClinician.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 106, 103);
    doc.text('6. Patient Questions for This Appointment', left, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(33, 36, 34);
    const wrapped = doc.splitTextToSize(config.questionsForClinician.trim(), contentWidth - 4);
    doc.text(wrapped, left + 2, y);
    y += wrapped.length * 4.5 + 4;
  }

  // Footer
  doc.setDrawColor(233, 230, 223);
  doc.line(left, 280, right, 280);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(116, 122, 117);
  doc.text(
    'Generated locally by Stay. User-owned self-tracking summary for clinical discussion only — not diagnostic or medical advice.',
    left,
    285
  );

  return doc;
}
