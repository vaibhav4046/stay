/**
 * Streaming twin of callLlm (see provider.ts): the person's own key first, then Stay's shared one (rate-limited),
 * under the same address rules. Used by fast voice, which needs tokens as they arrive.
 */
import { getNextGroqKey, reportGroqKeyRateLimit } from '@/lib/voice/tokenOptimizer';
import { allowServerUse, clientIp, classifyStatus, readUserLlm, userTargetUsable, GROQ_BASE, type LlmError, type LlmTarget } from './provider';

/** Models tried, in order, after the main one is out of tokens for the minute (each has its own 8,000-token bucket). */
const DEFAULT_SPARE_MODELS = 'openai/gpt-oss-20b,qwen/qwen3.8-27b';
/** The longest a spoken reply will wait for a spent bucket to refill before the person is told plainly. */
const MAX_REFILL_WAIT_MS = 3000;

export interface LlmStreamCall {
  messages: Array<Record<string, unknown>>;
  tools?: unknown[];
  maxTokens: number;
  temperature: number;
  serverModel: string;
  /** Time allowed until the provider starts answering (the stream itself is not cut off). */
  timeoutMs: number;
}

export interface LlmStreamResult {
  res: Response | null;
  source: 'user' | 'server';
  error?: LlmError;
  userKeyError?: LlmError;
  /** Server-Timing value: milliseconds until the provider answered, one entry per attempt (diagnostics only). */
  timing?: string;
}

async function openStream(t: LlmTarget, call: LlmStreamCall, timings?: string[]): Promise<{ res: Response | null; error?: LlmError; retryAfterMs?: number }> {
  const t0 = performance.now();
  const note = (status: number | string) => timings?.push(`llm${timings.length};dur=${Math.round(performance.now() - t0)};desc="${t.model.split('/').pop()} ${status}"`);
  const isGroqGptOss = t.baseUrl.startsWith(GROQ_BASE) && /gpt-oss/i.test(t.model);
  const isGroqQwen = t.baseUrl.startsWith(GROQ_BASE) && /qwen/i.test(t.model); // the vision model: answer, do not think aloud
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), call.timeoutMs);
  try {
    const res = await fetch(`${t.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.key}`, 'Content-Type': 'application/json' },
      redirect: 'error',
      body: JSON.stringify({
        model: t.model,
        messages: call.messages,
        stream: true,
        temperature: call.temperature,
        max_tokens: call.maxTokens,
        ...(call.tools?.length ? { tools: call.tools, tool_choice: 'auto' } : {}),
        ...(isGroqGptOss ? { reasoning_effort: 'low', include_reasoning: false } : {}),
        ...(isGroqQwen ? { reasoning_effort: 'none' } : {}),
      }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    note(res.status);
    if (!res.ok || !res.body) {
      const seconds = res.status === 429 ? Number.parseFloat(res.headers.get('retry-after') ?? '') : NaN;
      return { res: null, error: res.status >= 300 && res.status < 400 ? 'bad_endpoint' : classifyStatus(res.status), retryAfterMs: Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined };
    }
    return { res };
  } catch {
    clearTimeout(timer);
    note('unreachable');
    return { res: null, error: 'unreachable' };
  }
}

export async function openLlmStream(req: Request, call: LlmStreamCall): Promise<LlmStreamResult> {
  const user = readUserLlm(req);
  const timings: string[] = [];
  const done = (r: LlmStreamResult): LlmStreamResult => ({ ...r, timing: timings.join(', ') });
  let userKeyError: LlmError | undefined = req.headers.get('x-stay-llm-key') && !user ? 'bad_endpoint' : undefined;
  if (user) {
    const blocked = await userTargetUsable(req, user);
    if (blocked) userKeyError = blocked;
    else {
      const r = await openStream(user, call, timings);
      if (r.res) return done({ res: r.res, source: 'user' });
      userKeyError = r.error;
    }
  }
  if (!allowServerUse(clientIp(req))) return done({ res: null, source: 'server', error: 'rate_limited', userKeyError });
  const first = getNextGroqKey() || process.env.GROQ_API_KEY;
  if (!first) return done({ res: null, source: 'server', error: 'no_server_key', userKeyError });
  const primary: LlmTarget = { baseUrl: GROQ_BASE, key: first, model: call.serverModel };
  let r = await openStream(primary, call, timings);
  let soonest = r.retryAfterMs ?? Infinity; // the shortest wait any refused bucket asked for
  const note = (x: { retryAfterMs?: number }) => { if (x.retryAfterMs != null) soonest = Math.min(soonest, x.retryAfterMs); };
  if (!r.res && (r.error === 'quota' || r.error === 'invalid_key')) {
    reportGroqKeyRateLimit(first);
    const backup = getNextGroqKey();
    if (backup && backup !== first) { r = await openStream({ ...primary, key: backup }, call, timings); note(r); }
  }
  // each Groq model has its own per-minute token bucket: when the main one is spent, the next one still answers
  const spares = (process.env.GROQ_FALLBACK_MODELS || process.env.GROQ_FALLBACK_MODEL || DEFAULT_SPARE_MODELS).split(',').map((m) => m.trim()).filter((m) => m && m !== call.serverModel);
  for (const spare of spares) {
    if (r.res || r.error !== 'quota') break;
    r = await openStream({ ...primary, model: spare }, call, timings);
    note(r);
  }
  // every bucket spent, but one refills within a moment: wait for that rather than turn the person away
  if (!r.res && r.error === 'quota' && soonest <= MAX_REFILL_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, soonest + 50));
    r = await openStream(primary, call, timings);
  }
  return done({ res: r.res, source: 'server', error: r.error, userKeyError });
}
