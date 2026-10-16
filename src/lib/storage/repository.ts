import type {
  AuditEventRecord,
  CoachSessionRecord,
  TreatmentCheckinRecord,
  UserProfile,
} from '@/types/domain';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const STORAGE_KEYS = {
  profile: 'stay_v1_profile',
  sessions: 'stay_v1_coach_sessions',
  checkins: 'stay_v1_treatment_checkins',
  audits: 'stay_v1_audit_events',
} as const;

export const DEFAULT_USER_PROFILE: UserProfile = {
  userId: 'local-user',
  careContext: 'waitlisted',
  interactionMode: 'voice_and_text',
  proactiveCheckins: true,
  onboardingCompleted: false,
  updatedAt: new Date().toISOString(),
};

/**
 * Isolated synthetic dataset for /demo only.
 * Explicitly marked with isSample: true so it is never mixed with real user records.
 */
export const SAMPLE_DEMO_SESSIONS: CoachSessionRecord[] = [
  {
    id: 'demo-sess-1',
    userId: 'sample-demo-user',
    createdAt: '2026-10-15T09:20:00.000Z',
    completedAt: '2026-10-15T09:30:00.000Z',
    mode: 'voice',
    careContext: 'waitlisted',
    taskText: 'Reply to landlord email about lease renewal date',
    barrierType: 'perfectionism_or_fear',
    strategyKey: 'task_shrinking',
    firstStep: 'Open the email thread and write one rough sentence in the draft box without sending it.',
    plannedMinutes: 10,
    actualSeconds: 600,
    outcome: 'started',
    helpfulRating: 5,
    crisisTriggered: false,
    isSample: true,
  },
  {
    id: 'demo-sess-2',
    userId: 'sample-demo-user',
    createdAt: '2026-10-14T14:10:00.000Z',
    completedAt: '2026-10-14T14:15:00.000Z',
    mode: 'voice',
    careContext: 'waitlisted',
    taskText: 'Upload three October receipts to expense portal',
    barrierType: 'boredom_or_distraction',
    strategyKey: 'timeboxing',
    firstStep: 'Work on the receipts folder for one bounded 5-minute sprint with permission to stop at the bell.',
    plannedMinutes: 5,
    actualSeconds: 300,
    outcome: 'started',
    helpfulRating: 4,
    crisisTriggered: false,
    isSample: true,
  },
  {
    id: 'demo-sess-3',
    userId: 'sample-demo-user',
    createdAt: '2026-10-13T11:00:00.000Z',
    completedAt: '2026-10-13T11:10:00.000Z',
    mode: 'text',
    careContext: 'waitlisted',
    taskText: 'Outline Q4 project handover notes for team meeting',
    barrierType: 'overwhelm',
    strategyKey: 'task_shrinking',
    firstStep: 'Open a blank note, write the title at the top, and list three bullet fragments.',
    plannedMinutes: 10,
    actualSeconds: 600,
    outcome: 'started',
    helpfulRating: 5,
    crisisTriggered: false,
    isSample: true,
  },
  {
    id: 'demo-sess-4',
    userId: 'sample-demo-user',
    createdAt: '2026-10-12T16:40:00.000Z',
    completedAt: '2026-10-12T16:50:00.000Z',
    mode: 'voice',
    careContext: 'waitlisted',
    taskText: 'Sort kitchen counter mail pile',
    barrierType: 'low_energy',
    strategyKey: 'task_shrinking',
    firstStep: 'Pick up five envelopes from the counter and place them in one stack.',
    plannedMinutes: 5,
    actualSeconds: 300,
    outcome: 'partly_started',
    helpfulRating: 4,
    crisisTriggered: false,
    isSample: true,
  },
  {
    id: 'demo-sess-5',
    userId: 'sample-demo-user',
    createdAt: '2026-10-11T10:15:00.000Z',
    completedAt: '2026-10-11T10:25:00.000Z',
    mode: 'voice',
    careContext: 'waitlisted',
    taskText: 'Fill out NHS pre-assessment questionnaire section B',
    barrierType: 'unclear_next_step',
    strategyKey: 'implementation_intention',
    firstStep: 'When the timer starts, I will open the PDF form and answer question B1 in rough notes.',
    plannedMinutes: 10,
    actualSeconds: 600,
    outcome: 'started',
    helpfulRating: 5,
    crisisTriggered: false,
    isSample: true,
  },
  {
    id: 'demo-sess-6',
    userId: 'sample-demo-user',
    createdAt: '2026-10-10T17:05:00.000Z',
    completedAt: '2026-10-10T17:15:00.000Z',
    mode: 'text',
    careContext: 'waitlisted',
    taskText: 'Rewrite portfolio bio paragraph',
    barrierType: 'perfectionism_or_fear',
    strategyKey: 'reframing',
    firstStep: 'Write a deliberately messy 2-sentence version 0 draft that nobody sees yet.',
    plannedMinutes: 10,
    actualSeconds: 240,
    outcome: 'not_started',
    helpfulRating: 2,
    crisisTriggered: false,
    isSample: true,
  },
];

export const SAMPLE_DEMO_CHECKINS: TreatmentCheckinRecord[] = [
  {
    id: 'demo-chk-1',
    userId: 'sample-demo-user',
    createdAt: '2026-10-15T08:30:00.000Z',
    takenStatus: 'taken',
    sideEffectsNoted: true,
    sideEffectNote: 'Mild dry mouth around midday; appetite returned by 6pm.',
    focusRating: 4,
    sleepQuality: 4,
    isSample: true,
  },
  {
    id: 'demo-chk-2',
    userId: 'sample-demo-user',
    createdAt: '2026-10-14T08:45:00.000Z',
    takenStatus: 'taken',
    sideEffectsNoted: false,
    sideEffectNote: null,
    focusRating: 4,
    sleepQuality: 3,
    isSample: true,
  },
  {
    id: 'demo-chk-3',
    userId: 'sample-demo-user',
    createdAt: '2026-10-13T09:10:00.000Z',
    takenStatus: 'skipped',
    sideEffectsNoted: false,
    sideEffectNote: 'Woke up late before morning meeting and missed usual routine window.',
    focusRating: 2,
    sleepQuality: 3,
    isSample: true,
  },
  {
    id: 'demo-chk-4',
    userId: 'sample-demo-user',
    createdAt: '2026-10-12T08:35:00.000Z',
    takenStatus: 'taken',
    sideEffectsNoted: true,
    sideEffectNote: 'Slight difficulty falling asleep after taking dose at 10:30am.',
    focusRating: 4,
    sleepQuality: 2,
    isSample: true,
  },
];

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function getLocalProfile(): UserProfile {
  return safeReadJson<UserProfile>(STORAGE_KEYS.profile, DEFAULT_USER_PROFILE);
}

export async function saveProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
  const current = getLocalProfile();
  const next: UserProfile = {
    ...current,
    ...profile,
    updatedAt: new Date().toISOString(),
  };
  safeWriteJson(STORAGE_KEYS.profile, next);

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('profiles').upsert({
          user_id: userData.user.id,
          care_context: next.careContext,
          interaction_mode: next.interactionMode,
          proactive_checkins: next.proactiveCheckins,
          onboarding_completed: next.onboardingCompleted,
          updated_at: next.updatedAt,
        });
      }
    } catch {
      // Local storage remains authoritative fallback
    }
  }

  return next;
}

export function getLocalSessions(): CoachSessionRecord[] {
  return safeReadJson<CoachSessionRecord[]>(STORAGE_KEYS.sessions, []);
}

export async function recordCoachSession(
  input: Omit<CoachSessionRecord, 'id' | 'userId' | 'createdAt'>
): Promise<CoachSessionRecord> {
  const record: CoachSessionRecord = {
    ...input,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sess-${Date.now()}`,
    userId: 'local-user',
    createdAt: new Date().toISOString(),
  };

  const current = getLocalSessions();
  const updated = [record, ...current];
  safeWriteJson(STORAGE_KEYS.sessions, updated);

  await appendAuditEvent(
    'coach_session_logged',
    `Logged "${record.taskText.slice(0, 60)}" (${record.strategyKey} -> ${record.outcome || 'in_progress'})`
  );

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('coach_sessions').insert({
          id: record.id,
          user_id: userData.user.id,
          created_at: record.createdAt,
          completed_at: record.completedAt,
          mode: record.mode,
          care_context: record.careContext,
          task_text: record.taskText,
          barrier_type: record.barrierType,
          strategy_key: record.strategyKey,
          first_step: record.firstStep,
          planned_minutes: record.plannedMinutes,
          actual_seconds: record.actualSeconds,
          outcome: record.outcome,
          helpful_rating: record.helpfulRating,
          crisis_triggered: record.crisisTriggered,
        });
      }
    } catch {
      // Keep local record
    }
  }

  return record;
}

export function getLocalCheckins(): TreatmentCheckinRecord[] {
  return safeReadJson<TreatmentCheckinRecord[]>(STORAGE_KEYS.checkins, []);
}

export async function recordTreatmentCheckin(
  input: Omit<TreatmentCheckinRecord, 'id' | 'userId' | 'createdAt'>
): Promise<TreatmentCheckinRecord> {
  const record: TreatmentCheckinRecord = {
    ...input,
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `chk-${Date.now()}`,
    userId: 'local-user',
    createdAt: new Date().toISOString(),
  };

  const current = getLocalCheckins();
  const updated = [record, ...current];
  safeWriteJson(STORAGE_KEYS.checkins, updated);

  await appendAuditEvent(
    'treatment_checkin_logged',
    `Recorded treatment check-in: ${record.takenStatus}`
  );

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase.from('treatment_checkins').insert({
          id: record.id,
          user_id: userData.user.id,
          created_at: record.createdAt,
          taken_status: record.takenStatus,
          side_effects_noted: record.sideEffectsNoted,
          side_effect_note: record.sideEffectNote,
          focus_rating: record.focusRating,
          sleep_quality: record.sleepQuality,
        });
      }
    } catch {
      // Keep local record
    }
  }

  return record;
}

export function getLocalAuditEvents(): AuditEventRecord[] {
  return safeReadJson<AuditEventRecord[]>(STORAGE_KEYS.audits, []);
}

export async function appendAuditEvent(
  eventType: string,
  eventSummary: string
): Promise<AuditEventRecord> {
  const event: AuditEventRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `aud-${Date.now()}`,
    userId: 'local-user',
    createdAt: new Date().toISOString(),
    eventType: eventType.slice(0, 80),
    eventSummary: eventSummary.slice(0, 280),
  };

  const current = getLocalAuditEvents();
  safeWriteJson(STORAGE_KEYS.audits, [event, ...current].slice(0, 200));

  return event;
}

export function exportAllUserDataJson(): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    application: 'Stay — Voice-First ADHD Support Companion',
    notice: 'User-generated self-tracking export. Not a medical device or clinical diagnostic record.',
    profile: getLocalProfile(),
    coachSessions: getLocalSessions(),
    treatmentCheckins: getLocalCheckins(),
    auditEvents: getLocalAuditEvents(),
  };
  return JSON.stringify(payload, null, 2);
}

export async function deleteAllUserData(): Promise<void> {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEYS.profile);
    window.localStorage.removeItem(STORAGE_KEYS.sessions);
    window.localStorage.removeItem(STORAGE_KEYS.checkins);
    window.localStorage.removeItem(STORAGE_KEYS.audits);
  }

  const supabase = getSupabaseBrowserClient();
  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (accessToken) {
        await fetch('/api/account/delete', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }
    } catch {
      // Local storage is already purged
    }
  }
}
