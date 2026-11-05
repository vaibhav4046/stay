import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

/** The shared secret the scheduler and the timer chain call each other with (PUSH_TICK_SECRET). Compared in constant time. */
export function authorised(req: NextRequest): boolean {
  const secret = process.env.PUSH_TICK_SECRET;
  if (!secret) return false;
  const given = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}
