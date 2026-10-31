import { describe, it, expect } from 'vitest';
import {
  STAY_SPECIALIST_AGENTS,
  delegateA2ATask,
} from '@/lib/agents/a2aOrchestrator';

describe('a2aOrchestrator (Agent-to-Agent Protocol v1.0)', () => {
  it('exposes compliant agent cards for all specialists', () => {
    expect(STAY_SPECIALIST_AGENTS.executive_decomposer.protocol).toBe('a2a/1.0');
    expect(STAY_SPECIALIST_AGENTS.somatic_grounder.capabilities).toContain('54321_grounding');
    expect(STAY_SPECIALIST_AGENTS.crisis_sentinel.capabilities).toContain('crisis_detection');
  });

  it('delegates to crisis_sentinel and catches distress signal', async () => {
    const res = await delegateA2ATask('crisis_sentinel', 'I want to kill myself');
    expect(res.jsonrpc).toBe('2.0');
    expect(res.result?.output).toEqual(
      expect.objectContaining({ safe: false, flag: 'crisis' })
    );
  });

  it('delegates task decomposition to executive_decomposer', async () => {
    const res = await delegateA2ATask('executive_decomposer', 'File my 2024 tax return');
    expect(res.jsonrpc).toBe('2.0');
    expect(res.result?.agentId).toBe('agent:stay:executive-decomposer');
    expect(res.result?.output).toEqual(
      expect.objectContaining({ estimatedEffortMinutes: 2 })
    );
  });
});
