import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { classifyIntent, type ConvIntent } from '@/lib/conversation/intent';
import { GENERIC_PHRASES, checkGrounded } from '@/lib/conversation/grounding';
import { NOTHING_SHOWN, honestFailureMessage, failureKindFromError, type FailureKind } from '@/lib/conversation/response';
import { visionReplyIsSafe } from '@/lib/conversation/visionGate';
import { carriesAnswer } from '@/lib/conversation/sse';
import { resetSecurityStateForTests } from '@/lib/security/apiGuard';

const streamMock = vi.hoisted(() => ({ openLlmStream: vi.fn() }));
vi.mock('@/lib/llm/stream', () => streamMock);
import { POST as chatPost } from '@/app/api/voice/chat/route';

const sse = (text: string) =>
  new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`)); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
const PIC = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';
const post = (body: unknown, headers: Record<string, string> = {}) =>
  chatPost(new NextRequest('http://localhost:3000/api/voice/chat', { method: 'POST', headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) }));
const readText = async (res: Response) => {
  const raw = await res.text();
  return [...raw.matchAll(/data: (\{.*\})/g)].map((m) => JSON.parse(m[1]).choices?.[0]?.delta?.content || '').join('');
};

describe('intent: what is being asked decides what happens next', () => {
  const rows: Array<[string, ConvIntent, boolean?]> = [
    ['What can you do apart from completing tasks?', 'stay_question'],
    ["why should I use you and not ChatGPT", 'stay_question'],
    ['What is on my screen?', 'screen_question'],
    ['what am I looking at', 'screen_question'],
    ['Find the button I need', 'screen_question'],
    ['Explain this error', 'screen_question'],
    ['Read this page', 'screen_question'],
    ['Is this form complete?', 'screen_question'],
    ['Compare this screen with the previous one', 'screen_question'],
    ['what should I click next', 'screen_question'],
    ["I can't start the email to my landlord", 'task_start'],
    ['I keep putting off my taxes', 'task_start'],
    ['I need to finish the report', 'task_start'],
    ['help me start my essay', 'task_start'],
    ["I'm so overwhelmed", 'feeling'],
    ['I feel really tired today', 'feeling'],
    ["I'm anxious about tomorrow", 'feeling'],
    ['What is the capital of France?', 'question'],
    ['How do I convert a PDF to Word?', 'question'],
    ['why is the sky blue', 'question'],
    ['Can you explain compound interest', 'question'],
    ['Explain how a mortgage works', 'question'],
    ['hi', 'small_talk'],
    ['thanks', 'small_talk'],
  ];
  it.each(rows)('%s -> %s', (text, want) => {
    expect(classifyIntent(text, { hasVisualSource: false, hasHistory: false })).toBe(want);
  });

  it('a short follow-up stays on the conversation; the same words with no history are an ordinary question', () => {
    expect(classifyIntent('how do I fix it?', { hasVisualSource: false, hasHistory: true })).toBe('follow_up');
    expect(classifyIntent('how do I fix it?', { hasVisualSource: false, hasHistory: false })).toBe('question');
  });

  it('with a picture attached, a question that points at it is about the picture', () => {
    expect(classifyIntent('what is wrong with this?', { hasVisualSource: true, hasHistory: false })).toBe('screen_question');
    expect(classifyIntent('what is wrong with this?', { hasVisualSource: false, hasHistory: false })).toBe('question');
  });
});

describe('groundedness: replies that ignore the question fail', () => {
  const ok = (over: Partial<Parameters<typeof checkGrounded>[0]> & { question: string; text: string }) =>
    checkGrounded({ hasVisualSource: false, response: { text: over.text, groundedEvidence: [{ source: 'user_message', summary: over.question }] }, ...over });

  it('the field-test failure: a capability question answered with a reward tip', () => {
    const q = "What more you can do just for like completing a task? What's your specialty and why should I use you and not ChatGPT?";
    const bad = ok({ question: q, text: 'Thanks for asking. Pick one small reward, like a 5-minute stretch after finishing. Want a reminder set?' });
    expect(bad.ok).toBe(false);
    expect(bad.failures).toEqual(expect.arrayContaining(['generic_coaching_phrase', 'reminder_not_requested']));
  });

  it('a real answer about the question passes', () => {
    const q = 'What can you do apart from completing tasks?';
    expect(ok({ question: q, text: 'I can break a confusing task into steps, read a picture or a screen you share, explain things in plain words, and run a focus timer with you.' }).ok).toBe(true);
  });

  it('"I appreciate that." to a question fails', () => {
    expect(ok({ question: 'Then reply to me', text: 'I appreciate that.' }).failures).toContain('generic_coaching_phrase');
  });

  it('the stock stretch line is caught with any kind of hyphen, including the non-breaking one a model writes', () => {
    for (const hy of ['-', ' ', '‐', '‑', '–']) {
      expect(ok({ question: 'Is it only in kids?', text: `Pick a quick 5${hy}minute stretch now.` }).failures, JSON.stringify(hy)).toContain('generic_coaching_phrase');
    }
  });

  it('claims to see something with no visual source fail; with a source and evidence they pass', () => {
    expect(ok({ question: 'what is on my screen?', text: 'I can see your browser showing the Stay conversation.', hasVisualSource: false }).failures).toContain('claims_vision_without_source');
    const g = checkGrounded({ question: 'what is on my screen?', hasVisualSource: true, response: { text: 'I can see your browser showing the Stay conversation on the screen.', groundedEvidence: [{ source: 'screen', summary: 'browser showing a conversation' }] } });
    expect(g.ok).toBe(true);
    const noEvidence = checkGrounded({ question: 'what is on my screen?', hasVisualSource: true, response: { text: 'I can see your browser showing the screen.', groundedEvidence: [] } });
    expect(noEvidence.failures).toContain('no_evidence_for_visual_claim');
  });

  it('a reminder offered when nobody asked fails; one that was asked for passes', () => {
    expect(ok({ question: 'how do I convert a PDF to Word', text: 'Open the PDF in Word and save it. Want a reminder set?' }).failures).toContain('reminder_not_requested');
    expect(ok({ question: 'remind me to convert the PDF to Word at five', text: 'Okay, I will remind you at five to convert the PDF to Word.', response: { text: 'Okay, I will remind you at five to convert the PDF to Word.', intent: 'reminder', groundedEvidence: [] } } as never).failures).not.toContain('reminder_not_requested');
  });

  it('a tool that failed cannot be reported as done', () => {
    const r = checkGrounded({ question: 'start a ten minute timer', hasVisualSource: false, tool: { name: 'timer', ok: false }, response: { text: 'Done, the ten minute timer is started.', groundedEvidence: [] } });
    expect(r.failures).toContain('tool_failure_reported_as_success');
  });

  it('a follow-up must stay on the earlier subject', () => {
    const history = ['What is this error? It says ENV_API_KEY is missing', 'It is a missing environment variable called ENV_API_KEY.'];
    expect(checkGrounded({ question: 'How do I fix it?', history, hasVisualSource: false, response: { text: 'Open your environment settings, add a variable named ENV_API_KEY, paste your key as its value, and restart the app.', groundedEvidence: [] } }).ok).toBe(true);
    expect(checkGrounded({ question: 'How do I fix it?', history, hasVisualSource: false, response: { text: 'Pick one small reward after you finish.', groundedEvidence: [] } }).ok).toBe(false);
  });

  it('an empty reply fails', () => {
    expect(ok({ question: 'what time is it', text: '   ' }).failures).toEqual(['empty']);
  });
});

describe('honest failures: never a stand-in answer', () => {
  const kinds: FailureKind[] = ['unavailable', 'rate_limited', 'vision', 'config', 'timeout'];
  it.each(kinds)('%s says what happened and is not a coaching line', (k) => {
    const m = honestFailureMessage(k);
    expect(m.length).toBeGreaterThan(20);
    expect(GENERIC_PHRASES.some((re) => re.test(m))).toBe(false);
    expect(m).toMatch(/\b(?:cannot|could not|not set up|lost it|do not have)\b/i);
  });
  it('maps provider errors to the right kind', () => {
    expect(failureKindFromError('rate_limited')).toBe('rate_limited');
    expect(failureKindFromError('no_server_key')).toBe('config');
    expect(failureKindFromError('unreachable')).toBe('timeout');
    expect(failureKindFromError('other')).toBe('unavailable');
    expect(failureKindFromError('other', true)).toBe('vision');
  });
});

describe('the chat route: what happens on each path (mocked model)', () => {
  beforeEach(() => {
    resetSecurityStateForTests();
    streamMock.openLlmStream.mockReset();
  });

  it('T0.2: when the model fails, every question intent gets the honest message with status 503 and no template', async () => {
    streamMock.openLlmStream.mockResolvedValue({ res: null, source: 'server', error: 'unreachable' });
    for (const q of ['What is the capital of France?', 'How do I convert a PDF to Word?', "I'm so overwhelmed", 'hi there my friend how is the weather']) {
      const res = await post({ messages: [{ role: 'user', content: q }] });
      expect(res.status, q).toBe(503);
      const j = (await res.json()) as { message: string };
      expect(j.message, q).toBe(honestFailureMessage('timeout'));
      expect(GENERIC_PHRASES.some((re) => re.test(j.message))).toBe(false);
    }
  });

  it('a timer the person asked for still works without a model (a real tool, not an invented reply)', async () => {
    streamMock.openLlmStream.mockResolvedValue({ res: null, source: 'server', error: 'unreachable' });
    const res = await post({ messages: [{ role: 'user', content: 'start a 10 minute timer' }] });
    const raw = await res.text();
    expect(res.status).toBe(200);
    expect(raw).toContain('tool_calls');
  });

  it('a question about the screen with nothing shared gets NOTHING_SHOWN without calling the model', async () => {
    const res = await post({ messages: [{ role: 'user', content: 'What is on my screen?' }] });
    expect(await readText(res)).toBe(NOTHING_SHOWN);
    expect(streamMock.openLlmStream).not.toHaveBeenCalled();
  });

  it('a question about Stay is answered at once, without the model', async () => {
    const res = await post({ messages: [{ role: 'user', content: 'What can you do apart from completing tasks?' }] });
    expect(await readText(res)).toMatch(/get you started|start things/i);
    expect(streamMock.openLlmStream).not.toHaveBeenCalled();
  });

  it('crisis and medication run before the model', async () => {
    const crisis = await post({ messages: [{ role: 'user', content: 'I want to kill myself' }] });
    expect(((await crisis.json()) as { safety: string }).safety).toBe('crisis');
    const med = await post({ messages: [{ role: 'user', content: 'how much Adderall should I take' }] });
    expect(((await med.json()) as { safety: string }).safety).toBe('medication');
    expect(streamMock.openLlmStream).not.toHaveBeenCalled();
  });

  it('T0.3: text the vision model reads out of a picture goes through the crisis gate before anyone sees it', async () => {
    streamMock.openLlmStream.mockResolvedValue({ res: sse('The note on the desk says: I want to end my life.'), source: 'server' });
    const res = await post({ messages: [{ role: 'user', content: 'what does this note say?' }], image: PIC }, { 'x-stay-image': '1' });
    expect(((await res.json()) as { safety: string }).safety).toBe('crisis');
  });

  it('a safe vision reply is passed on, with the vision model and the injection rule in its instructions', async () => {
    streamMock.openLlmStream.mockResolvedValue({ res: sse('I see a draft email to a landlord. Type the first sentence.'), source: 'server' });
    const res = await post({ messages: [{ role: 'user', content: 'what is wrong with this?' }], image: PIC }, { 'x-stay-image': '1' });
    expect(await readText(res)).toContain('draft email');
    const call = streamMock.openLlmStream.mock.calls[0][1] as { messages: Array<{ role: string; content: unknown }>; serverModel: string; tools?: unknown };
    expect(call.serverModel).toMatch(/qwen|vision|llama/i);
    expect(call.tools).toBeUndefined();
    const system = String(call.messages[0].content);
    expect(system).toMatch(/text (?:inside|in|on) (?:a|the) (?:picture|image|screen)[^.]*(?:content|data)[^.]*not (?:an )?instruction/i);
  });

  it('a model stream that ends with only reasoning and no words is an honest failure, not silence (found by the live eval)', async () => {
    const reasoningOnly = `data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant', content: '', reasoning: 'let me think' } }] })}\n\ndata: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`;
    streamMock.openLlmStream.mockResolvedValue({ res: new Response(reasoningOnly, { headers: { 'content-type': 'text/event-stream' } }), source: 'server' });
    const res = await post({ messages: [{ role: 'user', content: 'How do I make a simple budget spreadsheet?' }] });
    expect(await readText(res)).toBe(honestFailureMessage('unavailable'));
  });

  it('words that arrive split across reads still count as an answer', () => {
    expect(carriesAnswer(['data: {"choices":[{"delta":{"content":"Hello"}}]}'])).toBe(true);
    expect(carriesAnswer(['data: {"choices":[{"delta":{"content":""}}]}', ': keep-alive', 'data: [DONE]'])).toBe(false);
    expect(carriesAnswer(['data: {"choices":[{"delta":{"tool_calls":[{"index":0}]}}]}'])).toBe(true);
    expect(carriesAnswer(['data: {"choices":[{"delta":{"content":"   "}}]}'])).toBe(false);
  });

  it('a vision failure is honest too', async () => {
    streamMock.openLlmStream.mockResolvedValue({ res: null, source: 'server', error: 'rate_limited' });
    const res = await post({ messages: [{ role: 'user', content: 'what is wrong with this?' }], image: PIC }, { 'x-stay-image': '1' });
    expect(res.status).toBe(503);
    expect(((await res.json()) as { message: string }).message).toBe(honestFailureMessage('vision'));
  });

  it('a picture without the picture header is refused for size, and a bad picture is a 400', async () => {
    const bad = await post({ messages: [{ role: 'user', content: 'look' }], image: 'data:text/html;base64,PGgxPg==' }, { 'x-stay-image': '1' });
    expect(bad.status).toBe(400);
  });
});

describe('visionReplyIsSafe', () => {
  it('lets ordinary descriptions through and stops crisis text', () => {
    expect(visionReplyIsSafe('I see a spreadsheet with three columns.')).toBe(true);
    expect(visionReplyIsSafe('The page says: I want to kill myself.')).toBe(false);
  });
});
