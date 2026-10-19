import { NextRequest, NextResponse } from 'next/server';
import { getNextAssemblyAiKey, reportAssemblyAiKeyRateLimit } from '@/lib/voice/tokenOptimizer';

const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TOKENS_PER_WINDOW = 25;
const ipRequests = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipRequests.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= MAX_TOKENS_PER_WINDOW) {
    ipRequests.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  ipRequests.set(ip, timestamps);
  return true;
}

async function handleMintToken(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'local';

  const userKey = req.headers.get('x-stay-aai-key')?.trim() || '';
  const hasUserKey = /^[\w-]{16,200}$/.test(userKey);
  if (!hasUserKey && !checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many voice session requests. Please wait a few minutes or use Quiet Text Mode.' },
      { status: 429 }
    );
  }

  const apiKey = hasUserKey ? userKey : getNextAssemblyAiKey() || process.env.ASSEMBLYAI_API_KEY;
  const agentId = process.env.ASSEMBLYAI_AGENT_ID || '';

  if (!apiKey) {
    return NextResponse.json(
      {
        code: 'quota',
        error:
          'Server voice credentials are not configured. Add your own AssemblyAI key in Settings, or use Quiet Text Mode.',
      },
      { status: 503 }
    );
  }

  try {
    // all-day companion sessions may run up to 3 hours (the provider's cap); ordinary sessions 30 minutes
    const long = req.nextUrl.searchParams.get('long') === '1' && hasUserKey; // shared allowance: 30 minutes, renewed
    const url = `https://agents.assemblyai.com/v1/token?expires_in_seconds=180&max_session_duration_seconds=${long ? 10800 : 1800}`;
    let upstream = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    });

    if (!hasUserKey && (upstream.status === 429 || upstream.status === 401)) {
      reportAssemblyAiKeyRateLimit(apiKey);
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
      // 401/402/403/429 from the provider: the shared allowance is used up (or the person's own key is wrong)
      if ([401, 402, 403, 429].includes(upstream.status)) {
        return NextResponse.json(
          {
            code: hasUserKey ? 'invalid_user_key' : 'quota',
            error: hasUserKey
              ? 'AssemblyAI rejected your key. Check it in Settings, or continue in Quiet Text Mode.'
              : 'The shared voice allowance is used up for now. Add your own AssemblyAI key in Settings to keep talking, or use Quiet Text Mode.',
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error:
            'Unable to mint a temporary AssemblyAI voice session token right now. Please try Quiet Text Mode.',
        },
        { status: 502 }
      );
    }

    const data = (await upstream.json()) as { token?: string };
    if (!data.token) {
      return NextResponse.json(
        { error: 'Invalid token response from voice provider.' },
        { status: 502 }
      );
    }

    return NextResponse.json(
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
    );
  } catch {
    return NextResponse.json(
      {
        error:
          'Network error reaching AssemblyAI token service. Quiet Text Mode remains available.',
      },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleMintToken(req);
}

export async function POST(req: NextRequest) {
  return handleMintToken(req);
}
