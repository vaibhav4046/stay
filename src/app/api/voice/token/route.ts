import { NextRequest, NextResponse } from 'next/server';
import { assemblyKeyRefused, assemblyRestMs, getNextAssemblyAiKey, reportAssemblyAiKeyRateLimit } from '@/lib/voice/tokenOptimizer';
import { attachGuardHeaders, guardPaidRoute } from '@/lib/security/apiGuard';

async function handleMintToken(req: NextRequest) {
  const guard = guardPaidRoute(req, 'token');
  if (!guard.ok && guard.response) return guard.response;

  const userKey = req.headers.get('x-stay-aai-key')?.trim() || '';
  const hasUserKey = /^[\w-]{16,200}$/.test(userKey);

  const apiKey = hasUserKey ? userKey : getNextAssemblyAiKey() || process.env.ASSEMBLYAI_API_KEY;
  const agentId = process.env.ASSEMBLYAI_AGENT_ID || '';

  if (!apiKey) {
    return attachGuardHeaders(
      NextResponse.json(
        {
          code: 'quota',
          error:
            'Server voice credentials are not configured. Add your own AssemblyAI key in Settings, or use Quiet Text Mode.',
        },
        { status: 503 }
      ),
      guard
    );
  }

  try {
    // all-day companion sessions may run up to 3 hours (the provider's cap); ordinary sessions 60 minutes
    const long = req.nextUrl.searchParams.get('long') === '1' && hasUserKey;
    const url = `https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=${long ? 10800 : 3600}`;
    let upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    if (!hasUserKey && assemblyKeyRefused(upstream.status)) {
      reportAssemblyAiKeyRateLimit(apiKey, assemblyRestMs(upstream.status));
      const backupKey = getNextAssemblyAiKey();
      if (backupKey && backupKey !== apiKey) {
        upstream = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${backupKey}`,
          },
          cache: 'no-store',
        });
      }
    }

    if (!upstream.ok) {
      if ([401, 402, 403, 429].includes(upstream.status)) {
        return attachGuardHeaders(
          NextResponse.json(
            {
              code: hasUserKey ? 'invalid_user_key' : 'quota',
              error: hasUserKey
                ? 'AssemblyAI rejected your key. Check it in Settings, or continue in Quiet Text Mode.'
                : 'The shared voice allowance is used up for now. Add your own AssemblyAI key in Settings to keep talking, or use Quiet Text Mode.',
            },
            { status: 429, headers: { 'Retry-After': '60' } }
          ),
          guard
        );
      }
      return attachGuardHeaders(
        NextResponse.json(
          {
            error:
              'Unable to mint a temporary AssemblyAI voice session token right now. Please try Quiet Text Mode.',
          },
          { status: 502 }
        ),
        guard
      );
    }

    const data = (await upstream.json()) as { token?: string };
    if (!data.token) {
      return attachGuardHeaders(
        NextResponse.json(
          { error: 'Invalid token response from voice provider.' },
          { status: 502 }
        ),
        guard
      );
    }

    return attachGuardHeaders(
      NextResponse.json(
        {
          token: data.token,
          agentId,
          wsUrl: 'wss://agents.assemblyai.com/v1/ws',
          speechModel: 'u3-rt-pro',
          expiresInSeconds: 180,
          keySource: hasUserKey ? 'user' : 'server',
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      ),
      guard
    );
  } catch {
    return attachGuardHeaders(
      NextResponse.json(
        {
          error:
            'Network error reaching AssemblyAI token service. Quiet Text Mode remains available.',
        },
        { status: 502 }
      ),
      guard
    );
  }
}

export async function GET(req: NextRequest) {
  return handleMintToken(req);
}

export async function POST(req: NextRequest) {
  return handleMintToken(req);
}
