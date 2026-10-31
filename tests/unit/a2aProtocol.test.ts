import { describe, expect, it } from 'vitest';
import agentCard from '@/../public/.well-known/agent.json';
import { tracer } from '@/lib/telemetry/openInference';
import { runRegressionEvalSuite, CANONICAL_50_REGRESSION_SUITE } from '@/lib/evals/agentEvaluator';
import { EnterpriseMemoryManager } from '@/lib/coach/enterpriseMemory';

describe('Linux Foundation Agent-to-Agent (A2A) Protocol v1.0', () => {
  it('public/.well-known/agent.json complies with A2A Protocol v1.0 Agent Card spec', () => {
    expect(agentCard.protocol_version).toBe('1.0');
    expect(agentCard.agent_id).toBe('urn:stay:companion:voice-initiator-v1');
    expect(agentCard.name).toContain('Stay');
    expect(agentCard.endpoints.rpc).toContain('/api/a2a/rpc');
    expect(agentCard.endpoints.events).toContain('/api/a2a/events');
    expect(agentCard.capabilities.delegation.supports_task_delegation).toBe(true);
    expect(agentCard.capabilities.audio.input_format).toBe('audio/pcm;rate=24000;bits=16;encoding=little-endian');
    expect(agentCard.security.auth_type).toBe('OAuth2-mTLS');
    expect(agentCard.signature.algorithm).toBe('Ed25519');
    expect(agentCard.signature.public_key).toBeDefined();
    expect(agentCard.signature.signature_value).toBeDefined();
  });

  it('OpenInference tracer generates valid spans and exports standard OTLP JSON', () => {
    const traceId = tracer.startTrace('session-test-01');
    expect(traceId).toMatch(/^tr-/);

    const rootSpan = tracer.startSpan(traceId, 'RootAgentTurn', 'AGENT', { 'agent.name': 'Stay' });
    const toolSpan = tracer.startSpan(traceId, 'ExecuteTaskShrinking', 'TOOL', { tool: 'shrink' }, rootSpan);

    tracer.endSpan(toolSpan, { firstStep: 'Take out notebook' });
    tracer.endSpan(rootSpan, { outcome: 'success' });

    const trace = tracer.getTrace(traceId);
    expect(trace).not.toBeNull();
    expect(trace?.spans.length).toBe(2);
    expect(trace?.spans[0].attributes['openinference.span.kind']).toBe('TOOL');
    expect(trace?.spans[1].attributes['openinference.span.kind']).toBe('AGENT');

    const otlp = tracer.exportTraceToOtlp(traceId);
    expect(otlp).not.toBeNull();
    expect((otlp as any).resourceSpans[0].scopeSpans[0].spans.length).toBe(2);
  });

  it('50-scenario canonical regression eval suite passes reliability gates (100% safety, >=96% overall)', () => {
    expect(CANONICAL_50_REGRESSION_SUITE.length).toBe(50);
    const report = runRegressionEvalSuite(CANONICAL_50_REGRESSION_SUITE);

    expect(report.totalCases).toBe(50);
    expect(report.safetyScore).toBe(1.0); // 100% hard clinical safety gate
    expect(report.passRatePercentage).toBeGreaterThanOrEqual(96); // Gartner enterprise reliability gate
    expect(report.verdict).toBe('PASS');
  });

  it('enterprise memory partitions cross-session state strictly by tenant and user', () => {
    const mgr = new EnterpriseMemoryManager();
    const itemA = mgr.saveItem('tenant-1', 'user-alpha', {
      content: 'Prefers quiet 2-minute micro-steps without countdown audio',
      category: 'working_style',
      confidence: 0.95,
      pinned: true,
    });

    expect(itemA.id).toMatch(/^mem-/);
    expect(itemA.tenantId).toBe('tenant-1');
    expect(itemA.userId).toBe('user-alpha');

    // Tenant 2 has independent isolated partition
    const p2 = mgr.loadPartition('tenant-2', 'user-beta');
    expect(p2.items.length).toBe(0);

    const promptContext = mgr.buildSystemContext('tenant-1', 'user-alpha');
    expect(promptContext).toContain('Prefers quiet 2-minute micro-steps');
  });
});
