import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { OVERLOAD_INSTRUCTION, isOverloaded } from '@/lib/conversation/overload';
import { buildServerVoiceSystemPrompt } from '@/lib/voice/agentTool';
import { resetSecurityStateForTests } from '@/lib/security/apiGuard';

const streamMock = vi.hoisted(() => ({ openLlmStream: vi.fn() }));
vi.mock('@/lib/llm/stream', () => streamMock);
import { POST as chatPost } from '@/app/api/voice/chat/route';

/** T1.5: overload is judged from the words, never from the voice, and it only makes replies shorter. */
describe('T1.5 overload from words', () => {
  it.each([
    "I'm so overwhelmed",
    'there is just too much to do',
    "I can't think",
    'my brain is fried',
    'brain fog today',
    "I'm drowning in emails",
    'I keep spiralling',
    'I just shut down',
    "I'm frozen",
    'so much to do and so little time',
    "I don't know where to start",
    'I am completely burnt out',
    "I'm paralyzed by this list",
    'everything at once is happening',
  ])('detects: %s', (t) => expect(isOverloaded(t)).toBe(true));

  it.each([
    'What is the capital of France?',
    'Set a ten minute timer',
    'I need to email my landlord',
    'thanks, that helped',
    'how do I convert a PDF to Word',
    'I feel a bit tired',
    'much too hot in here',
    'I have a lot of time today',
  ])('does not flag: %s', (t) => expect(isOverloaded(t)).toBe(false));

  it('the voice is never consulted: only text goes in', () => {
    expect(isOverloaded.length).toBe(1);
  });
});

describe('T1.5 the prompt gets shorter only when asked for', () => {
  it('adds the short-reply instruction for an overloaded person, for every kind of turn', () => {
    for (const intent of ['task_start', 'feeling', 'question', 'follow_up', 'other']) {
      const p = buildServerVoiceSystemPrompt(undefined, intent, { overloaded: true });
      expect(p, intent).toContain(OVERLOAD_INSTRUCTION);
      expect(p.length, intent).toBeLessThan(1850);
    }
  });

  it('leaves the prompt as it was otherwise', () => {
    expect(buildServerVoiceSystemPrompt(undefined, 'question')).not.toContain('overloaded');
    expect(buildServerVoiceSystemPrompt(undefined, 'question', { overloaded: false })).toBe(buildServerVoiceSystemPrompt(undefined, 'question'));
  });

  it('the instruction asks for two sentences at most, ten words each, one idea per sentence', () => {
    expect(OVERLOAD_INSTRUCTION).toMatch(/at most two sentences, one idea each, ten words or fewer per sentence/);
  });
});

describe('T1.5 through the chat route', () => {
  beforeEach(() => {
    resetSecurityStateForTests();
    streamMock.openLlmStream.mockReset();
    streamMock.openLlmStream.mockImplementation(async () => ({
      res: new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Okay.' } }] })}\n\ndata: [DONE]\n\n`, { headers: { 'content-type': 'text/event-stream' } }),
      source: 'server',
    }));
  });
  const system = async (text: string) => {
    await chatPost(new NextRequest('http://localhost:3000/api/voice/chat', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: text }] }) }));
    return String((streamMock.openLlmStream.mock.calls[0][1] as { messages: Array<{ content: unknown }> }).messages[0].content);
  };

  it('"I\'m so overwhelmed" reaches the model with the short-reply instruction', async () => {
    expect(await system("I'm so overwhelmed by my inbox")).toContain(OVERLOAD_INSTRUCTION);
  });

  it('an ordinary question does not', async () => {
    expect(await system('What is the capital of France?')).not.toContain(OVERLOAD_INSTRUCTION);
  });
});
