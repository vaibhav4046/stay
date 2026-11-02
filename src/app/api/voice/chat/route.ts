import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';
import { APP_TOOL, buildServerVoiceSystemPrompt } from '@/lib/voice/agentTool';
import { carriesAnswer } from '@/lib/conversation/sse';
import { isOverloaded } from '@/lib/conversation/overload';
import { mayStartTimer, recentOpeners, unsupportedActionAnswer } from '@/lib/conversation/capabilities';
import { llmHeaders } from '@/lib/llm/provider';
import { openLlmStream } from '@/lib/llm/stream';
import { resolveDeterministicVoice, createDeterministicSseResponse } from '@/lib/voice/deterministicVoiceFallback';
import { attachGuardHeaders, guardPaidRoute, readBoundedJson } from '@/lib/security/apiGuard';
import { answerAboutStay } from '@/lib/voice/aboutStay';
import { classifyIntent } from '@/lib/conversation/intent';
import { NOTHING_SHOWN, honestFailureMessage, failureKindFromError } from '@/lib/conversation/response';
import { readSseText, visionReplyVerdict } from '@/lib/conversation/visionGate';
import { MAX_IMAGE_CHARS, VISION_SYSTEM, isImageDataUrl, withImage } from '@/lib/vision/image';

/** The app tool's parameters with the timer action taken out of its list of actions. */
function withoutTimer(parameters: typeof APP_TOOL.parameters) {
  return {
    ...parameters,
    properties: { ...parameters.properties, action: { ...parameters.properties.action, enum: parameters.properties.action.enum.filter((a) => a !== 'timer_start') } },
  };
}

const MAX_HISTORY_TURNS = 20;
const MAX_HISTORY_BYTES = 8_192;
/** A request may carry one shrunk picture; the history itself stays small. */
const MAX_BODY_BYTES = MAX_IMAGE_CHARS + 40_000;

const ClientMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string().max(4000).nullable().optional(),
  tool_calls: z.array(z.unknown()).max(4).optional(),
  tool_call_id: z.string().max(80).optional(),
});

const ContextSchema = z
  .object({
    language: z.string().max(32).optional(),
    notes: z.array(z.string().max(300)).max(4).optional(),
  })
  .optional();

const BodySchema = z.object({
  messages: z.array(ClientMessageSchema).min(1).max(MAX_HISTORY_TURNS),
  withTools: z.boolean().optional(),
  context: ContextSchema,
  /** One picture to look at this turn (a screen or camera frame, or a file): a small JPEG/PNG/WebP data URL. Never stored. */
  image: z.string().max(MAX_IMAGE_CHARS).optional(),
});

/** Warm-up: the voice session calls this when it starts so the first real turn does not pay for a cold function. */
export async function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

function createResilientStream(incoming: ReadableStream<Uint8Array>, lastUser: string): ReadableStream<Uint8Array> {
  const reader = incoming.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let emittedMeaningfulChunk = false;
  let buffered = '';
  let sseTail = ''; // the last, possibly unfinished, line of the stream

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (!emittedMeaningfulChunk && carriesAnswer([sseTail])) emittedMeaningfulChunk = true;
            if (!emittedMeaningfulChunk) {
              // the stream ended with no answer: say so, never invent one
              console.warn('[stay] empty_model_stream');
              const fallback = { text: honestFailureMessage('unavailable') };
              if (fallback.text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      id: 'chatcmpl-det-fallback',
                      object: 'chat.completion.chunk',
                      choices: [{ index: 0, delta: { role: 'assistant', content: fallback.text } }],
                    })}\n\ndata: [DONE]\n\n`
                  )
                );
              }
            }
            controller.close();
            break;
          }
          const text = decoder.decode(value, { stream: true });
          buffered += text;

          // If Groq emitted an in-stream error (e.g. tool_use_failed or invalid_request_error):
          if (
            buffered.includes('event: error') ||
            buffered.includes('"code":"tool_use_failed"') ||
            buffered.includes('"type":"invalid_request_error"')
          ) {
            if (!emittedMeaningfulChunk) {
              // the stream ended with no answer: say so, never invent one
              console.warn('[stay] empty_model_stream');
              const fallback = { text: honestFailureMessage('unavailable') };
              if (fallback.text) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      id: 'chatcmpl-det-fallback',
                      object: 'chat.completion.chunk',
                      choices: [{ index: 0, delta: { role: 'assistant', content: fallback.text } }],
                    })}\n\ndata: [DONE]\n\n`
                  )
                );
                emittedMeaningfulChunk = true;
              }
            }
            controller.close();
            try { await reader.cancel(); } catch {}
            break;
          }

          sseTail += text;
          const lines = sseTail.split('\n');
          sseTail = lines.pop() ?? '';
          if (carriesAnswer(lines)) emittedMeaningfulChunk = true;

          controller.enqueue(value);
        }
      } catch {
        if (!emittedMeaningfulChunk) {
          console.warn('[stay] model_stream_error');
          const fallback = { text: honestFailureMessage('timeout') };
          if (fallback.text) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: 'chatcmpl-det-fallback',
                  object: 'chat.completion.chunk',
                  choices: [{ index: 0, delta: { role: 'assistant', content: fallback.text } }],
                })}\n\ndata: [DONE]\n\n`
              )
            );
          }
        }
        controller.close();
      }
    },
    cancel() {
      return reader.cancel();
    },
  });
}

/** Fast voice brain: streams the model's reply (and at most one app tool call). The safety gates run before any model. */
export async function POST(req: NextRequest) {
  const guard = guardPaidRoute(req, 'chat');
  if (!guard.ok && guard.response) return guard.response;

  // text turns stay under 32 KB; only a request that says it carries a picture may be larger
  const bodyRes = await readBoundedJson(req, req.headers.get('x-stay-image') === '1' ? MAX_BODY_BYTES : 32_768);
  if (!bodyRes.ok) return bodyRes.response;

  const parsed = BodySchema.safeParse(bodyRes.data);
  if (!parsed.success) {
    return attachGuardHeaders(
      NextResponse.json(
        { error: 'Bad request: only user/assistant/tool roles allowed (max 20 turns).' },
        { status: 400 }
      ),
      guard
    );
  }
  const { messages: clientMessages, withTools, context, image } = parsed.data;
  if (image !== undefined && !isImageDataUrl(image)) {
    return attachGuardHeaders(NextResponse.json({ error: 'Bad picture: send a small JPEG, PNG or WebP data URL.' }, { status: 400 }), guard);
  }

  const totalHistoryBytes = Buffer.byteLength(
    clientMessages.map((m) => m.content || '').join('\n'),
    'utf8'
  );
  if (totalHistoryBytes > MAX_HISTORY_BYTES) {
    return attachGuardHeaders(
      NextResponse.json(
        { error: `Conversation history exceeds ${MAX_HISTORY_BYTES} bytes.` },
        { status: 413 }
      ),
      guard
    );
  }

  const lastUser = [...clientMessages].reverse().find((m) => m.role === 'user')?.content || '';
  if (detectCrisisSignal(lastUser).triggered) {
    return attachGuardHeaders(NextResponse.json({ safety: 'crisis' }), guard);
  }
  if (detectMedicationAdviceRequest(lastUser).triggered) {
    return attachGuardHeaders(NextResponse.json({ safety: 'medication' }), guard);
  }

  // a question about Stay itself gets its straight answer at once (no model, no delay, nothing invented)
  const about = image ? null : answerAboutStay(lastUser);
  if (about) return createDeterministicSseResponse({ text: about });

  // a question about the screen with nothing shared: say so, never guess what might be on it
  const recent = clientMessages.slice(-5, -1).map((m) => m.content || '');
  const intent = classifyIntent(lastUser, { hasVisualSource: Boolean(image), hasHistory: clientMessages.length > 1, recent });
  if (intent === 'screen_question' && !image) return createDeterministicSseResponse({ text: NOTHING_SHOWN });
  // asked to open or close something outside Stay: the straight answer, and the one thing Stay can do about it (no model, no invented success)
  if (intent === 'unsupported_action' && !image) {
    const said = unsupportedActionAnswer(lastUser, recent);
    if (said) return createDeterministicSseResponse({ text: said });
  }

  const openers = recentOpeners(clientMessages.filter((m) => m.role === 'assistant').map((m) => m.content || ''));
  const serverSystemPrompt = buildServerVoiceSystemPrompt(context, intent, { overloaded: isOverloaded(lastUser), recentOpeners: openers });
  // a turn with a picture: the vision model looks at it, no app tools, and the picture goes nowhere else
  const outboundMessages = [
    { role: 'system' as const, content: image ? `${serverSystemPrompt}
${VISION_SYSTEM}` : serverSystemPrompt },
    ...(image ? withImage(clientMessages, image) : clientMessages),
  ];

  const tools =
    withTools === false || image
      ? undefined
      : [
          {
            type: 'function',
            function: {
              name: APP_TOOL.name,
              description: APP_TOOL.description,
              // a timer is offered to the model only when the person asked for one or said yes to Stay's offer of one
              parameters: mayStartTimer(lastUser, recent) ? APP_TOOL.parameters : withoutTimer(APP_TOOL.parameters),
            },
          },
        ];
  const r = await openLlmStream(req, {
    messages: outboundMessages,
    tools,
    maxTokens: image ? 140 : 110, // room for 2 to 4 spoken sentences; the first sentence still streams to the voice at once
    temperature: image ? 0.6 : 0.85, // varied wording, so replies do not sound templated
    serverModel: image ? process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b' : process.env.GROQ_VOICE_MODEL || 'openai/gpt-oss-120b',
    timeoutMs: image ? 12_000 : 6000,
  });
  const hdr = llmHeaders({
    ok: Boolean(r.res),
    text: '',
    source: r.source,
    error: r.error,
    userKeyError: r.userKeyError,
  });
  if (!r.res) {
    // The model failed. Say so. The only thing that still works without a model is a tool the person plainly asked for
    // (a timer, a parked thought); everything else gets the honest message, never an invented reply.
    console.warn('[stay] model_failed', { intent, vision: Boolean(image), source: r.source, error: r.error ?? null });
    if (!image) {
      const tool = resolveDeterministicVoice(lastUser).tool;
      if (tool) return createDeterministicSseResponse({ tool });
    }
    const message = honestFailureMessage(failureKindFromError(r.error, Boolean(image)));
    return attachGuardHeaders(NextResponse.json({ error: r.error || 'unavailable', message }, { status: 503, headers: hdr }), guard);
  }
  // a reply that came from looking at a picture is read in full and checked before anyone sees or hears it
  if (image) {
    const text = await readSseText(r.res);
    const verdict = visionReplyVerdict(text);
    if (verdict !== 'ok') return attachGuardHeaders(NextResponse.json({ safety: verdict }), guard);
    return createDeterministicSseResponse({ text });
  }
  const stream = createResilientStream(r.res.body as ReadableStream<Uint8Array>, lastUser);
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(guard.setCookieHeader ? { 'Set-Cookie': guard.setCookieHeader } : {}),
      ...(r.timing ? { 'Server-Timing': r.timing } : {}),
      ...hdr,
    },
  });
}
