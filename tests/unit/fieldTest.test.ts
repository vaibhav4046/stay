import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mayStartTimer, minutesIn, recentOpeners, unsupportedActionAnswer } from '@/lib/conversation/capabilities';
import { classifyIntent } from '@/lib/conversation/intent';
import { answerAboutStay } from '@/lib/voice/aboutStay';
import { buildServerVoiceSystemPrompt } from '@/lib/voice/agentTool';
import { resetSecurityStateForTests } from '@/lib/security/apiGuard';

const streamMock = vi.hoisted(() => ({ openLlmStream: vi.fn() }));
vi.mock('@/lib/llm/stream', () => streamMock);
import { POST as chatPost } from '@/app/api/voice/chat/route';

/**
 * The 2 Nov 2026 field test (a screen recording of a real call): "open Netflix for five minutes" started a timer, "close it now" did
 * nothing true, "why are you picking this voice" got an invented reason, "what's your main differentiator" got a generic line, anger got
 * "I hear your frustration", and the same warm opener came back turn after turn. Each of those is a test here.
 */
const sse = (text: string) =>
  new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`)); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
const post = (messages: unknown[]) =>
  chatPost(new NextRequest('http://localhost:3000/api/voice/chat', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ messages, withTools: true }) }));
const textOf = async (res: Response) => [...(await res.text()).matchAll(/data: (\{.*\})/g)].map((m) => JSON.parse(m[1]).choices?.[0]?.delta?.content || '').join('');

beforeEach(() => {
  resetSecurityStateForTests();
  streamMock.openLlmStream.mockReset();
  streamMock.openLlmStream.mockImplementation(async () => ({ res: sse('Okay.'), source: 'server' }));
});

describe('Stay is straight about what it cannot do', () => {
  it.each([
    'Open Netflix for five minutes.',
    'open youtube',
    'Can you launch Spotify?',
    'Take me to Instagram.',
    'pull up my email in Chrome',
    'Close the tab.',
    'shut Netflix',
    'close the browser window',
  ])('%s -> says it cannot, and offers what it can do', (q) => {
    const a = unsupportedActionAnswer(q);
    expect(a, q).toBeTruthy();
    expect(a).toMatch(/can't/);
    expect(a).toMatch(/timer/i);
  });

  it('"close it now" after Netflix is tied to what it meant, and is not guessed at with no context', () => {
    expect(unsupportedActionAnswer('Close it now.', ['Open Netflix for five minutes.', 'I can not open other apps.'])).toMatch(/can't close tabs/);
    expect(unsupportedActionAnswer('Close it now.', [])).toBeNull();
    expect(unsupportedActionAnswer('Close it now.', ['What is the capital of France?', 'Paris.'])).toBeNull();
  });

  it('keeps the minutes the person said, in the offer', () => {
    expect(unsupportedActionAnswer('Open Netflix for five minutes.')).toContain('5-minute timer');
    expect(unsupportedActionAnswer('open youtube for 10 min')).toContain('10-minute timer');
    expect(minutesIn('twenty minutes')).toBe(20);
    expect(minutesIn('I have no time')).toBeNull();
  });

  it('does not catch ordinary things that only sound alike', () => {
    for (const q of ['I can\'t start the email to my landlord.', 'open my history', 'open the memory panel', 'What is the best browser for privacy?', 'I need to close the deal today', 'start a timer']) {
      expect(unsupportedActionAnswer(q), q).toBeNull();
    }
  });

  it('routes as its own intent, and answers without the model', async () => {
    expect(classifyIntent('Open Netflix for five minutes.', { hasVisualSource: false, hasHistory: false })).toBe('unsupported_action');
    const res = await post([{ role: 'user', content: 'Open Netflix for five minutes.' }]);
    expect(await textOf(res)).toMatch(/can't open other apps/);
    expect(streamMock.openLlmStream).not.toHaveBeenCalled();
  });

  it('the follow-up "close it now" is answered too, with the history', async () => {
    const res = await post([
      { role: 'user', content: 'Open Netflix for five minutes.' },
      { role: 'assistant', content: "I can't open other apps or sites for you. Want me to start a 5-minute timer?" },
      { role: 'user', content: 'Close it now.' },
    ]);
    expect(await textOf(res)).toMatch(/can't close tabs/);
    expect(streamMock.openLlmStream).not.toHaveBeenCalled();
  });
});

describe('a timer starts only when asked for', () => {
  it.each(['Set a five minute timer.', 'start a timer', 'give me a 10 minute block', 'Start 15 minutes', 'time me for twenty minutes', 'pomodoro please'])('yes: %s', (q) => {
    expect(mayStartTimer(q), q).toBe(true);
  });

  it.each(['I need to reply to my landlord.', 'Open Netflix', "What's your main differentiator?", 'I am so angry', 'Hi', 'I have ten minutes free today'])('no: %s', (q) => {
    expect(mayStartTimer(q), q).toBe(false);
  });

  it('"yes" counts only when Stay\'s last words offered a timer', () => {
    expect(mayStartTimer('Yes.', ['Want me to start a 5-minute timer?'])).toBe(true);
    expect(mayStartTimer('Yes.', ['What is the capital of France?'])).toBe(false);
    expect(mayStartTimer('Yes.', [])).toBe(false);
  });

  it('the model is not even offered the timer action unless it was asked for', async () => {
    await post([{ role: 'user', content: 'I keep avoiding my taxes.' }]);
    const without = (streamMock.openLlmStream.mock.calls[0][1] as { tools: Array<{ function: { parameters: { properties: { action: { enum: string[] } } } } }> }).tools[0].function.parameters.properties.action.enum;
    expect(without).not.toContain('timer_start');
    expect(without).toContain('park');

    streamMock.openLlmStream.mockClear();
    await post([{ role: 'user', content: 'Set a five minute timer.' }]);
    const withTimer = (streamMock.openLlmStream.mock.calls[0][1] as { tools: Array<{ function: { parameters: { properties: { action: { enum: string[] } } } } }> }).tools[0].function.parameters.properties.action.enum;
    expect(withTimer).toContain('timer_start');
  });
});

describe('the questions about Stay get a real answer', () => {
  it.each([
    "What's your main differentiator?",
    'What is your speciality, and why should I use you?',
    'What makes you different?',
    'why should I use you and not ChatGPT or Claude',
    'What is special about you?',
  ])('%s', (q) => {
    const a = answerAboutStay(q) as string;
    expect(a, q).toBeTruthy();
    expect(a).toMatch(/stuck|starting/i);
    expect(a).toMatch(/pauses/i);
    expect(a).not.toMatch(/better than|smarter than|best|#1/i);
    expect(a).not.toMatch(/AGI|replace/);
  });

  it.each(['Why are you picking this voice?', 'why did you choose that voice', 'Who picked this voice?', "What's this voice?"])('%s -> it is the selected voice, and it can be changed', (q) => {
    const a = answerAboutStay(q) as string;
    expect(a, q).toMatch(/selected/);
    expect(a).toMatch(/change/);
  });
});

describe('anger gets a short plain reply, not "I hear your frustration"', () => {
  it.each(["What the fuck? You're not listening to me.", 'This is so broken.', 'You are useless', 'nothing works', 'I am so angry'])('%s is frustrated', (q) => {
    expect(classifyIntent(q, { hasVisualSource: false, hasHistory: false })).toBe('frustrated');
  });

  it('a question about something broken is a question, not a complaint', () => {
    expect(classifyIntent('Why is my wifi broken?', { hasVisualSource: false, hasHistory: false })).toBe('question');
    expect(classifyIntent('How do I fix my broken printer?', { hasVisualSource: false, hasHistory: false })).toBe('question');
  });

  it('the prompt tells the model to own it in one sentence and ask the one thing', () => {
    const p = buildServerVoiceSystemPrompt(undefined, 'frustrated');
    expect(p).toMatch(/Say so in one short plain sentence that owns it/);
    expect(p).toMatch(/ONE thing they want right now/);
    expect(p).not.toMatch(/3 short beats/);
  });

  it('every prompt bans the canned lines, the made-up reasons, and claiming what it did not do', () => {
    for (const intent of ['task_start', 'feeling', 'frustrated', 'question', 'follow_up', 'other']) {
      const p = buildServerVoiceSystemPrompt(undefined, intent);
      expect(p, intent).toMatch(/Never say "I hear you", "I hear that", "I'm right here with you"/);
      expect(p, intent).toMatch(/cannot open or close other apps/);
      expect(p, intent).toMatch(/Start a timer only if the person asked/);
    }
  });
});

describe('the same opening words do not come back turn after turn', () => {
  it('collects the first words of the last replies', () => {
    expect(recentOpeners(["I'm right here with you. Tell me.", "I'm right here with you again.", 'Fair. That did not work.'])).toEqual(["I'm right here with you", "I'm right here with you", 'Fair. That did not work']);
    expect(recentOpeners(['Okay.', ''])).toEqual([]); // one word is not an opener worth avoiding
  });

  it('puts them in the prompt, so the model is told not to repeat them', () => {
    const p = buildServerVoiceSystemPrompt(undefined, 'question', { recentOpeners: ["I'm right here with you"] });
    expect(p).toContain('Do not begin this reply with the same words as your last replies ("I\'m right here with you")');
    expect(buildServerVoiceSystemPrompt(undefined, 'question')).not.toContain('Do not begin this reply');
  });

  it('through the route: the previous replies reach the model as words to avoid', async () => {
    await post([
      { role: 'user', content: 'I am stuck' },
      { role: 'assistant', content: "I'm right here with you. What is it?" },
      { role: 'user', content: 'the email' },
    ]);
    const system = String((streamMock.openLlmStream.mock.calls[0][1] as { messages: Array<{ content: unknown }> }).messages[0].content);
    expect(system).toContain("Do not begin this reply with the same words as your last replies (\"I'm right here with you\")");
  });
});
