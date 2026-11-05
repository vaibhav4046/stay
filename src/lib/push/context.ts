'use client';

/**
 * The small note the service worker reads to write a check-in in the person's own words: their name and the newest thing still open
 * on their list. It sits in this browser's Cache Storage next to the app; it is never sent anywhere, and only kept while notifications
 * are allowed. Deleting all data removes it.
 */
import { useEffect } from 'react';
import { loadToday } from '@/lib/coach/todayList';
import { loadUserMemory } from '@/lib/coach/userMemory';
import { INBOX_CACHE } from './inbox';

export const CONTEXT_CACHE = 'stay-context';
const KEY = '/__stay-context';

export interface NudgeContext {
  name?: string;
  open?: string;
}

/** The newest item that is still open, and the name Stay knows. Pure, so it can be tested. */
export function buildNudgeContext(items: Array<{ text: string; done: boolean; createdAt: string }>, name: string | null): NudgeContext {
  const open = items.filter((i) => !i.done && i.text.trim()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.text;
  return { ...(name ? { name } : {}), ...(open ? { open } : {}) };
}

export async function publishNudgeContext(): Promise<void> {
  try {
    if (typeof caches === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const ctx = buildNudgeContext(loadToday(), loadUserMemory().name);
    const cache = await caches.open(CONTEXT_CACHE);
    await cache.put(KEY, new Response(JSON.stringify(ctx), { headers: { 'content-type': 'application/json' } }));
  } catch {
    // no storage: the check-in falls back to its general wording
  }
}

/** Keeps the note current: when the app opens and whenever it goes into the background, which is when the list last changed. */
export function usePublishNudgeContext(): void {
  useEffect(() => {
    void publishNudgeContext();
    const onHide = () => {
      if (document.visibilityState === 'hidden') void publishNudgeContext();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);
}

/** Used by "Delete all my data" and by switching check-ins off: nothing about the list or past messages stays behind. */
export async function clearNudgeData(): Promise<void> {
  try {
    await Promise.all([caches.delete(CONTEXT_CACHE), caches.delete(INBOX_CACHE)]);
  } catch {
    // nothing stored
  }
}
