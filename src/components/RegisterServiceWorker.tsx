'use client';

import { useEffect } from 'react';
import { initHostLinks } from '@/lib/host';

/** Registers the offline shell in production only (a service worker in development would cache half-built files). */
export function RegisterServiceWorker() {
  useEffect(() => {
    initHostLinks();
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
