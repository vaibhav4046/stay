import { beforeEach, describe, it, expect } from 'vitest';
import { generateClinicianReportPdf } from '@/lib/pdf/clinicianReport';
import { recordTreatmentCheckin, getLocalCheckins } from '@/lib/storage/repository';
import type { CoachSessionRecord, TreatmentCheckinRecord } from '@/types/domain';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: new MemStorage() };
});

describe('Clinician Report PDF generation (§8.6)', () => {
  const sampleSessions: CoachSessionRecord[] = [
    {
      id: 's1',
      userId: 'local-user',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      mode: 'voice',
      careContext: 'medicated',
      taskText: 'File tax return forms',
      barrierType: 'overwhelm',
      strategyKey: 'task_shrinking',
      firstStep: 'Open folder on desktop',
      plannedMinutes: 5,
      actualSeconds: 300,
      outcome: 'started',
      helpfulRating: 4,
      crisisTriggered: false,
    },
    {
      id: 's2',
      userId: 'local-user',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      mode: 'text',
      careContext: 'medicated',
      taskText: 'Clean kitchen counter',
      barrierType: 'low_energy',
      strategyKey: 'implementation_intention',
      firstStep: 'Stand up and get spray bottle',
      plannedMinutes: 2,
      actualSeconds: 90,
      outcome: 'partly_started',
      helpfulRating: 3,
      crisisTriggered: false,
    },
  ];

  const sampleCheckins: TreatmentCheckinRecord[] = [
    {
      id: 'c1',
      userId: 'local-user',
      createdAt: new Date().toISOString(),
      takenStatus: 'taken',
      sideEffectsNoted: true,
      sideEffectNote: 'Slight dry mouth after midday',
      focusRating: 4,
      sleepQuality: 4,
    },
  ];

  it('generates a valid PDF document with metadata', () => {
    const doc = generateClinicianReportPdf({
      config: {
        periodDays: 14,
        includeCareContext: true,
        includeInitiationMetrics: true,
        includeStrategyTable: true,
        includeBarriers: true,
        includeTreatmentAdherence: true,
        includeSideEffectNotes: true,
        includeQuestionsForClinician: true,
        questionsForClinician: 'Is dry mouth common in the first two weeks?',
        patientDisplayName: 'Jane Doe',
      },
      careContext: 'medicated',
      sessions: sampleSessions,
      checkins: sampleCheckins,
      isSampleData: false,
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const output = doc.output('arraybuffer');
    expect(output.byteLength).toBeGreaterThan(1000);
  });

  it('handles empty session and checkin lists gracefully', () => {
    const doc = generateClinicianReportPdf({
      config: {
        periodDays: 14,
        includeCareContext: true,
        includeInitiationMetrics: true,
        includeStrategyTable: true,
        includeBarriers: true,
        includeTreatmentAdherence: true,
        includeSideEffectNotes: true,
        includeQuestionsForClinician: false,
        questionsForClinician: '',
        patientDisplayName: '',
      },
      careContext: 'waitlisted',
      sessions: [],
      checkins: [],
      isSampleData: true,
    });

    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

describe('Treatment Check-in date-based upsert (§8.5)', () => {
  it('upserts on today date without creating duplicate entries', async () => {
    // Clean mock storage
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }

    const first = await recordTreatmentCheckin({
      takenStatus: 'taken',
      focusRating: 3,
      sleepQuality: 3,
      sideEffectsNoted: false,
      sideEffectNote: null,
    });

    const checkinsAfterFirst = getLocalCheckins();
    expect(checkinsAfterFirst.length).toBe(1);
    expect(checkinsAfterFirst[0].takenStatus).toBe('taken');

    // Submit again on the same day with updated notes
    const second = await recordTreatmentCheckin({
      takenStatus: 'taken',
      focusRating: 4,
      sleepQuality: 4,
      sideEffectsNoted: true,
      sideEffectNote: 'Mild headache',
    });

    const checkinsAfterSecond = getLocalCheckins();
    expect(checkinsAfterSecond.length).toBe(1);
    expect(checkinsAfterSecond[0].id).toBe(first.id);
    expect(checkinsAfterSecond[0].focusRating).toBe(4);
    expect(checkinsAfterSecond[0].sideEffectNote).toBe('Mild headache');
    expect(second.id).toBe(first.id);
  });
});
