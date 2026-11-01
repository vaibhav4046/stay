import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeConceptKey } from '@/lib/orb/lexicon';
import { isSingleEmoji } from '@/lib/orb/points';
import { callLlm } from '@/lib/llm/provider';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';
import { attachGuardHeaders, guardPaidRoute, readBoundedJson } from '@/lib/security/apiGuard';

/**
 * Shape service: maps up to three keywords to the single emoji that best depicts them.
 * The client turns that glyph into a cloud of dots; no image ever reaches the screen.
 * A tiny prompt on a small model keeps this at about 350 ms and ~150 tokens per call.
 */
const BodySchema = z.object({ keywords: z.array(z.string().min(1).max(32)).min(1).max(3) });

const SYSTEM =
  'You pick emoji. Given a concept, reply with exactly ONE emoji that best depicts it as a concrete object, animal, place or symbol. ' +
  'Prefer a literal picture over a face or a gesture. Reply with the emoji only, nothing else.';

const cache = new Map<string, string>();

export async function POST(req: NextRequest) {
  const guard = guardPaidRoute(req, 'orb');
  if (!guard.ok && guard.response) return guard.response;

  const bodyRes = await readBoundedJson(req, 32_768);
  if (!bodyRes.ok) return bodyRes.response;

  const parsed = BodySchema.safeParse(bodyRes.data);
  if (!parsed.success) {
    return attachGuardHeaders(
      NextResponse.json({ error: 'Send up to three keywords.' }, { status: 400 }),
      guard
    );
  }

  const keywords = parsed.data.keywords.map((k) => k.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').trim()).filter(Boolean);
  if (keywords.length === 0) return NextResponse.json({ error: 'Send up to three keywords.' }, { status: 400 });
  const phrase = keywords.join(' ');

  // Safety turns stay calm: never turn a crisis or medication moment into a playful picture.
  if (detectCrisisSignal(phrase).triggered || detectMedicationAdviceRequest(phrase).triggered) {
    return NextResponse.json({ emoji: null, source: 'withheld' });
  }

  const key = normalizeConceptKey(phrase);
  const hit = cache.get(key);
  if (hit) return NextResponse.json({ emoji: hit, source: 'ai', cached: true });

  try {
    const llm = await callLlm(req, {
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Concept: ${phrase}` },
      ],
      maxTokens: 700,
      temperature: 0,
      serverModel: process.env.GROQ_SHAPE_MODEL || 'openai/gpt-oss-20b',
      timeoutMs: 5000,
    });
    if (!llm.ok) throw new Error(`llm ${llm.error}`);
    const emoji = llm.text;
    if (!isSingleEmoji(emoji)) throw new Error('not a single emoji');
    cache.set(key, emoji);
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ emoji, source: 'ai' });
  } catch {
    return NextResponse.json({ emoji: null, source: 'unavailable' });
  }
}
