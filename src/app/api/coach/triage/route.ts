import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';
import { callLlm, llmHeaders } from '@/lib/llm/provider';
import { enforceLater, fallbackTriage, parseTriageReply, TRIAGE_SYSTEM } from '@/lib/coach/triage';

const Body = z.object({ text: z.string().min(2).max(2000) });

/** Brain dump triage. Safety gates first; then the model (the person's own key if they added one); then a deterministic fallback. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Send what is on your mind (2 to 2000 characters).' }, { status: 400 });
  const { text } = parsed.data;

  if (detectCrisisSignal(text).triggered) return NextResponse.json({ safety: 'crisis' });
  if (detectMedicationAdviceRequest(text).triggered) return NextResponse.json({ safety: 'medication' });

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
  if (fromModel) return NextResponse.json({ ...fromModel, items: enforceLater(fromModel.items, text), source: 'model' }, hdr);
  return NextResponse.json({ ...fallbackTriage(text), source: 'fallback' }, hdr);
}
