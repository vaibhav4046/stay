import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';
import { callLlm, llmHeaders } from '@/lib/llm/provider';
import { enforceLater, fallbackTriage, parseTriageReply, TRIAGE_SYSTEM } from '@/lib/coach/triage';
import { attachGuardHeaders, guardPaidRoute, readBoundedJson } from '@/lib/security/apiGuard';

const Body = z.object({ text: z.string().min(2).max(2000) });

/** Brain dump triage. Safety gates first; then the model (the person's own key if they added one); then a deterministic fallback. */
export async function POST(req: NextRequest) {
  // Spends the server LLM key: same origin + session + rate limit as every other paid route.
  const guard = guardPaidRoute(req, 'coach');
  if (!guard.ok && guard.response) return guard.response;

  const body = await readBoundedJson(req, 8_192);
  if (!body.ok) return body.response;
  const parsed = Body.safeParse(body.data);
  if (!parsed.success) {
    return attachGuardHeaders(
      NextResponse.json({ error: 'Send what is on your mind (2 to 2000 characters).' }, { status: 400 }),
      guard
    );
  }
  const { text } = parsed.data;

  if (detectCrisisSignal(text).triggered) return attachGuardHeaders(NextResponse.json({ safety: 'crisis' }), guard);
  if (detectMedicationAdviceRequest(text).triggered) return attachGuardHeaders(NextResponse.json({ safety: 'medication' }), guard);

  const llm = await callLlm(req, {
    messages: [
      { role: 'system', content: TRIAGE_SYSTEM },
      { role: 'user', content: text },
    ],
    maxTokens: 900,
    temperature: 0.2,
    serverModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    timeoutMs: 9000,
  });
  const hdr = { headers: llmHeaders(llm) };
  const fromModel = llm.ok ? parseTriageReply(llm.text) : null;
  if (fromModel) {
    return attachGuardHeaders(NextResponse.json({ ...fromModel, items: enforceLater(fromModel.items, text), source: 'model' }, hdr), guard);
  }
  return attachGuardHeaders(NextResponse.json({ ...fallbackTriage(text), source: 'fallback' }, hdr), guard);
}
