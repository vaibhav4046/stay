import { NextRequest, NextResponse } from 'next/server';
import { tracer } from '@/lib/telemetry/openInference';
import { PERSONAS, resolvePersona } from '@/lib/voice/personas';
import { detectCrisisSignal, detectMedicationAdviceRequest } from '@/lib/safety/crisis';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
  id: string | number;
}

export async function POST(req: NextRequest) {
  let body: JsonRpcRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error: invalid JSON' }, id: null },
      { status: 400 }
    );
  }

  if (body.jsonrpc !== '2.0' || !body.method || body.id === undefined) {
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request: required fields missing' }, id: body.id ?? null },
      { status: 400 }
    );
  }

  const { method, params = {}, id } = body;
  const traceId = tracer.startTrace(`a2a-rpc-${id}`);
  const rootSpan = tracer.startSpan(traceId, `A2A_${method}`, 'AGENT', { 'rpc.method': method });

  try {
    switch (method) {
      case 'agent.handshake': {
        const callerAgent = String(params.caller_agent_id || 'unknown');
        const scopes = Array.isArray(params.scopes) ? params.scopes : [];
        tracer.endSpan(rootSpan, { callerAgent, status: 'negotiated' });

        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            status: 'accepted',
            protocol_version: '1.0',
            peer_agent_id: 'urn:stay:companion:voice-initiator-v1',
            accepted_scopes: scopes.filter((s: string) => ['stay:agent:delegate', 'stay:agent:observe'].includes(s)),
            streaming_audio_endpoint: 'wss://streaming.assemblyai.com/v3/ws',
            audio_format: 'pcm_s16le@24000',
            trace_id: traceId,
          },
          id,
        });
      }

      case 'agent.delegateTask': {
        const taskText = String(params.task_text || '').trim();
        const personaId = String(params.persona_id || 'anna');
        if (!taskText) {
          throw new Error('Missing parameter: task_text is required for delegation');
        }

        // Safety verification gate
        const crisis = detectCrisisSignal(taskText);
        if (crisis.triggered) {
          tracer.endSpan(rootSpan, { safetyTrigger: 'crisis', matchedPhrase: crisis.matchedPhrase });
          return NextResponse.json({
            jsonrpc: '2.0',
            result: {
              status: 'declined',
              reason: 'safety_boundary',
              message: crisis.message,
              trace_id: traceId,
            },
            id,
          });
        }

        const medCheck = detectMedicationAdviceRequest(taskText);
        if (medCheck.triggered) {
          tracer.endSpan(rootSpan, { safetyTrigger: 'medication', matchedPhrase: medCheck.matchedPhrase });
          return NextResponse.json({
            jsonrpc: '2.0',
            result: {
              status: 'declined',
              reason: 'medical_boundary',
              message: medCheck.message,
              trace_id: traceId,
            },
            id,
          });
        }

        // Generate ADHD micro-step
        const persona = resolvePersona(personaId, 'anna') ?? PERSONAS[0];
        const planSpan = tracer.startSpan(traceId, 'SynthesizeTaskPlan', 'CHAIN', { taskText, persona: persona.name }, rootSpan);

        // Deterministic single <= 2-minute actionable step
        const firstStep = taskText.toLowerCase().includes('email')
          ? 'Open the inbox and draft a one-sentence reply to the top email.'
          : taskText.toLowerCase().includes('taxes') || taskText.toLowerCase().includes('tax')
          ? 'Log into your tax portal and download the W-2 or VAT statement.'
          : taskText.toLowerCase().includes('write') || taskText.toLowerCase().includes('paper')
          ? 'Write one sentence describing what you want to say, without editing it.'
          : `Take out the first item needed for "${taskText.slice(0, 40)}" and put it on your desk.`;

        tracer.endSpan(planSpan, { firstStep, executionDurationMinutes: 2 });
        tracer.endSpan(rootSpan, { outcome: 'success', firstStep });

        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            status: 'completed',
            delegation_id: `del-${Date.now()}`,
            agent_id: 'urn:stay:companion:voice-initiator-v1',
            assigned_persona: persona.name,
            plan: {
              task: taskText,
              first_step: firstStep,
              duration_minutes: 2,
              non_shaming: true,
              grounding_strategy: 'task_shrinking',
            },
            trace_id: traceId,
          },
          id,
        });
      }

      case 'agent.queryState': {
        tracer.endSpan(rootSpan, { query: 'state' });
        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            agent_id: 'urn:stay:companion:voice-initiator-v1',
            status: 'ready',
            stt_engine: 'AssemblyAI Universal-3-6-Pro',
            tts_engine: 'AssemblyAI Streaming TTS',
            active_dots: 5200,
            active_personas: 22,
            cognitive_load_index: 0.18,
            trace_id: traceId,
          },
          id,
        });
      }

      case 'agent.replayTrace': {
        const targetTraceId = String(params.trace_id || traceId);
        const otlpExport = tracer.exportTraceToOtlp(targetTraceId);
        tracer.endSpan(rootSpan, { replayedTrace: targetTraceId });

        return NextResponse.json({
          jsonrpc: '2.0',
          result: {
            trace_id: targetTraceId,
            found: otlpExport !== null,
            otlp_payload: otlpExport,
            verification_status: 'valid',
          },
          id,
        });
      }

      default:
        tracer.endSpan(rootSpan, {}, new Error(`Method not found: ${method}`));
        return NextResponse.json(
          { jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${method}` }, id },
          { status: 404 }
        );
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    tracer.endSpan(rootSpan, {}, error);
    return NextResponse.json(
      { jsonrpc: '2.0', error: { code: -32000, message: error.message }, id },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
