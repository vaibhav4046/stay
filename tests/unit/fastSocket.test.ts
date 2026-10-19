import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FastSocket, quickConfirmation, soundsUnfinished, takeSpeakable } from '@/lib/voice/fastSocket';

// ---- a scripted AssemblyAI: STT sockets accept audio and are driven by the test; TTS sockets answer Flush with audio ----
class FakeWS {
  static OPEN = 1;
  static instances: FakeWS[] = [];
  static auto = true;
  static coalesce = false; // the server reports two flushes as one FlushDone
  readyState = 0;
  sent: Array<string | Uint8Array> = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  flushes = 0;
  constructor(public url: string) {
    FakeWS.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.push({ type: 'Begin' });
    });
  }
  get isTts() { return this.url.includes('streaming-tts'); }
  push(m: object) { this.onmessage?.({ data: JSON.stringify(m) }); }
  send(d: string | Uint8Array) {
    this.sent.push(d);
    if (typeof d === 'string' && this.isTts) {
      const m = JSON.parse(d) as { type: string };
      if (m.type === 'Flush' && FakeWS.auto) {
        const id = this.flushes++;
        queueMicrotask(() => { this.push({ type: 'Audio', audio: 'AAAA', flush_id: id }); if (!(FakeWS.coalesce && id % 2 === 0)) this.push({ type: 'FlushDone', flush_id: id }); });
      }
      if (m.type === 'Cancel') {
        queueMicrotask(() => this.push({ type: 'Cancelled', audio_duration_seconds: 0 }));
      }
    }
  }
  close() { this.readyState = 3; this.onclose?.(); }
}

const sse = (...events: object[]) => new Response(new ReadableStream({ start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`)); c.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
const text = (t: string) => ({ choices: [{ delta: { content: t } }] });
const tick = (n = 6) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r(null) : setTimeout(f, 0)); f(); });

let events: Array<Record<string, unknown>>;
let fetchMock: ReturnType<typeof vi.fn>;
async function open(opts: { tools?: boolean; greeting?: string; holdMs?: number } = {}) {
  const s = new FastSocket({ sttToken: 'stt', ttsToken: 'tts', holdMs: opts.holdMs ?? 60 });
  events = [];
  s.onmessage = (e) => events.push(JSON.parse(e.data));
  await tick(2);
  s.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You are Stay.', greeting: opts.greeting ?? '', output: { voice: 'anna' }, tools: opts.tools ? [{}] : [], tts_language: 'english' } }));
  await tick(6);
  const stt = FakeWS.instances.find((w) => !w.isTts)!;
  const tts = FakeWS.instances.find((w) => w.isTts)!;
  return { s, stt, tts };
}
const types = () => events.map((e) => e.type);

beforeEach(() => {
  FakeWS.instances = [];
  FakeWS.auto = true;
  FakeWS.coalesce = false;
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWS;
  fetchMock = vi.fn();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  (globalThis as unknown as { window: unknown }).window = { localStorage: { getItem: () => null } };
});
afterEach(() => vi.restoreAllMocks());

describe('takeSpeakable', () => {
  it('waits for enough text, then cuts at a sentence end', () => {
    expect(takeSpeakable('Okay.')).toBeNull();
    expect(takeSpeakable('Okay, let us open the tax folder. Then')).toEqual({ chunk: 'Okay, let us open the tax folder.', rest: 'Then' });
    expect(takeSpeakable('Version 3.5 is fine for now, truly')).toBeNull();
    // the first chunk of a reply may end at a comma, so speech starts sooner
    expect(takeSpeakable('Okay, let us open the tax folder, then sort it. Next', true)).toEqual({ chunk: 'Okay, let us open the tax folder,', rest: 'then sort it. Next' });
    expect(takeSpeakable('Okay, sure', true)).toBeNull();
  });
});

describe('quickConfirmation', () => {
  it('confirms simple successful actions in the right language, and nothing else', () => {
    expect(quickConfirmation('park', '{"ok":true}', 'english')).toBe('Parked.');
    expect(quickConfirmation('park', '{"ok":true}', 'spanish')).toBe('Guardado para después.');
    expect(quickConfirmation('timer_start', '{"ok":true,"x":1}', 'german')).toBe('Erledigt.');
    expect(quickConfirmation('park', '{"ok":false}', 'english')).toBeNull(); // a failure needs the model to explain
    expect(quickConfirmation('memory_show', '{"ok":true}', 'english')).toBeNull(); // information the person asked for
    expect(quickConfirmation('voice', '{"ok":true}', 'english')).toBeNull();
    expect(quickConfirmation('park', 'not json', 'english')).toBeNull();
    expect(quickConfirmation('park', '{"ok":true}', 'klingon')).toBe('Parked.');
  });
});

describe('soundsUnfinished', () => {
  it.each([
    'I need to, um, send that email to my landlord and, uh,',
    'I keep thinking that',
    'and then I',
    'So I was going to um',
    'I want to...',
    'Maybe because',
    'I need to,',
  ])('unfinished: %s', (t) => expect(soundsUnfinished(t)).toBe(true));
  it.each([
    'I keep thinking about how to start it.',
    'Can you give me one tiny step?',
    'Okay, I will try that now.',
    'Park it: I need to call the dentist.',
    'I did that.',
    'Stop!',
  ])('finished: %s', (t) => expect(soundsUnfinished(t)).toBe(false));
});

describe('FastSocket', () => {
  it('connects both sockets with the right addresses and says ready, then speaks the greeting', async () => {
    const { stt, tts } = await open({ greeting: 'Still here with you.' });
    expect(stt.url).toContain('streaming.assemblyai.com/v3/ws');
    expect(stt.url).toContain('sample_rate=24000');
    expect(tts.url).toContain('voice=anna');
    expect(tts.url).toContain('language=english');
    expect(types()).toEqual(['session.ready', 'reply.started', 'reply.audio', 'transcript.agent', 'reply.done']);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Still here with you.');
  });

  it('turns a spoken sentence into Voice Agent events, streams the model into speech, and records history', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay, let us start. '), text('Open the tax folder.')));
    const { stt, tts } = await open();
    stt.push({ type: 'Turn', transcript: 'I keep avoiding', end_of_turn: false, turn_order: 0 });
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: true, turn_order: 0 });
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: true, turn_order: 0, turn_is_formatted: true }); // formatted re-send
    await tick(30);
    expect(types()).toEqual(expect.arrayContaining(['input.speech.started', 'transcript.user.delta', 'input.speech.stopped', 'transcript.user', 'reply.started', 'reply.audio', 'transcript.agent', 'reply.done']));
    expect(events.filter((e) => e.type === 'transcript.user')).toHaveLength(1); // not run twice
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'I keep avoiding my taxes.' });
    const spoken = tts.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d)).filter((m) => m.type === 'Generate').map((m) => m.text);
    expect(spoken.join(' ')).toBe('Okay, let us start. Open the tax folder.');
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Okay, let us start. Open the tax folder.');
  });

  it('barge-in: two words over Stay cancel its speech and drop its late audio', async () => {
    fetchMock.mockResolvedValue(sse(text('This is a long reply that is being spoken right now.')));
    const { s, stt, tts } = await open();
    stt.push({ type: 'Turn', transcript: 'plan my day.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    const before = events.filter((e) => e.type === 'reply.audio').length;
    stt.push({ type: 'Turn', transcript: 'wait actually', end_of_turn: false, turn_order: 1 });
    expect(events.at(-2)?.type === 'input.speech.started' || events.at(-1)?.type === 'transcript.user.delta').toBe(true);
    expect(tts.sent.some((d) => typeof d === 'string' && JSON.parse(d).type === 'Cancel')).toBe(true);
    tts.push({ type: 'Audio', audio: 'AAAA', flush_id: 0 }); // late audio from the cancelled reply
    expect(events.filter((e) => e.type === 'reply.audio').length).toBe(before);
    s.close();
  });

  it('finishes a two-sentence reply even when the server reports both flushes as one FlushDone', async () => {
    FakeWS.coalesce = true;
    fetchMock.mockResolvedValue(sse(text('Okay, let us start with one step. '), text('Open the tax folder now.')));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'help me begin.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(types()).toEqual(expect.arrayContaining(['transcript.agent', 'reply.done']));
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Okay, let us start with one step. Open the tax folder now.');
  });

  it('speaking after an idle cancel still works (the server acknowledges Cancel, then fresh audio plays)', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay, let us open the tax folder.')));
    const { stt } = await open({ greeting: 'Hi there, I am here.' });
    stt.push({ type: 'Turn', transcript: 'I keep', end_of_turn: false, turn_order: 0 }); // cancels (idle) then speaks
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(events.filter((e) => e.type === 'reply.audio').length).toBeGreaterThan(1);
    expect(events.at(-1)?.type).toBe('reply.done');
  });

  it('late partials of a finished turn do not cancel the reply', async () => {
    FakeWS.auto = false;
    fetchMock.mockResolvedValue(sse(text('Okay, let us open the tax folder.')));
    const { stt, tts } = await open();
    stt.push({ type: 'Turn', transcript: 'help me begin.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    stt.push({ type: 'Turn', transcript: 'help me begin now please', end_of_turn: false, turn_order: 0 });
    expect(tts.sent.filter((d) => typeof d === 'string' && JSON.parse(d).type === 'Cancel')).toHaveLength(0); // the late partial belongs to a turn already handled
    expect(events.filter((e) => e.type === 'input.speech.started')).toHaveLength(1);
  });

  it('waits through a pause: a turn that trails off is held, and the finished thought is answered once, merged', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay, let us open the email draft.')));
    const { stt } = await open({ holdMs: 400 });
    stt.push({ type: 'Turn', transcript: 'I need to, um, send that email and, uh,', end_of_turn: false, turn_order: 0 });
    stt.push({ type: 'Turn', transcript: 'I need to, um, send that email and, uh,', end_of_turn: true, turn_order: 0 });
    await tick(10);
    expect(fetchMock).not.toHaveBeenCalled(); // did not talk into the pause
    expect(types()).not.toContain('transcript.user');
    stt.push({ type: 'Turn', transcript: 'and I keep thinking', end_of_turn: false, turn_order: 1 });
    stt.push({ type: 'Turn', transcript: 'and I keep thinking about how to start it.', end_of_turn: true, turn_order: 1 });
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events.filter((e) => e.type === 'transcript.user')).toHaveLength(1);
    expect(events.find((e) => e.type === 'transcript.user')?.text).toBe('I need to, um, send that email and, uh, and I keep thinking about how to start it.');
    expect(events.filter((e) => e.type === 'input.speech.started')).toHaveLength(1);
  });

  it('answers anyway when the hesitation never ends (after the hold)', async () => {
    fetchMock.mockResolvedValue(sse(text('Take your time, I am here with you.')));
    const { stt } = await open({ holdMs: 40 });
    stt.push({ type: 'Turn', transcript: 'I need to, um,', end_of_turn: true, turn_order: 0 });
    await new Promise((r) => setTimeout(r, 120));
    await tick(20);
    expect(events.filter((e) => e.type === 'transcript.user')).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a simple command is confirmed at once, without a second model call', async () => {
    fetchMock.mockResolvedValueOnce(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'p1', function: { name: 'app', arguments: '{"action":"park","value":"call the dentist"}' } }] } }] }));
    const { s, stt, tts } = await open({ tools: true });
    stt.push({ type: 'Turn', transcript: 'park it, call the dentist.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    s.send(JSON.stringify({ type: 'tool.result', call_id: 'p1', result: '{"ok":true}' }));
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const spoken = tts.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d)).filter((m) => m.type === 'Generate').map((m) => m.text);
    expect(spoken).toEqual(['Parked.']);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Parked.');
    expect(events.at(-1)?.type).toBe('reply.done');
  });

  it('never goes silent after a command: if the model has nothing to add, Stay says Done', async () => {
    fetchMock
      .mockResolvedValueOnce(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'm1', function: { name: 'app', arguments: '{\"action\":\"memory_show\"}' } }] } }] }))
      .mockResolvedValueOnce(sse({ choices: [{ delta: {} }] }));
    const { s, stt } = await open({ tools: true });
    stt.push({ type: 'Turn', transcript: 'show my memory.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    s.send(JSON.stringify({ type: 'tool.result', call_id: 'm1', result: '{\"ok\":true}' }));
    await tick(30);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Done.');
  });

  it('a stray word while Stay talks does not interrupt it', async () => {
    fetchMock.mockResolvedValue(sse(text('This is a long reply that is being spoken right now.')));
    FakeWS.auto = false; // Stay is mid-sentence: audio has started but the reply is not finished
    const { stt, tts } = await open();
    stt.push({ type: 'Turn', transcript: 'plan my day.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    tts.push({ type: 'Audio', audio: 'AAAA', flush_id: 0 });
    const started = events.filter((e) => e.type === 'input.speech.started').length;
    stt.push({ type: 'Turn', transcript: 'uh', end_of_turn: false, turn_order: 1 });
    expect(events.filter((e) => e.type === 'input.speech.started').length).toBe(started);
  });

  it('runs one app tool, waits for its result, then speaks the confirmation without tools', async () => {
    fetchMock
      .mockResolvedValueOnce(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'app', arguments: '{"action":"memory_' } }] } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'show"}' } }] } }] }))
      .mockResolvedValueOnce(sse(text('Here is what I remember.')));
    const { s, stt } = await open({ tools: true });
    stt.push({ type: 'Turn', transcript: 'show my memory please.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    const call = events.find((e) => e.type === 'tool.call');
    expect(call).toMatchObject({ call_id: 'c1', name: 'app', arguments: { action: 'memory_show' } });
    s.send(JSON.stringify({ type: 'tool.result', call_id: 'c1', result: '{"ok":true}' }));
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(second.withTools).toBe(false);
    expect(second.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Here is what I remember.');
  });

  it('a safety answer from the server means no speech from the model', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ safety: 'crisis' }), { headers: { 'content-type': 'application/json' } }));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'something heavy.', end_of_turn: true, turn_order: 0 });
    await tick(20);
    expect(types()).not.toContain('reply.audio');
    expect(types()).toContain('reply.done');
  });

  it('forwards mic audio to speech-to-text as bytes and closes cleanly on session.end', async () => {
    const { s, stt, tts } = await open();
    s.send(JSON.stringify({ type: 'input.audio', audio: 'AAECAw==' }));
    expect(Array.from(stt.sent.at(-1) as Uint8Array)).toEqual([0, 1, 2, 3]);
    let closed = false;
    s.onclose = () => { closed = true; };
    s.send(JSON.stringify({ type: 'session.end' }));
    expect(closed).toBe(true);
    expect(stt.sent.some((d) => typeof d === 'string' && JSON.parse(d).type === 'Terminate')).toBe(true);
    expect(tts.sent.some((d) => typeof d === 'string' && JSON.parse(d).type === 'Terminate')).toBe(true);
  });
});
