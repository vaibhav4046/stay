import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import questions from '../fixtures/eval/questions.json';
import { classifyIntent, type ConvIntent } from '@/lib/conversation/intent';
import { checkGrounded, hasThreeBeats } from '@/lib/conversation/grounding';
import { answerAboutStay } from '@/lib/voice/aboutStay';
import { resetSecurityStateForTests } from '@/lib/security/apiGuard';

const streamMock = vi.hoisted(() => ({ openLlmStream: vi.fn() }));
vi.mock('@/lib/llm/stream', () => streamMock);
import { POST as chatPost } from '@/app/api/voice/chat/route';

interface Item {
  id: string;
  kind: 'factual' | 'howto' | 'followup' | 'stay' | 'taskstart';
  ask: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  expectIntent: ConvIntent[];
  anyOf?: string[];
  deterministic?: boolean;
  threeBeats?: boolean;
}
const ITEMS = questions as Item[];

const sse = (text: string) =>
  new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`)); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
const post = (messages: unknown[]) =>
  chatPost(new NextRequest('http://localhost:3000/api/voice/chat', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ messages }) }));

beforeEach(() => {
  resetSecurityStateForTests();
  streamMock.openLlmStream.mockReset();
  streamMock.openLlmStream.mockImplementation(async () => ({ res: sse('Okay.'), source: 'server' }));
});

describe('T0.1 eval set (offline, mocked-model): every prompt is routed correctly', () => {
  it('has the agreed shape: 60 prompts, 20 factual, 10 how-to, 10 follow-ups, 10 about Stay, 10 task starts', () => {
    const count = (k: Item['kind']) => ITEMS.filter((i) => i.kind === k).length;
    expect(ITEMS).toHaveLength(60);
    expect([count('factual'), count('howto'), count('followup'), count('stay'), count('taskstart')]).toEqual([20, 10, 10, 10, 10]);
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(60);
  });

  it.each(ITEMS.map((i) => [i.id, i] as const))('%s is classified as an expected intent', (_id, item) => {
    const got = classifyIntent(item.ask, { hasVisualSource: false, hasHistory: Boolean(item.history) });
    expect(item.expectIntent, `${item.ask} -> ${got}`).toContain(got);
  });

  it.each(ITEMS.filter((i) => i.kind === 'stay').map((i) => [i.id, i] as const))('%s is answered about Stay at once, grounded, without the model', async (_id, item) => {
    const direct = answerAboutStay(item.ask);
    expect(direct, item.ask).toBeTruthy();
    expect(checkGrounded({ question: item.ask, hasVisualSource: false, response: { text: direct as string, intent: 'stay_question', groundedEvidence: [] } }).ok, item.ask).toBe(true);
    const res = await post([{ role: 'user', content: item.ask }]);
    expect(await res.text()).toContain(direct as string);
    expect(streamMock.openLlmStream).not.toHaveBeenCalled();
  });

  it.each(ITEMS.filter((i) => i.kind !== 'stay').map((i) => [i.id, i] as const))('%s goes to the model once, with its history and the question last', async (_id, item) => {
    const messages = [...(item.history ?? []), { role: 'user' as const, content: item.ask }];
    const res = await post(messages);
    expect(res.status).toBe(200);
    expect(streamMock.openLlmStream).toHaveBeenCalledTimes(1);
    const sent = (streamMock.openLlmStream.mock.calls[0][1] as { messages: Array<{ role: string; content: string }> }).messages;
    expect(sent[0].role).toBe('system');
    expect(sent.slice(1).map((m) => m.content)).toEqual(messages.map((m) => m.content));
    if (item.kind === 'taskstart') expect(sent[0].content).toMatch(/acknowledg/i);
  });
});

describe('the three-beats check used by the live eval', () => {
  it('accepts a short acknowledgement, a tiny step and a question', () => {
    expect(hasThreeBeats("That email is heavy. Open a new message and type the word Hi. Want to write the first line together?")).toBe(true);
  });
  it('rejects a lecture, a list and a reply with no check-in', () => {
    expect(hasThreeBeats('Here is a plan. ' + 'Do the thing and then do more things. '.repeat(10))).toBe(false);
    expect(hasThreeBeats('1. Open it.\n2. Type Hi.\n3. Send?')).toBe(false);
    expect(hasThreeBeats('Okay. Open a new email.')).toBe(false);
  });
});
