import { NextResponse } from 'next/server';

/**
 * For an uptime monitor (and for a person asking "is it up?"): answers from this server alone, never calls a provider, never spends a
 * token, and shows only how many keys and fallbacks are configured, never the keys.
 */
export const dynamic = 'force-dynamic';

const count = (...raw: Array<string | undefined>) => new Set(raw.flatMap((r) => (r ?? '').split(',').map((s) => s.trim()).filter(Boolean))).size;

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      time: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
      configured: {
        modelKeys: count(process.env.GROQ_API_KEYS, process.env.GROQ_API_KEY),
        speechKeys: count(process.env.ASSEMBLYAI_API_KEYS, process.env.ASSEMBLYAI_API_KEY),
        fallbackModel: Boolean(process.env.STAY_FALLBACK_LLM_BASE && process.env.STAY_FALLBACK_LLM_KEY && process.env.STAY_FALLBACK_LLM_MODEL),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
