/**
 * Bring-your-own keys. They live only in this browser (localStorage) and travel as request headers through
 * Stay's own server to the provider the person chose. Stay never stores or logs them.
 */
import { PRESETS, type ProviderId } from './presets';

export interface ByokConfig {
  provider: ProviderId;
  llmKey: string;
  model: string;
  baseUrl: string;
  assemblyKey: string;
  /** Azure AI Speech key and region for the optional accent voices (Indian English, Mexican Spanish). Sent only to /api/voice/tts. */
  ttsKey: string;
  ttsRegion: string;
}

export const BYOK_STORAGE_KEY = 'stay_byok';
export const EMPTY_BYOK: ByokConfig = { provider: 'default', llmKey: '', model: '', baseUrl: '', assemblyKey: '', ttsKey: '', ttsRegion: '' };

export function loadByok(): ByokConfig {
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return EMPTY_BYOK;
    const p = JSON.parse(raw) as Partial<ByokConfig>;
    return {
      provider: (['default', 'groq', 'mistral', 'openai', 'custom'] as const).includes(p.provider as ProviderId) ? (p.provider as ProviderId) : 'default',
      llmKey: typeof p.llmKey === 'string' ? p.llmKey : '',
      model: typeof p.model === 'string' ? p.model : '',
      baseUrl: typeof p.baseUrl === 'string' ? p.baseUrl : '',
      assemblyKey: typeof p.assemblyKey === 'string' ? p.assemblyKey : '',
      ttsKey: typeof p.ttsKey === 'string' ? p.ttsKey : '',
      ttsRegion: typeof p.ttsRegion === 'string' ? p.ttsRegion : '',
    };
  } catch {
    return EMPTY_BYOK;
  }
}

export function saveByok(config: ByokConfig): void {
  try {
    window.localStorage.setItem(BYOK_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // private mode: keys last for this page only
  }
}

export function clearByok(): void {
  try {
    window.localStorage.removeItem(BYOK_STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

/** The endpoint and model a config resolves to (preset values unless custom). */
export function resolveTarget(c: ByokConfig): { baseUrl: string; model: string } | null {
  if (c.provider === 'default' || !c.llmKey.trim()) return null;
  if (c.provider === 'custom') return c.baseUrl.trim() && c.model.trim() ? { baseUrl: c.baseUrl.trim(), model: c.model.trim() } : null;
  const preset = PRESETS[c.provider];
  return { baseUrl: preset.baseUrl, model: c.model.trim() || preset.model };
}

/** Headers to attach to Stay's own API calls. Empty when the person uses the shared defaults. */
export function byokHeaders(config: ByokConfig = loadByok()): Record<string, string> {
  const h: Record<string, string> = {};
  const t = resolveTarget(config);
  if (t) {
    h['x-stay-llm-key'] = config.llmKey.trim();
    h['x-stay-llm-base'] = t.baseUrl;
    h['x-stay-llm-model'] = t.model;
  }
  if (config.assemblyKey.trim()) h['x-stay-aai-key'] = config.assemblyKey.trim();
  return h;
}

/** Headers for /api/voice/tts only (kept out of byokHeaders so the speech key never rides along on chat or token calls). Empty when no key is set. */
export function ttsHeaders(config: ByokConfig = loadByok()): Record<string, string> {
  const key = config.ttsKey.trim();
  const region = config.ttsRegion.trim().toLowerCase();
  return key && region ? { 'x-stay-tts-key': key, 'x-stay-tts-region': region } : {};
}
