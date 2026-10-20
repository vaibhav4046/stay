/**
 * Streaming twin of callLlm (see provider.ts): the person's own key first, then Stay's shared one (rate-limited),
 * under the same address rules. Used by fast voice, which needs tokens as they arrive.
 */
import { getNextGroqKey, reportGroqKeyRateLimit } from '@/lib/voice/tokenOptimizer';
import { allowServerUse, clientIp, classifyStatus, readUserLlm, userTargetUsable, GROQ_BASE, type LlmError, type LlmTarget } from './provider';

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

async function openStream(t: LlmTarget, call: LlmStreamCall, timings?: string[]): Promise<{ res: Response | null; error?: LlmError }> {
  const t0 = performance.now();
  const note = (status: number | string) => timings?.push(`llm${timings.length};dur=${Math.round(performance.now() - t0)};desc="${t.model.split('/').pop()} ${status}"`);
  const isGroqGptOss = t.baseUrl.startsWith(GROQ_BASE) && /gpt-oss/i.test(t.model);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), call.timeoutMs);
  try {
    const res = await fetch(`${t.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.key}`, 'Content-Type': 'application/json' },
      redirect: 'manual',
      body: JSON.stringify({
        model: t.model,
        messages: call.messages,
        stream: true,
        temperature: call.temperature,
        max_tokens: call.maxTokens,
        ...(call.tools?.length ? { tools: call.tools, tool_choice: 'auto' } : {}),
        ...(isGroqGptOss ? { reasoning_effort: 'low', include_reasoning: false } : {}),
      }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    note(res.status);
    if (!res.ok || !res.body) return { res: null, error: res.status >= 300 && res.status < 400 ? 'bad_endpoint' : classifyStatus(res.status) };
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
  let r = await openStream({ baseUrl: GROQ_BASE, key: first, model: call.serverModel }, call, timings);
  if (!r.res && (r.error === 'quota' || r.error === 'invalid_key')) {
    reportGroqKeyRateLimit(first);
    const backup = getNextGroqKey();
    if (backup && backup !== first) r = await openStream({ baseUrl: GROQ_BASE, key: backup, model: call.serverModel }, call, timings);
  }
  // each Groq model has its own per-minute token bucket: when the main one is spent, a smaller sibling still answers
  const spare = process.env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b';
  if (!r.res && r.error === 'quota' && spare !== call.serverModel) r = await openStream({ baseUrl: GROQ_BASE, key: first, model: spare }, call, timings);
  return done({ res: r.res, source: 'server', error: r.error, userKeyError });
}
