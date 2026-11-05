'use client';

/**
 * What Stay said while the app was closed. The service worker files each check-in in Cache Storage the moment it arrives; the
 * page reads them here, shows them as a card with an unread dot, and clears them (and the app-icon badge) when dismissed.
 * Nothing leaves the device and nothing here touches the server.
 */
import { useCallback, useEffect, useState } from 'react';

export interface InboxItem {
  at: number;
  body: string;
}

export const INBOX_CACHE = 'stay-inbox';
const PREFIX = '/__stay-inbox/';
const MAX_ITEMS = 5;

const isItem = (v: unknown): v is InboxItem => !!v && typeof v === 'object' && typeof (v as InboxItem).at === 'number' && typeof (v as InboxItem).body === 'string' && (v as InboxItem).body.length > 0;

export async function readInbox(): Promise<InboxItem[]> {
  if (typeof caches === 'undefined') return [];
  try {
    const cache = await caches.open(INBOX_CACHE);
    const found = await Promise.all((await cache.keys()).map((req) => cache.match(req).then((r) => r?.json()).catch(() => null)));
    return found.filter(isItem).sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

async function remove(at: number | 'all'): Promise<void> {
  try {
    const cache = await caches.open(INBOX_CACHE);
    for (const req of await cache.keys()) if (at === 'all' || req.url.endsWith(`${PREFIX}${at}`)) await cache.delete(req);
  } catch {
    // nothing stored, nothing to remove
  }
}

/** Clears the badge on the app icon (installed app, Chromium and iOS Home Screen apps); a browser tab has none. */
export const clearBadge = (): void => void (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => undefined);

export function useCheckinInbox() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const refresh = useCallback(() => void readInbox().then(setItems), []);

  useEffect(() => {
    refresh();
    // opening the app counts as having seen the notification: the icon badge goes, the card and its dot stay until dismissed
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
        clearBadge();
      }
    };
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'stay-checkin') refresh();
    };
    onVisible();
    document.addEventListener('visibilitychange', onVisible);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [refresh]);

  const dismiss = useCallback(
    (at: number | 'all') => {
      setItems((cur) => (at === 'all' ? [] : cur.filter((i) => i.at !== at)));
      void remove(at).then(refresh);
    },
    [refresh],
  );

  return { items, dismiss };
}
