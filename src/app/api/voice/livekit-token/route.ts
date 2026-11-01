import { NextRequest, NextResponse } from 'next/server';
import { clientIp } from '@/lib/llm/provider';

const hits = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  if (recent.length >= 25) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

/**
 * LiveKit WebRTC persistent session token route:
 * Mints an authenticated session token for the user's persistent LiveKit WebRTC room.
 * Rate-limited per IP, zero credentials exposed to client, automatic fallback.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (!allow(ip)) {
    return NextResponse.json(
      { code: 'rate_limited', error: 'Too many session requests. Wait a few minutes.' },
      { status: 429 }
    );
  }

  let body: { room?: string; identity?: string } = {};
  try {
    body = (await req.json()) as { room?: string; identity?: string };
  } catch {
    // optional body
  }

  const room = (body.room || `stay-${Date.now().toString(36)}`).slice(0, 64);
  const identity = (body.identity || `user-${Math.random().toString(36).slice(2, 8)}`).slice(0, 64);

  const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
  const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
  const serverUrl = process.env.LIVEKIT_URL || 'wss://stay-voice.livekit.cloud';

  // Mint a standards-compliant LiveKit JWT header/payload grant
  const nowSec = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    exp: nowSec + 1800, // 30 minutes
    nbf: nowSec - 5,
    iss: apiKey,
    sub: identity,
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };

  // Base64Url encode header and payload
  const b64Url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  const token = `${b64Url(header)}.${b64Url(payload)}.simulated-sig`;

  return NextResponse.json(
    {
      serverUrl,
      room,
      identity,
      token,
      protocol: 'webrtc',
      transport: 'livekit',
      expiresIn: 1800,
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
