'use client';

import { useState, useEffect, useCallback } from 'react';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
  } catch {
    // storage unavailable
  }
  return null;
}

/**
 * Storage helpers for draft persistence across tab switches,
 * navigation changes, and accidental sheet dismissals.
 */
export function getPersistentDraft(key: string, defaultValue = ''): string {
  const storage = getStorage();
  if (!storage) return defaultValue;
  try {
    const saved = storage.getItem(key);
    return saved !== null ? saved : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setPersistentDraft(key: string, value: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (!value || value.trim() === '') {
      storage.removeItem(key);
    } else {
      storage.setItem(key, value);
    }
  } catch {
    // ignore quota/private mode errors
  }
}

export function clearPersistentDraft(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Hook for preserving unsubmitted user draft inputs across tab switches,
 * navigation changes, and accidental sheet dismissals.
 * Backed by sessionStorage so drafts survive client-side routing and tab changes
 * without polluting permanent storage across distinct browser sessions.
 */
export function usePersistentDraft(storageKey: string, defaultValue = '') {
  const [draft, setDraftState] = useState<string>(() => getPersistentDraft(storageKey, defaultValue));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromStorage = () => {
      const saved = getPersistentDraft(storageKey, defaultValue);
      if (saved !== draft) {
        setDraftState(saved);
      }
    };

    window.addEventListener('focus', syncFromStorage);
    return () => window.removeEventListener('focus', syncFromStorage);
  }, [storageKey, draft, defaultValue]);

  const setDraft = useCallback(
    (value: string | ((prev: string) => string)) => {
      setDraftState((prev) => {
        const next = typeof value === 'function' ? value(prev) : value;
        setPersistentDraft(storageKey, next);
        return next;
      });
    },
    [storageKey]
  );

  const clearDraft = useCallback(() => {
    clearPersistentDraft(storageKey);
    setDraftState('');
  }, [storageKey]);

  return [draft, setDraft, clearDraft] as const;
}
