import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedBrowserClient: SupabaseClient | null = null;
let memoryFallbackConfig: { url: string; anonKey: string } | null = null;

export function getEffectiveSupabaseConfig(): { url: string; anonKey: string } | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }
  if (typeof window !== 'undefined') {
    try {
      const localUrl = localStorage.getItem('stay_supabase_url');
      const localKey = localStorage.getItem('stay_supabase_anon_key');
      if (localUrl && localKey) {
        return { url: localUrl, anonKey: localKey };
      }
    } catch {
      // ignore
    }
  }
  return memoryFallbackConfig;
}

export function isSupabaseConfigured(): boolean {
  return getEffectiveSupabaseConfig() !== null;
}

export function saveCustomSupabaseConfig(url: string, anonKey: string) {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  memoryFallbackConfig = { url: cleanUrl, anonKey: cleanKey };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('stay_supabase_url', cleanUrl);
      localStorage.setItem('stay_supabase_anon_key', cleanKey);
    } catch {
      // ignore
    }
  }
  cachedBrowserClient = null;
}

export function clearCustomSupabaseConfig() {
  memoryFallbackConfig = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem('stay_supabase_url');
      localStorage.removeItem('stay_supabase_anon_key');
    } catch {
      // ignore
    }
  }
  cachedBrowserClient = null;
}

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const config = getEffectiveSupabaseConfig();
  if (!config) {
    return null;
  }
  if (!cachedBrowserClient) {
    cachedBrowserClient = createClient(config.url, config.anonKey);
  }
  return cachedBrowserClient;
}
