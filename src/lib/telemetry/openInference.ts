/**
 * OpenInference & OpenTelemetry Observability Bridge (src/lib/telemetry/openInference.ts)
 * Conforms to OpenTelemetry Semantic Conventions for GenAI and OpenInference standards.
 * Provides verifiable evaluation traces for agent delegation, tool selection, and latency gates.
 */

export type OpenInferenceSpanKind = 'AGENT' | 'CHAIN' | 'LLM' | 'TOOL';

export interface OpenInferenceSpan {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: OpenInferenceSpanKind;
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  attributes: Record<string, unknown>;
  status: {
    code: 'OK' | 'ERROR';
    message?: string;
  };
}

export interface TraceRecord {
  traceId: string;
  spans: OpenInferenceSpan[];
  metadata: {
    sessionId: string;
    agentId: string;
    environment: string;
    timestamp: string;
  };
}

class OpenInferenceTracer {
  private traces = new Map<string, TraceRecord>();
  private activeSpans = new Map<string, OpenInferenceSpan>();

  startTrace(sessionId: string): string {
    const traceId = `tr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    this.traces.set(traceId, {
      traceId,
      spans: [],
      metadata: {
        sessionId,
        agentId: 'urn:stay:companion:voice-initiator-v1',
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString(),
      },
    });
    return traceId;
  }

  startSpan(traceId: string, name: string, kind: OpenInferenceSpanKind, attributes: Record<string, unknown> = {}, parentSpanId?: string): string {
    const spanId = `sp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const span: OpenInferenceSpan = {
      id: spanId,
      traceId,
      parentSpanId,
      name,
      kind,
      startTimeMs: Date.now(),
      attributes: {
        'openinference.span.kind': kind,
        ...attributes,
      },
      status: { code: 'OK' },
    };
    this.activeSpans.set(spanId, span);
    return spanId;
  }

  endSpan(spanId: string, outputAttributes: Record<string, unknown> = {}, error?: Error): OpenInferenceSpan | null {
    const span = this.activeSpans.get(spanId);
    if (!span) return null;

    span.endTimeMs = Date.now();
    span.durationMs = span.endTimeMs - span.startTimeMs;
    Object.assign(span.attributes, outputAttributes);

    if (error) {
      span.status = { code: 'ERROR', message: error.message };
      span.attributes['exception.message'] = error.message;
      span.attributes['exception.stack'] = error.stack;
    }

    this.activeSpans.delete(spanId);
    const trace = this.traces.get(span.traceId);
    if (trace) {
      trace.spans.push(span);
    }
    return span;
  }

  getTrace(traceId: string): TraceRecord | null {
    return this.traces.get(traceId) || null;
  }

  exportTraceToOtlp(traceId: string): Record<string, unknown> | null {
    const trace = this.getTrace(traceId);
    if (!trace) return null;

    return {
      resourceSpans: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'stay-voice-agent' } },
              { key: 'telemetry.sdk.name', value: { stringValue: 'openinference-stay' } },
              { key: 'session.id', value: { stringValue: trace.metadata.sessionId } },
            ],
          },
          scopeSpans: [
            {
              scope: { name: 'stay.agent.evaluator', version: '1.0.0' },
              spans: trace.spans.map((s) => ({
                traceId: s.traceId,
                spanId: s.id,
                parentSpanId: s.parentSpanId || '',
                name: s.name,
                kind: s.kind === 'LLM' ? 3 : s.kind === 'TOOL' ? 2 : 1,
                startTimeUnixNano: s.startTimeMs * 1_000_000,
                endTimeUnixNano: (s.endTimeMs || s.startTimeMs) * 1_000_000,
                attributes: Object.entries(s.attributes).map(([k, v]) => ({
                  key: k,
                  value: typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) },
                })),
                status: { code: s.status.code === 'OK' ? 1 : 2 },
              })),
            },
          ],
        },
      ],
    };
  }
}

export const tracer = new OpenInferenceTracer();
