import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export type RateBucket = 'token' | 'chat' | 'coach' | 'tts' | 'orb' | 'agent';

const BUCKET_LIMITS: Record<RateBucket, { perSession: number; perIp: number; windowMs: number }> = {
  token: { perSession: 10, perIp: 20, windowMs: 60_000 },
  chat: { perSession: 30, perIp: 60, windowMs: 60_000 },
  coach: { perSession: 20, perIp: 40, windowMs: 60_000 },
  tts: { perSession: 30, perIp: 60, windowMs: 60_000 },
  orb: { perSession: 30, perIp: 60, windowMs: 60_000 },
  agent: { perSession: 20, perIp: 30, windowMs: 60_000 },
};

const MAX_CONCURRENT_VOICE_SESSIONS = 3;
const CONCURRENT_LEASE_MS = 5 * 60_000;
const SESSION_MAX_AGE_SEC = 86_400;
export const COOKIE_NAME = 'stay_session_sig';

interface WindowEntry {
  timestamps: number[];
}

const sessionWindows = new Map<string, WindowEntry>();
const ipWindows = new Map<string, WindowEntry>();
const activeVoiceLeases = new Map<string, Map<string, number>>();

export function resetSecurityStateForTests(): void {
  sessionWindows.clear();
  ipWindows.clear();
  activeVoiceLeases.clear();
}

function getHmacSecret(): string {
  return (
    process.env.STAY_SESSION_SECRET?.trim() ||
    process.env.ASSEMBLYAI_API_KEY?.trim() ||
    'stay-local-dev-hmac-secret-v1'
  );
}

function computeHmac(payload: string): string {
  return crypto.createHmac('sha256', getHmacSecret()).update(payload).digest('hex');
}

export function signSessionCookieValue(
  sessionId: string,
  issuedAtSec = Math.floor(Date.now() / 1000)
): string {
  const safeId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || crypto.randomUUID();
  const payload = `${safeId}.${issuedAtSec}`;
  const sig = computeHmac(payload);
  return `${payload}.${sig}`;
}

export function verifySessionCookieValue(rawCookie: string): {
  valid: boolean;
  sessionId?: string;
  reason?: string;
} {
  const parts = rawCookie.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'malformed_cookie' };
  }
  const [sessionId, issuedAtStr, sig] = parts;
  if (!sessionId || !/^[a-zA-Z0-9_-]{1,64}$/.test(sessionId)) {
    return { valid: false, reason: 'invalid_session_id' };
  }
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) {
    return { valid: false, reason: 'invalid_timestamp' };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec - issuedAt > SESSION_MAX_AGE_SEC || issuedAt > nowSec + 120) {
    return { valid: false, reason: 'expired_cookie' };
  }
  const expectedSig = computeHmac(`${sessionId}.${issuedAtStr}`);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return { valid: false, reason: 'bad_signature' };
  }
  return { valid: true, sessionId };
}

function extractCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

export function verifySameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get('origin');
  const requireOrigin = req.headers.get('x-stay-require-origin') === '1';

  if (!origin) {
    if (requireOrigin) {
      return NextResponse.json(
        { error: 'Missing Origin header on state-changing request.' },
        { status: 403 }
      );
    }
    return null;
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return NextResponse.json({ error: 'Malformed Origin header.' }, { status: 403 });
  }

  const rawHost =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    req.nextUrl?.host ||
    'localhost:3000';
  const expectedHost = rawHost.split(',')[0].trim().toLowerCase();

  if (originHost !== expectedHost) {
    return NextResponse.json(
      { error: 'Cross-origin request forbidden.' },
      { status: 403 }
    );
  }
  return null;
}

export interface GuardResult {
  ok: boolean;
  response?: NextResponse;
  sessionId: string;
  ip: string;
  setCookieHeader?: string;
}

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    return fwd.split(',')[0].trim() || '127.0.0.1';
  }
  return req.headers.get('x-real-ip')?.trim() || '127.0.0.1';
}

/** Most keys any limit table may hold. Random session ids must not grow the tables without end (review, 4 Nov 2026). */
const MAX_WINDOW_KEYS = 20_000;

function checkWindow(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number,
  now: number
): { allowed: boolean; retryAfterSec: number } {
  if (store.size > MAX_WINDOW_KEYS) {
    for (const [k, v] of store) if (!v.timestamps.some((t) => now - t < windowMs)) store.delete(k);
    if (store.size > MAX_WINDOW_KEYS) store.clear(); // every key is recent: a flood, so start the count again rather than run out of memory
  }
  const existing = store.get(key) ?? { timestamps: [] };
  existing.timestamps = existing.timestamps.filter((t) => now - t < windowMs);
  if (existing.timestamps.length >= limit) {
    const oldest = existing.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    store.set(key, existing);
    return { allowed: false, retryAfterSec };
  }
  existing.timestamps.push(now);
  store.set(key, existing);
  return { allowed: true, retryAfterSec: 0 };
}

export function guardPaidRoute(
  req: NextRequest,
  bucket: RateBucket,
  options?: { maxBytes?: number }
): GuardResult {
  const maxBytes = options?.maxBytes ?? 32_768;
  const ip = getClientIp(req);

  // 1. Same-origin check
  const originErr = verifySameOrigin(req);
  if (originErr) {
    return { ok: false, response: originErr, sessionId: 'rejected', ip };
  }

  // 2. Content-Length precheck
  const contentLength = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Request payload exceeds ${maxBytes} bytes.` },
        { status: 413 }
      ),
      sessionId: 'rejected',
      ip,
    };
  }

  // 3. Verify or issue HMAC session cookie
  const rawCookie =
    req.cookies?.get?.(COOKIE_NAME)?.value ??
    extractCookieFromHeader(req.headers.get('cookie'), COOKIE_NAME);

  let sessionId: string;
  let setCookieHeader: string | undefined;

  if (rawCookie) {
    const verified = verifySessionCookieValue(rawCookie);
    if (!verified.valid || !verified.sessionId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Unauthorized session cookie (${verified.reason || 'invalid'}).` },
          { status: 401 }
        ),
        sessionId: 'rejected',
        ip,
      };
    }
    sessionId = verified.sessionId;
  } else {
    if (req.headers.get('x-stay-require-cookie') === '1') {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Signed session cookie required.' },
          { status: 401 }
        ),
        sessionId: 'rejected',
        ip,
      };
    }
    const headerSession = req.headers.get('x-stay-session-id')?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    sessionId = headerSession || `anon_${ip.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const signed = signSessionCookieValue(sessionId);
    setCookieHeader = `${COOKIE_NAME}=${encodeURIComponent(signed)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SEC}`;
  }

  // 4. Concurrent voice session check for token mints
  const now = Date.now();
  if (bucket === 'token') {
    const voiceInstance = req.headers.get('x-stay-voice-instance')?.trim();
    if (voiceInstance) {
      const leases = activeVoiceLeases.get(sessionId) ?? new Map<string, number>();
      for (const [inst, expiresAt] of leases.entries()) {
        if (expiresAt <= now) leases.delete(inst);
      }
      if (!leases.has(voiceInstance) && leases.size >= MAX_CONCURRENT_VOICE_SESSIONS) {
        activeVoiceLeases.set(sessionId, leases);
        return {
          ok: false,
          response: NextResponse.json(
            { error: `Concurrent voice session limit (${MAX_CONCURRENT_VOICE_SESSIONS}) reached.` },
            { status: 429, headers: { 'Retry-After': '30' } }
          ),
          sessionId,
          ip,
        };
      }
      leases.set(voiceInstance, now + CONCURRENT_LEASE_MS);
      activeVoiceLeases.set(sessionId, leases);
    }
  }

  // 5. Rate limiting (per-session + per-IP second layer)
  const cfg = BUCKET_LIMITS[bucket];
  const sessionCheck = checkWindow(
    sessionWindows,
    `${bucket}:${sessionId}`,
    cfg.perSession,
    cfg.windowMs,
    now
  );
  if (!sessionCheck.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Too many requests for this session. Please slow down.' },
        {
          status: 429,
          headers: { 'Retry-After': String(sessionCheck.retryAfterSec) },
        }
      ),
      sessionId,
      ip,
    };
  }

  const ipCheck = checkWindow(ipWindows, `${bucket}:${ip}`, cfg.perIp, cfg.windowMs, now);
  if (!ipCheck.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Too many requests from this network. Please slow down.' },
        {
          status: 429,
          headers: { 'Retry-After': String(ipCheck.retryAfterSec) },
        }
      ),
      sessionId,
      ip,
    };
  }

  return { ok: true, sessionId, ip, setCookieHeader };
}

export async function readBoundedJson<T = unknown>(
  req: NextRequest,
  maxBytes = 32_768
): Promise<{ ok: true; data: T; rawBytes: number } | { ok: false; response: NextResponse }> {
  const contentLength = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Request payload exceeds ${maxBytes} bytes.` },
        { status: 413 }
      ),
    };
  }

  let rawText: string;
  try {
    rawText = await req.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unable to read request body.' }, { status: 400 }),
    };
  }

  const rawBytes = Buffer.byteLength(rawText, 'utf8');
  if (rawBytes > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Request payload exceeds ${maxBytes} bytes.` },
        { status: 413 }
      ),
    };
  }

  try {
    const data = JSON.parse(rawText) as T;
    return { ok: true, data, rawBytes };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON request body.' }, { status: 400 }),
    };
  }
}

export function attachGuardHeaders(res: NextResponse, guard: GuardResult): NextResponse {
  if (guard.setCookieHeader && !res.headers.has('set-cookie')) {
    res.headers.set('Set-Cookie', guard.setCookieHeader);
  }
  return res;
}
