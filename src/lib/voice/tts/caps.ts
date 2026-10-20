'use client';
import { useEffect, useState } from 'react';
import { loadByok } from '@/lib/byok/config';
import { chooseVoice, type VoicePersona } from '../personas';
import { AZURE_REGION_RE } from './ssml';
import { loadBrowserVoices } from './browserVoices';
import type { TtsCaps } from './types';

export const BYOK_CHANGED_EVENT = 'stay-byok-changed';

let cached: TtsCaps = { azure: false, browserVoices: [] };

export function azureConfigured(): boolean {
  const c = loadByok();
  return c.ttsKey.trim().length >= 16 && AZURE_REGION_RE.test(c.ttsRegion.trim().toLowerCase());
}

/** What this device and these settings can speak with, re-read now. */
export async function refreshTtsCaps(): Promise<TtsCaps> {
  const browserVoices = await loadBrowserVoices();
  cached = { azure: azureConfigured(), browserVoices };
  return cached;
}

/** The last loaded device voices plus the key setting read now, for synchronous checks (voice commands, connecting). */
export const cachedTtsCaps = (): TtsCaps => ({ ...cached, azure: azureConfigured() });

/** Why this persona cannot speak right now, or null when it can. */
export function voiceNeeds(p: VoicePersona): string | null {
  return chooseVoice(p, cachedTtsCaps()).needs ?? null;
}

/** React: the current capabilities, refreshed when settings change. */
export function useTtsCaps(): TtsCaps {
  const [caps, setCaps] = useState<TtsCaps>(cached);
  useEffect(() => {
    let alive = true;
    const run = () => void refreshTtsCaps().then((c) => alive && setCaps(c));
    run();
    window.addEventListener(BYOK_CHANGED_EVENT, run);
    window.addEventListener('storage', run);
    window.speechSynthesis?.addEventListener?.('voiceschanged', run);
    return () => {
      alive = false;
      window.removeEventListener(BYOK_CHANGED_EVENT, run);
      window.removeEventListener('storage', run);
      window.speechSynthesis?.removeEventListener?.('voiceschanged', run);
    };
  }, []);
  return caps;
}
