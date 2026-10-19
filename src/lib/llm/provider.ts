/**
 * One place that talks to a chat-completions provider: the person's own (headers) or Stay's shared default.
 * Their key is used for that one request and never stored or logged.
 */
import { lookup } from 'node:dns/promises';
import { getNextGroqKey, reportGroqKeyRateLimit } from '@/lib/voice/tokenOptimizer';

export type LlmError = 'invalid_key' | 'quota' | 'unreachable' | 'bad_endpoint' | 'rate_limited' | 'no_server_key' | 'other';

export interface LlmResult {
  ok: boolean;
  text: string;
  source: 'user' | 'server';
  error?: LlmError;
  /** Set when the person's own key was tried first and failed, so the UI can say so. */
  userKeyError?: LlmError;
}

export interface LlmCall {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens: number;
  temperature: number;
  serverModel: string;
  timeoutMs: number;
}

export interface LlmTarget {
  baseUrl: string;
  key: string;
  model: string;
}

export const GROQ_BASE = 'https://api.groq.com/openai/v1';
const PRIVATE_V4 = /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/** https only, no credentials in the URL, and never a loopback, private-range, link-local or internal host. */
export function safeBaseUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password) return null;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) return null;
  if (host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null; // IP literals are never a real provider
  if (PRIVATE_V4.test(host)) return null;
  return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
}

/** True for loopback, private, link-local, CGNAT, benchmarking, multicast and reserved addresses, v4 and v6. Unparseable means unsafe. */
export function isPrivateIp(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v.includes(':')) {
    if (v === '::' || v === '::1') return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^(fc|fd|fe[89ab]|ff)/.test(v);
  }
  const p = v.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
}

const PRESET_HOSTS = new Set(['api.groq.com', 'api.mistral.ai', 'api.openai.com']);
const dnsCache = new Map<string, { ok: boolean; at: number }>();

/**
 * A public-looking name can still resolve to a private address (localtest.me, 127.0.0.1.nip.io, a rebinding domain).
 * Before a request goes to someone else's address, resolve it and refuse if any answer is private.
 */
export async function resolvesPublic(host: string): Promise<boolean> {
  if (PRESET_HOSTS.has(host)) return true;
  const hit = dnsCache.get(host);
  if (hit && Date.now() - hit.at < 60_000) return hit.ok;
  let ok = false;
  try {
    const answers = await lookup(host, { all: true });
    ok = answers.length > 0 && answers.every((a) => !isPrivateIp(a.address));
  } catch {
    ok = false;
  }
  dnsCache.set(host, { ok, at: Date.now() });
  if (dnsCache.size > 500) dnsCache.delete(dnsCache.keys().next().value as string);
  return ok;
}

const byokHits = new Map<string, number[]>();
/** The person's own key skips the shared-key limit, but not all limits: 120 requests a minute per address stops an open relay. */
export function allowByokUse(ip: string): boolean {
  const now = Date.now();
  const recent = (byokHits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 120) return false;
  recent.push(now);
  byokHits.set(ip, recent);
  if (byokHits.size > 2000) byokHits.delete(byokHits.keys().next().value as string);
  return true;
}

/** Everything that must hold before a request is sent to the person's own provider address. */
export async function userTargetUsable(req: Request, t: LlmTarget): Promise<LlmError | null> {
  if (!allowByokUse(clientIp(req))) return 'rate_limited';
  if (!(await resolvesPublic(new URL(t.baseUrl).hostname))) return 'bad_endpoint';
  return null;
}

export function readUserLlm(req: Request): LlmTarget | null {
  const key = req.headers.get('x-stay-llm-key')?.trim() || '';
  const base = req.headers.get('x-stay-llm-base')?.trim() || '';
  const model = req.headers.get('x-stay-llm-model')?.trim() || '';
  if (!key || !base || !model) return null;
  if (key.length > 400 || /\s/.test(key) || !/^[\w.:/@-]{1,100}$/.test(model)) return null;
  const baseUrl = safeBaseUrl(base);
  return baseUrl ? { baseUrl, key, model } : null;
}

export function classifyStatus(status: number): LlmError {
  if (status === 401 || status === 403) return 'invalid_key';
  if (status === 429 || status === 402) return 'quota';
  return 'other';
}

async function post(t: LlmTarget, call: LlmCall): Promise<{ ok: boolean; status: number; text: string; error?: LlmError }> {
  const isGroqGptOss = t.baseUrl.startsWith(GROQ_BASE) && /gpt-oss/i.test(t.model);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), call.timeoutMs);
  try {
    const res = await fetch(`${t.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.key}`, 'Content-Type': 'application/json' },
      redirect: 'manual', // a provider that redirects is not a provider; never follow into another host
      body: JSON.stringify({
        model: t.model,
        messages: call.messages,
        temperature: call.temperature,
        max_tokens: call.maxTokens,
        // gpt-oss is a reasoning model: low effort and no reasoning text, or the visible answer comes back empty
        ...(isGroqGptOss ? { reasoning_effort: 'low', include_reasoning: false } : {}),
      }),
      signal: ctl.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, text: '', error: res.status >= 300 && res.status < 400 ? 'bad_endpoint' : classifyStatus(res.status) };
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = (json.choices?.[0]?.message?.content || '').trim();
    return text ? { ok: true, status: 200, text } : { ok: false, status: 200, text: '', error: 'other' };
  } catch {
    return { ok: false, status: 0, text: '', error: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

const serverHits = new Map<string, number[]>();
/** Shared-key protection: 30 server-paid reasoning calls per minute per address. Bring-your-own keys skip this. */
export function allowServerUse(ip: string): boolean {
  const now = Date.now();
  const recent = (serverHits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 30) return false;
  recent.push(now);
  serverHits.set(ip, recent);
  if (serverHits.size > 2000) serverHits.delete(serverHits.keys().next().value as string);
  return true;
}

export function clientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}

export async function callLlm(req: Request, call: LlmCall): Promise<LlmResult> {
  const user = readUserLlm(req);
  const hadUserHeaders = Boolean(req.headers.get('x-stay-llm-key'));
  let userKeyError: LlmError | undefined = hadUserHeaders && !user ? 'bad_endpoint' : undefined;

  if (user) {
    const blocked = await userTargetUsable(req, user);
    if (blocked) userKeyError = blocked;
    else {
      const r = await post(user, call);
      if (r.ok) return { ok: true, text: r.text, source: 'user' };
      userKeyError = r.error;
    }
  }

  if (!allowServerUse(clientIp(req))) return { ok: false, text: '', source: 'server', error: 'rate_limited', userKeyError };
  const first = getNextGroqKey() || process.env.GROQ_API_KEY;
  if (!first) return { ok: false, text: '', source: 'server', error: 'no_server_key', userKeyError };

  let r = await post({ baseUrl: GROQ_BASE, key: first, model: call.serverModel }, call);
  if (!r.ok && (r.status === 429 || r.status === 401)) {
    reportGroqKeyRateLimit(first);
    const backup = getNextGroqKey();
    if (backup && backup !== first) r = await post({ baseUrl: GROQ_BASE, key: backup, model: call.serverModel }, call);
  }
  return r.ok ? { ok: true, text: r.text, source: 'server', userKeyError } : { ok: false, text: '', source: 'server', error: r.error, userKeyError };
}

/** Response headers that tell the browser which brain answered and whether its own key worked. */
export function llmHeaders(r: LlmResult | null): Record<string, string> {
  if (!r) return {};
  return { 'x-stay-llm-source': r.ok ? r.source : 'fallback', ...(r.userKeyError ? { 'x-stay-llm-key-error': r.userKeyError } : {}) };
}

/** Test the person's own key with the smallest possible call. Never falls back to the shared key. */
export async function checkUserLlm(req: Request): Promise<{ ok: boolean; error?: LlmError; model?: string }> {
  const user = readUserLlm(req);
  if (!user) return { ok: false, error: 'bad_endpoint' };
  const blocked = await userTargetUsable(req, user);
  if (blocked) return { ok: false, error: blocked };
  const r = await post(user, { messages: [{ role: 'user', content: 'Reply with the single word OK.' }], maxTokens: 64, temperature: 0, serverModel: user.model, timeoutMs: 8000 });
  return r.ok ? { ok: true, model: user.model } : { ok: false, error: r.error };
}
