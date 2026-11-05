import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';
import { APP_TOOL, buildServerVoiceSystemPrompt } from '@/lib/voice/agentTool';
import { carriesAnswer } from '@/lib/conversation/sse';
import { isOverloaded } from '@/lib/conversation/overload';
import { isPersistentLowMood } from '@/lib/conversation/lowMood';
import { mayChangeLook, mayStartTimer, recentOpeners, unsupportedActionAnswer } from '@/lib/conversation/capabilities';
import { GATED_ACTIONS, mayDoAction } from '@/lib/conversation/actionGates';
import { repairToolCall } from '@/lib/voice/repairToolCall';
import { llmHeaders } from '@/lib/llm/provider';
import { openLlmStream } from '@/lib/llm/stream';
import { resolveDeterministicVoice, createDeterministicSseResponse } from '@/lib/voice/deterministicVoiceFallback';
import { attachGuardHeaders, guardPaidRoute, readBoundedJson } from '@/lib/security/apiGuard';
import { answerAboutStay } from '@/lib/voice/aboutStay';
import { classifyIntent } from '@/lib/conversation/intent';
import { NOTHING_SHOWN, honestFailureMessage, failureKindFromError } from '@/lib/conversation/response';
import { readSseText, visionReplyVerdict } from '@/lib/conversation/visionGate';
import { MAX_IMAGE_CHARS, VISION_SYSTEM, isImageDataUrl, withImage } from '@/lib/vision/image';
import { fitHistory } from '@/lib/voice/historyBudget';

/** The app tool's parameters with some actions taken out of its list of actions. */
function withoutActions(parameters: typeof APP_TOOL.parameters, removed: readonly string[]) {
  return {
    ...parameters,
    properties: { ...parameters.properties, action: { ...parameters.properties.action, enum: parameters.properties.action.enum.filter((a) => !removed.includes(a)) } },
  };
}

const MAX_HISTORY_TURNS = 20;
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
    /** what Stay learned about this person and their memory line, from their device (data, clipped again when used) */
    personal: z.string().max(600).optional(),
    /** up to three lines from the person's own notes that match this turn (found on their device) */
    recall: z.array(z.string().max(200)).max(3).optional(),
    /** one sentence built on the device from the person's own logged blocks; used as the check-in of a task reply */
    offer: z.string().max(200).optional(),
    /** the hour on the person's own clock (0 to 23), so a reply at 2 a.m. can know it is the middle of the night */
    localHour: z.number().int().min(0).max(23).optional(),
  })
  .optional();

const BodySchema = z.object({
  messages: z.array(ClientMessageSchema).min(1).max(MAX_HISTORY_TURNS),
  withTools: z.boolean().optional(),
  context: ContextSchema,
  /** One picture to look at this turn (a screen or camera frame, or a file): a small JPEG/PNG/WebP data URL. Never stored. */
  image: z.string().max(MAX_IMAGE_CHARS).optional(),
  /** A turn the app starts (a timer ending): what Stay is to say. The person said nothing this turn, so their last words are not what it answers. */
  instruction: z.string().max(400).optional(),
});

/** Warm-up: the voice session calls this when it starts so the first real turn does not pay for a cold function. */
export async function GET() {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

/** The `failed_generation` text of a provider error, unescaped, or undefined. */
function failedGenerationOf(buffered: string): string | undefined {
  const m = /"failed_generation":\s*("(?:[^"\\]|\\.)*")/.exec(buffered);
  if (!m) return undefined;
  try {
    return JSON.parse(m[1]) as string;
  } catch {
    return undefined;
  }
}

/**
 * Streams the model's reply to the app. If it ends with no answer (an empty stream, or the model's own error such as a malformed tool
 * call: the live film run, 4 Nov 2026, "Show my report" got "I could not reach my thinking service"), a malformed call that is clear is
 * repaired, else `retry` asks the next model once; only when that also gives nothing does the person hear the honest message.
 * Never an invented reply.
 */
function createResilientStream(
  incoming: ReadableStream<Uint8Array>,
  retry?: () => Promise<ReadableStream<Uint8Array> | null>,
  repair?: (failedGeneration: string) => string | null,
): ReadableStream<Uint8Array> {
  const reader = incoming.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let emittedMeaningfulChunk = false;
  let buffered = '';
  let sseTail = ''; // the last, possibly unfinished, line of the stream

  const failureChunk = (kind: 'unavailable' | 'timeout') =>
    encoder.encode(
      `data: ${JSON.stringify({
        id: 'chatcmpl-det-fallback',
        object: 'chat.completion.chunk',
        choices: [{ index: 0, delta: { role: 'assistant', content: honestFailureMessage(kind) } }],
      })}\n\ndata: [DONE]\n\n`,
    );

  /** Nothing usable came from the first answer: try the next model once, else say so. */
  async function recover(controller: ReadableStreamDefaultController<Uint8Array>, kind: 'unavailable' | 'timeout', why: string, failed?: string) {
    console.warn('[stay] ' + why + (failed ? ' ' + failed.replace(/\s+/g, ' ').slice(0, 200) : ''));
    // the model wrote a tool call the provider refused: if what it meant is clear, make that call
    const args = failed && repair ? repair(failed) : null;
    if (args) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            id: 'chatcmpl-repaired-call',
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { role: 'assistant', content: null, tool_calls: [{ index: 0, id: 'call_repaired', type: 'function', function: { name: 'app', arguments: args } }] } }],
          })}

data: [DONE]

`,
        ),
      );
      emittedMeaningfulChunk = true;
      return;
    }
    let again: ReadableStream<Uint8Array> | null = null;
    try {
      again = retry ? await retry() : null;
    } catch {
      again = null;
    }
    if (again) {
      const chunks: Uint8Array[] = [];
      let text = '';
      try {
        const r2 = again.getReader();
        for (;;) {
          const { done, value } = await r2.read();
          if (done) break;
          chunks.push(value);
          text += decoder.decode(value, { stream: true });
        }
      } catch {
        // the second answer broke too: handled below
      }
      if (carriesAnswer(text.split('\n')) && !/event: error|tool_use_failed|invalid_request_error/.test(text)) {
        for (const c of chunks) controller.enqueue(c);
        emittedMeaningfulChunk = true;
        return;
      }
    }
    controller.enqueue(failureChunk(kind));
    emittedMeaningfulChunk = true;
  }

  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (!emittedMeaningfulChunk && carriesAnswer([sseTail])) emittedMeaningfulChunk = true;
            if (!emittedMeaningfulChunk) await recover(controller, 'unavailable', 'empty_model_stream');
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
            if (!emittedMeaningfulChunk) await recover(controller, 'unavailable', 'model_stream_error_in_band', failedGenerationOf(buffered));
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
        if (!emittedMeaningfulChunk) await recover(controller, 'timeout', 'model_stream_error');
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
  const { withTools, context, image, instruction } = parsed.data;
  // a long conversation (or one in a script that takes 3 bytes a letter) loses its oldest turns instead of being refused
  const clientMessages = fitHistory(parsed.data.messages);
  if (image !== undefined && !isImageDataUrl(image)) {
    return attachGuardHeaders(NextResponse.json({ error: 'Bad picture: send a small JPEG, PNG or WebP data URL.' }, { status: 400 }), guard);
  }

  // an app-started turn answers the instruction, not the person's last words (those were already checked, answered and gated on their own turn)
  const lastUser = instruction ? '' : [...clientMessages].reverse().find((m) => m.role === 'user')?.content || '';
  if (detectCrisisSignal(lastUser).triggered) {
    return attachGuardHeaders(NextResponse.json({ safety: 'crisis' }), guard);
  }
  if (detectMedicationAdviceRequest(lastUser).triggered) {
    return attachGuardHeaders(NextResponse.json({ safety: 'medication' }), guard);
  }

  // a question about Stay itself gets its straight answer at once (no model, no delay, nothing invented)
  const about = image || instruction ? null : answerAboutStay(lastUser);
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
  const serverSystemPrompt = buildServerVoiceSystemPrompt(context, intent, { overloaded: isOverloaded(lastUser), recentOpeners: openers, lowMood: isPersistentLowMood(lastUser) });
  // a turn with a picture: the vision model looks at it, no app tools, and the picture goes nowhere else
  const outboundMessages = [
    { role: 'system' as const, content: image ? `${serverSystemPrompt}
${VISION_SYSTEM}` : serverSystemPrompt },
    ...(image ? withImage(clientMessages, image) : clientMessages),
    // a last line from the app, as a user-role line on purpose: with a long history and the person's notes a trailing system line was ignored
    // and the model answered the old topic again (live check, 4 Nov 2026); framed like this it did what it was told, 6 of 6
    ...(instruction ? [{ role: 'user' as const, content: `[Message from the app, not from the person: ${instruction} Reply with only that, nothing else.]` }] : []),
  ];

  const tools =
    withTools === false || image || instruction
      ? undefined
      : [
          {
            type: 'function',
            function: {
              name: APP_TOOL.name,
              description: APP_TOOL.description,
              // a timer is offered to the model only when the person asked for one or said yes to Stay's offer of one; the orb's shape
              // and colour only when the words ask for a different look
              parameters: withoutActions(APP_TOOL.parameters, [...(mayStartTimer(lastUser, recent) ? [] : ['timer_start']), ...(mayChangeLook(lastUser) ? [] : ['shape', 'color']), ...GATED_ACTIONS.filter((a) => !mayDoAction(a, lastUser, recent.at(-1) ?? ''))]),
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
    console.warn('[stay] model_failed', { intent, vision: Boolean(image), source: r.source, error: r.error ?? null, attempts: r.timing ?? null });
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
  // the same turn, once more, on the next model, when the first one ends with nothing to say
  const spare = (process.env.GROQ_FALLBACK_MODELS || process.env.GROQ_FALLBACK_MODEL || 'openai/gpt-oss-20b').split(',')[0].trim();
  const retry = async () => {
    const again = await openLlmStream(req, { messages: outboundMessages, tools, maxTokens: 110, temperature: 0.7, serverModel: spare, timeoutMs: 6000 });
    return again.res?.body ?? null;
  };
  const allowedActions = (tools?.[0]?.function.parameters.properties.action.enum ?? []) as readonly string[];
  const stream = createResilientStream(r.res.body as ReadableStream<Uint8Array>, retry, (failed) => repairToolCall(failed, allowedActions));
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
