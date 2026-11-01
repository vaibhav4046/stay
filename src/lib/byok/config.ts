/**
 * Bring-your-own keys. By default, keys stay in memory only for the current tab session.
 * Session-only storage (`sessionStorage`) is strictly opt-in (`persistSession: true`) with an explicit disclosure.
 * Invalid saved configurations (such as unsafe custom base URLs or malformed keys) are rejected on load.
 */
import { PRESETS, type ProviderId } from './presets';
import { safeBaseUrl } from '@/lib/llm/provider';

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
export const EMPTY_BYOK: ByokConfig = {
  provider: 'default',
  llmKey: '',
  model: '',
  baseUrl: '',
  assemblyKey: '',
  ttsKey: '',
  ttsRegion: '',
};

let memoryByok: ByokConfig = { ...EMPTY_BYOK };

export function validateByokConfig(p: Partial<ByokConfig> | null | undefined): ByokConfig | null {
  if (!p || typeof p !== 'object') return null;
  const validProviders: readonly ProviderId[] = ['default', 'groq', 'mistral', 'openai', 'custom'];
  if (p.provider !== undefined && !validProviders.includes(p.provider as ProviderId)) {
    return null;
  }
  const provider: ProviderId = (p.provider as ProviderId) || 'default';
  const llmKey = typeof p.llmKey === 'string' ? p.llmKey.trim() : '';
  const model = typeof p.model === 'string' ? p.model.trim() : '';
  const rawBaseUrl = typeof p.baseUrl === 'string' ? p.baseUrl.trim() : '';
  const assemblyKey = typeof p.assemblyKey === 'string' ? p.assemblyKey.trim() : '';
  const ttsKey = typeof p.ttsKey === 'string' ? p.ttsKey.trim() : '';
  const ttsRegion = typeof p.ttsRegion === 'string' ? p.ttsRegion.trim().toLowerCase() : '';

  if (llmKey && (/\s/.test(llmKey) || llmKey.length > 400)) return null;
  if (assemblyKey && (/\s/.test(assemblyKey) || assemblyKey.length > 200)) return null;
  if (ttsKey && (/\s/.test(ttsKey) || ttsKey.length > 200)) return null;
  if (model && !/^[\w.:/@-]{1,100}$/.test(model)) return null;

  let baseUrl = '';
  if (provider === 'custom' && rawBaseUrl) {
    const validatedUrl = safeBaseUrl(rawBaseUrl);
    if (!validatedUrl) return null;
    baseUrl = validatedUrl;
  } else if (rawBaseUrl) {
    const validatedUrl = safeBaseUrl(rawBaseUrl);
    if (!validatedUrl) return null;
    baseUrl = validatedUrl;
  }

  return {
    provider,
    llmKey,
    model,
    baseUrl,
    assemblyKey,
    ttsKey,
    ttsRegion,
  };
}

function isNonEmptyByok(c: ByokConfig): boolean {
  return Boolean(
    c.provider !== 'default' ||
      c.llmKey ||
      c.model ||
      c.baseUrl ||
      c.assemblyKey ||
      c.ttsKey ||
      c.ttsRegion
  );
}

export function loadByok(): ByokConfig {
  if (isNonEmptyByok(memoryByok)) {
    const validMem = validateByokConfig(memoryByok);
    if (validMem) return { ...validMem };
    memoryByok = { ...EMPTY_BYOK };
  }
  if (typeof window === 'undefined') return { ...EMPTY_BYOK };
  try {
    const raw =
      window.sessionStorage?.getItem(BYOK_STORAGE_KEY) ??
      window.localStorage?.getItem(BYOK_STORAGE_KEY);
    if (!raw) return { ...EMPTY_BYOK };
    const parsed = JSON.parse(raw) as Partial<ByokConfig>;
    const validated = validateByokConfig(parsed);
    if (!validated) {
      return { ...EMPTY_BYOK };
    }
    return validated;
  } catch {
    return { ...EMPTY_BYOK };
  }
}

export function saveByok(config: ByokConfig, options?: { persistSession?: boolean }): void {
  const validated = validateByokConfig(config);
  if (!validated) {
    memoryByok = { ...EMPTY_BYOK };
    return;
  }
  memoryByok = { ...validated };
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem(BYOK_STORAGE_KEY);
    if (options?.persistSession) {
      window.sessionStorage?.setItem(BYOK_STORAGE_KEY, JSON.stringify(validated));
    } else {
      window.sessionStorage?.removeItem(BYOK_STORAGE_KEY);
    }
  } catch {
    // storage unavailable; memoryByok remains active for this tab
  }
}

export function clearByok(): void {
  memoryByok = { ...EMPTY_BYOK };
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage?.removeItem(BYOK_STORAGE_KEY);
    window.localStorage?.removeItem(BYOK_STORAGE_KEY);
  } catch {
    // nothing to clear
  }
}

/** The endpoint and model a config resolves to (preset values unless custom). */
export function resolveTarget(c: ByokConfig): { baseUrl: string; model: string } | null {
  if (c.provider === 'default' || !c.llmKey.trim()) return null;
  if (c.provider === 'custom') {
    const cleanBase = safeBaseUrl(c.baseUrl.trim());
    const cleanModel = c.model.trim();
    return cleanBase && cleanModel ? { baseUrl: cleanBase, model: cleanModel } : null;
  }
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
