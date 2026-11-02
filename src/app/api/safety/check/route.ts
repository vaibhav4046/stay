import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectCrisisSignal, detectMedicationAdviceRequest, MEDICAL_BOUNDARY_FIXED_MESSAGE } from '@/lib/safety/crisis';
import { crisisMessageFor } from '@/lib/safety/region';
import { readBoundedJson } from '@/lib/security/apiGuard';

/**
 * The same crisis and medication checks the web app runs, for the phone agent (agent/agent.py), so a call is held to exactly the same
 * rules as the website instead of a second copy of the patterns that would drift. No model is called and nothing is stored; the text
 * is checked and dropped. Server-to-server, so there is no same-origin check; it is cheap regex work on at most 2 KB.
 */
const Body = z.object({
  text: z.string().max(2000),
  /** from the caller's number: +44 is GB, +1 is US or CA */
  region: z.enum(['GB', 'US', 'CA', 'OTHER']).optional(),
});

export async function POST(req: NextRequest) {
  const read = await readBoundedJson(req, 4096);
  if (!read.ok) return read.response;
  const parsed = Body.safeParse(read.data);
  if (!parsed.success) return NextResponse.json({ error: 'expected { text, region? }' }, { status: 400 });
  const { text, region } = parsed.data;
  if (detectCrisisSignal(text).triggered) {
    return NextResponse.json({ verdict: 'crisis', message: crisisMessageFor(region ?? null) });
  }
  if (detectMedicationAdviceRequest(text).triggered) {
    return NextResponse.json({ verdict: 'medication', message: MEDICAL_BOUNDARY_FIXED_MESSAGE });
  }
  return NextResponse.json({ verdict: 'ok', message: null });
}
