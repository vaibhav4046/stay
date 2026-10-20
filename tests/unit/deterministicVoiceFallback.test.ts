import { describe, expect, it } from 'vitest';
import { resolveDeterministicVoice, createDeterministicSseResponse } from '@/lib/voice/deterministicVoiceFallback';

describe('resolveDeterministicVoice', () => {
  it('triggers crisis safety gate deterministically', () => {
    const res = resolveDeterministicVoice('I want to kill myself');
    expect(res.safety).toBe('crisis');
  });

  it('triggers medication boundary deterministically', () => {
    const res = resolveDeterministicVoice('Can I drink alcohol with 30mg Adderall?');
    expect(res.safety).toBe('medication');
  });

  it('provides compassionate non-judgmental listening for RSD spirals', () => {
    const res = resolveDeterministicVoice("I'm sobbing on the floor, I missed the deadline and I'm a failure.");
    expect(res.text).toBe('I hear you, that is hard.');
    expect(res.tool).toBeUndefined();
  });

  it('parses timer commands deterministically', () => {
    const res = resolveDeterministicVoice('Start a 10 minute focus block.');
    expect(res.tool).toBeDefined();
    expect(res.tool?.action).toBe('timer_start');
    expect(res.tool?.minutes).toBe(10);
  });

  it('parses parking commands deterministically', () => {
    const res = resolveDeterministicVoice('Park it: call the landlord tomorrow morning.');
    expect(res.tool).toBeDefined();
    expect(res.tool?.action).toBe('park');
    expect(res.tool?.value).toBe('call the landlord tomorrow morning.');
  });

  it('parses next step and finished commands deterministically', () => {
    const res = resolveDeterministicVoice('Finished that. What is next?');
    expect(res.tool).toBeDefined();
    expect(res.tool?.action).toBe('step_next');
  });

  it('parses brain dump commands deterministically', () => {
    const res = resolveDeterministicVoice('Brain dump: taxes, call mom, fix tyre');
    expect(res.tool).toBeDefined();
    expect(res.tool?.action).toBe('dump');
  });

  it('generates a concise micro-step under 14 words with no guilt for ordinary tasks', () => {
    const res = resolveDeterministicVoice('I have 40 tabs open and feel overwhelmed.');
    expect(res.text).toBeDefined();
    const words = res.text!.split(/\s+/).length;
    expect(words).toBeLessThan(14);
    expect(res.text).not.toMatch(/overdue|lazy|failed|behind/i);
  });

  it('creates valid SSE stream response', async () => {
    const res = resolveDeterministicVoice('Pick up where we left off.');
    const response = createDeterministicSseResponse(res);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const text = await response.text();
    expect(text).toContain('data: ');
    expect(text).toContain('[DONE]');
  });
});
