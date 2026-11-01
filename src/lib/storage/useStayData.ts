'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CoachSessionRecord, TreatmentCheckinRecord, UserProfile } from '@/types/domain';
import {
  DEFAULT_USER_PROFILE,
  SAMPLE_DEMO_CHECKINS,
  SAMPLE_DEMO_SESSIONS,
  getLocalCheckins,
  getLocalProfile,
  getLocalSessions,
  recordCoachSession,
  deleteCoachSession,
  restoreCoachSession,
  recordTreatmentCheckin,
  saveProfile,
} from '@/lib/storage/repository';

export type DataVariant = 'demo' | 'app';

/** Shift sample timestamps so the demo always falls inside the last 7 days. */
function freshenSample<T extends { createdAt: string }>(items: T[]): T[] {
  if (items.length === 0) return items;
  const newest = Math.max(...items.map((i) => new Date(i.createdAt).getTime()));
  const shift = Date.now() - 2 * 60 * 60 * 1000 - newest;
  return items.map((i) => ({ ...i, createdAt: new Date(new Date(i.createdAt).getTime() + shift).toISOString() }));
}

export function useStayData(variant: DataVariant) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  const [sessions, setSessions] = useState<CoachSessionRecord[]>([]);
  const [checkins, setCheckins] = useState<TreatmentCheckinRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (variant === 'demo') {
      setProfile({ ...DEFAULT_USER_PROFILE, careContext: 'waitlisted', onboardingCompleted: true });
      setSessions(freshenSample(SAMPLE_DEMO_SESSIONS));
      setCheckins(freshenSample(SAMPLE_DEMO_CHECKINS));
    } else {
      setProfile(getLocalProfile());
      setSessions(getLocalSessions());
      setCheckins(getLocalCheckins());
    }
    setLoaded(true);
  }, [variant]);

  const updateProfile = useCallback(
    async (patch: Partial<UserProfile>) => {
      if (variant === 'demo') {
        setProfile((p) => ({ ...p, ...patch }));
        return;
      }
      setProfile(await saveProfile(patch));
    },
    [variant]
  );

  const addSession = useCallback(
    async (input: Omit<CoachSessionRecord, 'id' | 'userId' | 'createdAt'>) => {
      if (variant === 'demo') {
        const rec: CoachSessionRecord = {
          ...input,
          id: `demo-live-${Date.now()}`,
          userId: 'sample-demo-user',
          createdAt: new Date().toISOString(),
          isSample: true,
        };
        setSessions((s) => [rec, ...s]);
        return rec;
      }
      const rec = await recordCoachSession(input);
      setSessions((s) => [rec, ...s]);
      return rec;
    },
    [variant]
  );

  const removeSession = useCallback(
    async (id: string) => {
      if (variant !== 'demo') {
        await deleteCoachSession(id);
      }
      setSessions((s) => s.filter((item) => item.id !== id));
    },
    [variant]
  );

  const restoreSession = useCallback(
    async (rec: CoachSessionRecord) => {
      if (variant !== 'demo') {
        await restoreCoachSession(rec);
      }
      setSessions((s) => [rec, ...s]);
    },
    [variant]
  );

  const addCheckin = useCallback(
    async (input: Omit<TreatmentCheckinRecord, 'id' | 'userId' | 'createdAt'>) => {
      const todayKey = new Date().toISOString().slice(0, 10);
      if (variant === 'demo') {
        let rec: TreatmentCheckinRecord;
        setCheckins((c) => {
          const idx = c.findIndex((x) => x.createdAt.slice(0, 10) === todayKey);
          if (idx >= 0) {
            rec = { ...c[idx], ...input, updatedAt: new Date().toISOString() };
            const next = [...c];
            next[idx] = rec;
            return next;
          }
          rec = {
            ...input,
            id: `demo-chk-live-${Date.now()}`,
            userId: 'sample-demo-user',
            createdAt: new Date().toISOString(),
            isSample: true,
          };
          return [rec, ...c];
        });
        return rec!;
      }
      const rec = await recordTreatmentCheckin(input);
      setCheckins((c) => {
        const idx = c.findIndex((x) => x.id === rec.id || x.createdAt.slice(0, 10) === todayKey);
        if (idx >= 0) {
          const next = [...c];
          next[idx] = rec;
          return next;
        }
        return [rec, ...c];
      });
      return rec;
    },
    [variant]
  );

  return {
    profile,
    sessions,
    checkins,
    loaded,
    updateProfile,
    addSession,
    removeSession,
    restoreSession,
    addCheckin,
  };
}
