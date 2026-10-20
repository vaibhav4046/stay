import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';
import { APP_TOOL } from '@/lib/voice/agentTool';
import { llmHeaders } from '@/lib/llm/provider';
import { openLlmStream } from '@/lib/llm/stream';

const Message = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().max(4000).nullable().optional(),
  tool_calls: z.array(z.unknown()).max(4).optional(),
  tool_call_id: z.string().max(80).optional(),
});
const Body = z.object({ messages: z.array(Message).min(1).max(40), withTools: z.boolean().optional() });

/** Warm-up: the voice session calls this when it starts so the first real turn does not pay for a cold function. */
export async function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

/** Fast voice brain: streams the model's reply (and at most one app tool call). The safety gates run before any model. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad request.' }, { status: 400 });
  const { messages, withTools } = parsed.data;

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  if (detectCrisisSignal(lastUser).triggered) return NextResponse.json({ safety: 'crisis' });
  if (detectMedicationAdviceRequest(lastUser).triggered) return NextResponse.json({ safety: 'medication' });

  const tools = withTools === false ? undefined : [{ type: 'function', function: { name: APP_TOOL.name, description: APP_TOOL.description, parameters: APP_TOOL.parameters } }];
  const r = await openLlmStream(req, {
    messages,
    tools,
    maxTokens: 220,
    temperature: 0.5,
    serverModel: process.env.GROQ_VOICE_MODEL || 'openai/gpt-oss-120b',
    timeoutMs: 6000,
  });
  const hdr = llmHeaders({ ok: Boolean(r.res), text: '', source: r.source, error: r.error, userKeyError: r.userKeyError });
  if (!r.res) return NextResponse.json({ error: r.error || 'unavailable' }, { status: 502, headers: hdr });
  return new Response(r.res.body, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', ...(r.timing ? { 'Server-Timing': r.timing } : {}), ...hdr } });
}
