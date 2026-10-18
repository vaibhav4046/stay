import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { normalizeConceptKey } from '@/lib/orb/lexicon';
import { isSingleEmoji } from '@/lib/orb/points';
import { getNextGroqKey, reportGroqKeyRateLimit } from '@/lib/voice/tokenOptimizer';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';

/**
 * Shape service: maps up to three keywords to the single emoji that best depicts them.
 * The client turns that glyph into a cloud of dots; no image ever reaches the screen.
 * A tiny prompt on a small model keeps this at about 350 ms and ~150 tokens per call.
 */
const BodySchema = z.object({ keywords: z.array(z.string().min(1).max(32)).min(1).max(3) });

const SYSTEM =
  'You pick emoji. Given a concept, reply with exactly ONE emoji that best depicts it as a concrete object, animal, place or symbol. ' +
  'Prefer a literal picture over a face or a gesture. Reply with the emoji only, nothing else.';

const hits = new Map<string, number[]>();
function allow(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  if (recent.length >= 40) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
}

const cache = new Map<string, string>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!allow(ip)) return NextResponse.json({ error: 'Too many shape requests.' }, { status: 429 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Send up to three keywords.' }, { status: 400 });

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

  const apiKey = getNextGroqKey() || process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ emoji: null, source: 'none' });

  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // gpt-oss is a reasoning model: keep effort low and leave room for it, or the visible answer comes back empty
        model: process.env.GROQ_SHAPE_MODEL || 'openai/gpt-oss-20b',
        temperature: 0,
        max_tokens: 700,
        reasoning_effort: 'low',
        include_reasoning: false,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Concept: ${phrase}` },
        ],
      }),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    if (res.status === 429 || res.status === 401) reportGroqKeyRateLimit(apiKey);
    if (!res.ok) throw new Error(`groq ${res.status}`);
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const emoji = (json.choices?.[0]?.message?.content || '').trim();
    if (!isSingleEmoji(emoji)) throw new Error('not a single emoji');
    cache.set(key, emoji);
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return NextResponse.json({ emoji, source: 'ai' });
  } catch {
    return NextResponse.json({ emoji: null, source: 'unavailable' });
  }
}
