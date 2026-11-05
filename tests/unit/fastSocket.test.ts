import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ENDPOINTING_PRESETS,
  FastSocket,
  fastVoiceFor,
  isBackchannelOnly,
  isExplicitInterruption,
  isOpenerOnly,
  quickConfirmation,
  soundsUnfinished,
  takeSpeakable,
} from '@/lib/voice/fastSocket';

// ---- a scripted AssemblyAI: STT sockets accept audio and are driven by the test; TTS sockets answer Flush with audio ----
class FakeWS {
  static OPEN = 1;
  static instances: FakeWS[] = [];
  static auto = true;
  static coalesce = false; // the server reports two flushes as one FlushDone
  static beginDelayMs = 0; // a new voice session takes this long to open (the model can finish first)
  static dropCancelAck = false; // a Cancel sent just before the socket is replaced never gets its ack
  static expiredTokens = new Set<string>(); // TTS tokens past their 60 s: the server opens, sends an Error and closes, as the live API does
  static deadSttTokens = new Set<string>(); // STT tokens the service refuses: the socket errors and closes before Begin
  readyState = 0;
  sent: Array<string | Uint8Array> = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  flushes = 0;
  constructor(public url: string) {
    FakeWS.instances.push(this);
    const parsed = new URL(url);
    if (this.isTts && parsed.searchParams.has('voice')) {
      queueMicrotask(() => {
        this.push({ type: 'Error', error_code: 3006, error: 'voice is retired; use voice_id' });
        this.close();
      });
      return;
    }
    if (this.isTts && FakeWS.expiredTokens.has(parsed.searchParams.get('token') ?? '')) {
      queueMicrotask(() => {
        this.readyState = 1;
        this.push({ type: 'Error', error_code: 1008, error: 'Unauthorized: Signature has expired', retryable: false });
        this.close();
      });
      return;
    }
    if (!this.isTts && FakeWS.deadSttTokens.has(parsed.searchParams.get('token') ?? '')) {
      queueMicrotask(() => {
        this.readyState = 3;
        this.onerror?.();
        this.onclose?.();
      });
      return;
    }
    const begin = () => {
      this.readyState = 1;
      this.push({ type: 'Begin' });
    };
    if (this.isTts && FakeWS.beginDelayMs > 0) setTimeout(begin, FakeWS.beginDelayMs);
    else queueMicrotask(begin);
  }
  get isTts() { return this.url.includes('tts'); }
  push(m: object) { this.onmessage?.({ data: JSON.stringify(m) }); }
  send(d: string | Uint8Array) {
    this.sent.push(d);
    if (typeof d === 'string' && this.isTts) {
      let m: { type: string };
      try {
        m = JSON.parse(d) as { type: string };
      } catch {
        this.push({ type: 'Error', error_code: 3012, error: 'Malformed JSON' });
        this.close();
        return;
      }
      if (m.type === 'Flush' && FakeWS.auto) {
        const id = this.flushes++;
        queueMicrotask(() => { this.push({ type: 'Audio', audio: 'AAAA', flush_id: id }); if (!(FakeWS.coalesce && id % 2 === 0)) this.push({ type: 'FlushDone', flush_id: id }); });
      }
      if (m.type === 'Cancel' && !FakeWS.dropCancelAck) {
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
let openedSockets: FastSocket[] = []; // closed after each test so a late timer of one test never writes into the next
let fetchMock: ReturnType<typeof vi.fn>;
async function open(opts: { tools?: boolean; greeting?: string; holdMs?: number; autoLanguage?: boolean; personal?: string; freshTtsToken?: () => Promise<string>; freshSttToken?: () => Promise<string>; fakeTimers?: boolean } = {}) {
  const s = new FastSocket({ sttToken: 'stt', ttsToken: 'tts', holdMs: opts.holdMs ?? 60, interruptHoldMs: opts.holdMs ?? 60, proactiveQuietMs: 60, proactiveGiveUpMs: 700, warmUp: false, autoLanguage: opts.autoLanguage, freshTtsToken: opts.freshTtsToken, freshSttToken: opts.freshSttToken });
  events = [];
  openedSockets.push(s);
  s.onmessage = (e) => events.push(JSON.parse(e.data));
  const settle = (n: number) => (opts.fakeTimers ? vi.advanceTimersByTimeAsync(n) : tick(n)); // with fake timers a "tick" is a clock advance
  await settle(2);
  s.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'You are Stay.', greeting: opts.greeting ?? '', output: { voice: 'anna' }, tools: opts.tools ? [{}] : [], tts_language: 'english', ...(opts.personal ? { personal: opts.personal } : {}) } }));
  await settle(6);
  const stt = FakeWS.instances.find((w) => !w.isTts)!;
  const tts = FakeWS.instances.find((w) => w.isTts)!;
  return { s, stt, tts };
}
const types = () => events.map((e) => e.type);

beforeEach(() => {
  FakeWS.instances = [];
  FakeWS.auto = true;
  FakeWS.coalesce = false;
  FakeWS.dropCancelAck = false;
  FakeWS.beginDelayMs = 0;
  FakeWS.expiredTokens = new Set();
  FakeWS.deadSttTokens = new Set();
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWS;
  fetchMock = vi.fn();
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  (globalThis as unknown as { window: unknown }).window = { localStorage: { getItem: () => null } };
});
afterEach(() => {
  openedSockets.forEach((s) => s.close());
  openedSockets = [];
  vi.restoreAllMocks();
});

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
    expect(stt.url).toContain('sample_rate=16000');
    expect(tts.url).toContain('voice_id=478badc1-a7eb-5bef-b916-c6e51bd2771e'); // persona "anna" = Adrienne (en-GB)
    expect(tts.url).not.toContain('voice=');
    expect(tts.url).toContain('language=english');
    expect(types()).toEqual(['session.ready', 'reply.started', 'reply.text', 'reply.audio', 'transcript.agent', 'reply.done']);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Still here with you.');
  });

  it('announces each sentence as reply.text before its audio, for the figure lip sync (no added wait)', async () => {
    await open({ greeting: 'Still here with you.' });
    const order = types();
    expect(events.find((e) => e.type === 'reply.text')?.text).toBe('Still here with you.');
    expect(order.indexOf('reply.text')).toBeGreaterThan(order.indexOf('reply.started'));
    expect(order.indexOf('reply.text')).toBeLessThan(order.indexOf('reply.audio'));
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
    const frames = tts.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d));
    // the API joins Generate texts with no separator: what it hears must read as the reply, and a reply is ONE synthesis (one Flush)
    expect(frames.filter((m) => m.type === 'Generate').map((m) => m.text).join('').trim()).toBe('Okay, let us start. Open the tax folder.');
    expect(frames.filter((m) => m.type === 'Flush')).toHaveLength(1);
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

  it('echo guard: Stay’s own words coming back through the mic do not cut the reply off, but a real interruption does', async () => {
    FakeWS.auto = false; // the server has not finished: Stay is mid-sentence
    fetchMock.mockResolvedValue(sse(text('Open the tax folder and look at the first page, nothing else.')));
    const { s, stt, tts } = await open();
    stt.push({ type: 'Turn', transcript: 'plan my day.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    tts.push({ type: 'Audio', audio: 'AAAA'.repeat(40000), flush_id: 0 }); // about 0.6 s of speech is playing
    const cancels = () => tts.sent.filter((d) => typeof d === 'string' && JSON.parse(d).type === 'Cancel').length;
    const before = cancels();
    // the speakers' output transcribed by the microphone
    stt.push({ type: 'Turn', transcript: 'open the tax folder and look at the', end_of_turn: false, turn_order: 1 });
    expect(cancels()).toBe(before);
    expect(events.some((e) => e.type === 'barge_in.echo_ignored' && e.reason)).toBe(true);
    // a person talking over it with different words
    stt.push({ type: 'Turn', transcript: 'actually let me get water first', end_of_turn: false, turn_order: 1 });
    expect(cancels()).toBeGreaterThan(before);
    s.close();
  });

  it('a two-sentence reply is one synthesis: one Flush, one FlushDone, no join silence', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay, let us start with one step. '), text('Open the tax folder now.')));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'help me begin.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(types()).toEqual(expect.arrayContaining(['transcript.agent', 'reply.done']));
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Okay, let us start with one step. Open the tax folder now.');
    const tts = FakeWS.instances.find((w) => w.isTts)!;
    expect(tts.sent.filter((d) => typeof d === 'string' && d.includes('Flush'))).toHaveLength(1);
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

  it('asks the model early when a partial already ends the sentence, and uses that request when the final transcript agrees', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay, let us start. '), text('Open the tax folder.')));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: false, turn_order: 0 });
    await tick(4);
    expect(fetchMock).toHaveBeenCalledTimes(1); // requested before the end of turn
    expect(types()).not.toContain('transcript.user');
    expect(types().filter((t) => String(t).startsWith('reply.') || t === 'transcript.agent')).toEqual([]); // prepared, but nothing heard until the turn is confirmed
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(1); // adopted, not repeated
    expect(events.filter((e) => e.type === 'transcript.user')).toHaveLength(1);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Okay, let us start. Open the tax folder.');
    const order = types();
    expect(order.indexOf('transcript.user')).toBeLessThan(order.indexOf('reply.started')); // the app sees the user line first
    expect(order.indexOf('reply.started')).toBeLessThan(order.indexOf('reply.audio'));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'I keep avoiding my taxes.' });
  });

  it('when the model is out of tokens the person hears the plain failure line once, not twice (soak: "...ask again. I am getting too many requests...")', async () => {
    const MSG = 'I am getting too many requests right now, so I cannot answer yet. Give it a minute and ask again.';
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: 'quota', message: MSG }), { status: 503, headers: { 'content-type': 'application/json' } }));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'I do not know where to start.', end_of_turn: false, turn_order: 0 });
    await tick(8);
    stt.push({ type: 'Turn', transcript: 'I do not know where to start.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await tick(40);
    const said = events.filter((e) => e.type === 'transcript.agent').map((e) => e.text);
    expect(said).toEqual([MSG]);
    expect(events.filter((e) => e.type === 'reply.text').map((e) => e.text)).toEqual([MSG]);
    expect(events.at(-1)?.type).toBe('reply.done');
  });

  it('failure line once when the final words differ from the early guess', async () => {
    const MSG = 'I am getting too many requests right now, so I cannot answer yet. Give it a minute and ask again.';
    fetchMock.mockImplementation(async () => { await tick(3); return new Response(JSON.stringify({ error: 'quota', message: MSG }), { status: 503, headers: { 'content-type': 'application/json' } }); });
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'I do not know where to start.', end_of_turn: false, turn_order: 0 });
    await tick(2);
    stt.push({ type: 'Turn', transcript: 'I do not know where to start. Honestly I am stuck.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await tick(60);
    const said = events.filter((e) => e.type === 'transcript.agent').map((e) => e.text);
    console.log('CALLS', fetchMock.mock.calls.length, JSON.stringify(said));
    expect(said).toEqual([MSG]);
  });

  it('voice lost: the reply still appears as text and the turn ends, and the voice comes back for the next one (soak: 12 turns of silence after the voice connection dropped)', async () => {
    fetchMock.mockImplementation(async () => sse(text('Open the email and type the first line.')));
    const { stt, tts } = await open();
    FakeWS.expiredTokens.add('tts'); // every new voice session is refused
    tts.close();
    await tick(40);
    stt.push({ type: 'Turn', transcript: 'I do not know where to start.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await new Promise((r) => setTimeout(r, 1000)); // the reply ends 600 ms after its words are shown
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Open the email and type the first line.');
    expect(types().indexOf('reply.done')).toBeGreaterThan(types().indexOf('transcript.agent')); // the turn ends, the orb can listen again
    expect(types()).not.toContain('reply.audio'); // nothing could be spoken

    // the service accepts a new session again: the next reply asks for it at once, and the one after that is spoken
    FakeWS.expiredTokens.delete('tts');
    stt.push({ type: 'Turn', transcript: 'Okay, what next?', end_of_turn: true, turn_order: 1, turn_is_formatted: true });
    await new Promise((r) => setTimeout(r, 1500));
    stt.push({ type: 'Turn', transcript: 'And after that?', end_of_turn: true, turn_order: 2, turn_is_formatted: true });
    await new Promise((r) => setTimeout(r, 800));
    expect(types()).toContain('tts.reconnected');
    expect(types()).toContain('reply.audio');
  });

  it('an Error from the voice service and the close after it are one failure: one new session, not two (pipeline soak: reconnects in pairs, then "unavailable")', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay.')));
    const ttsSockets = () => FakeWS.instances.filter((w) => w.isTts);
    const { tts } = await open();
    const before = ttsSockets().length;
    tts.push({ type: 'Error', error_code: 3008, error: 'too many sessions' });
    tts.close();
    await new Promise((r) => setTimeout(r, 700));
    expect(ttsSockets().length).toBe(before + 1);
    expect(types().filter((t) => t === 'tts.reconnecting')).toHaveLength(1);
    expect(types()).toContain('tts.reconnected');
  });

  it('a voice session that was already replaced closing late does not open another one or drop the working voice', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay.')));
    const ttsSockets = () => FakeWS.instances.filter((w) => w.isTts);
    const { tts } = await open();
    tts.close(); // the voice drops: one reconnect
    await new Promise((r) => setTimeout(r, 700));
    const n = ttsSockets().length;
    expect(n).toBe(2);
    tts.close(); // the old session reports its close again, late
    await new Promise((r) => setTimeout(r, 700));
    expect(ttsSockets().length).toBe(n);
    expect(types().filter((t) => t === 'tts.reconnecting')).toHaveLength(1);
  });

  it('a think block from the model is neither shown nor spoken (real-model soak: the bubble began "<think></think>")', async () => {
    fetchMock.mockResolvedValueOnce(sse(text('<think>\n\n</think>\n\n'), text('What is the one thing you want the reader to feel?')));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'I do not know the first sentence.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await tick(60);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('What is the one thing you want the reader to feel?');
    expect(events.filter((e) => e.type === 'reply.text').every((e) => !String(e.text).includes('think'))).toBe(true);
  });

  it('a failure line is never remembered as something Stay said (reactive run: the model then copied "Try again in a minute.")', async () => {
    const MSG = 'I am getting too many requests right now, so I cannot answer yet. Give it a minute and ask again.';
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'quota', message: MSG }), { status: 503, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(sse(text('Open the document and write one line.')));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'I do not know where to start.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await new Promise((r) => setTimeout(r, 1200));
    stt.push({ type: 'Turn', transcript: 'Okay, try once more.', end_of_turn: true, turn_order: 1, turn_is_formatted: true });
    await tick(60);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const sent = JSON.parse(fetchMock.mock.calls[1][1].body as string).messages as Array<{ role: string; content: string }>;
    expect(sent.some((m) => m.role === 'assistant' && /too many requests/.test(m.content))).toBe(false);
    expect(events.filter((e) => e.type === 'transcript.agent').map((e) => e.text)).toEqual([MSG, 'Open the document and write one line.']); // still shown and spoken
  });

  it('a timer check-in waits while the person is mid-sentence and speaks only after they have been answered (owner: "the voice is breaking and in between the conversation started block timing")', async () => {
    fetchMock.mockResolvedValue(sse(text('Open the document and write one line.')));
    const { s, stt } = await open();
    stt.push({ type: 'Turn', transcript: 'So the thing is, I', end_of_turn: false, turn_order: 0 }); // they are still talking
    await tick(8);
    s.send(JSON.stringify({ type: 'reply.say', text: 'Two minutes are up. How did it go?', when: 'idle' }));
    await new Promise((r) => setTimeout(r, 250));
    expect(events.filter((e) => e.type === 'transcript.agent')).toHaveLength(0); // it did not talk over them
    stt.push({ type: 'Turn', transcript: 'So the thing is, I keep stalling.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await new Promise((r) => setTimeout(r, 350));
    const said = events.filter((e) => e.type === 'transcript.agent').map((e) => e.text);
    expect(said[0]).toBe('Open the document and write one line.'); // the reply to them came first, whole
  });

  it('a timer check-in on a quiet call is spoken, after a short quiet', async () => {
    const { s } = await open();
    s.send(JSON.stringify({ type: 'reply.say', text: 'Two minutes are up. How did it go?', when: 'idle' }));
    await new Promise((r) => setTimeout(r, 400));
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Two minutes are up. How did it go?');
  });

  it('a check-in that cannot find a quiet moment is dropped as stale, never spoken late over the conversation', async () => {
    const { s, stt } = await open();
    stt.push({ type: 'Turn', transcript: 'and then I', end_of_turn: false, turn_order: 0 });
    await tick(8);
    s.send(JSON.stringify({ type: 'reply.say', text: 'Two minutes are up.', when: 'idle' }));
    await new Promise((r) => setTimeout(r, 1100)); // longer than the give-up time while they are still mid-sentence
    expect(events.filter((e) => e.type === 'transcript.agent')).toHaveLength(0);
  });

  it('a check-in that is an instruction reaches the server as the instruction, with no tools (before, the model never saw it and answered the last thing the person said again)', async () => {
    fetchMock.mockResolvedValue(sse(text('Time is up. Did you get started?')));
    const { s } = await open({ tools: true });
    s.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: 'Set a one minute timer.' }));
    s.send(JSON.stringify({ type: 'reply.create', instructions: "The user's 1-minute timer just ended. Say in under 10 words that their time is up.", when: 'idle' }));
    await new Promise((r) => setTimeout(r, 400));
    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);
    expect(body.instruction).toMatch(/timer just ended/);
    expect(body.withTools).toBe(false);
  });

  it('a check-in does not start while the model is still working on the answer to the person (it cancelled that answer before)', async () => {
    fetchMock.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 500));
      return sse(text('Open the document and write one line.'));
    });
    fetchMock.mockResolvedValue(sse(text('Time is up.')));
    const { s, stt } = await open();
    stt.push({ type: 'Turn', transcript: 'I need to start my essay.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await new Promise((r) => setTimeout(r, 150)); // longer than the quiet time, shorter than the model
    s.send(JSON.stringify({ type: 'reply.create', instructions: "The user's timer just ended. Say it is up.", when: 'idle' }));
    await new Promise((r) => setTimeout(r, 900));
    const said = events.filter((e) => e.type === 'transcript.agent').map((e) => e.text);
    expect(said[0]).toBe('Open the document and write one line.');
  });

  it('words the app forces on the voice (no "when") are still spoken at once', async () => {
    const { s } = await open();
    s.send(JSON.stringify({ type: 'reply.say', text: 'Okay, I will do that.' }));
    await tick(20);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Okay, I will do that.');
  });

  it('speculates immediately on short greetings like "Hi hello" even without terminal punctuation', async () => {
    fetchMock.mockResolvedValue(sse(text('Hello! What are you working on?')));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'Hi hello', end_of_turn: false, turn_order: 0 });
    await tick(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(types()).not.toContain('transcript.user');
    stt.push({ type: 'Turn', transcript: 'Hi hello.', end_of_turn: true, turn_order: 0, turn_is_formatted: true });
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Hello! What are you working on?');
  });

  it('drops the early request and asks again when they said more than the partial', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay, one thing at a time, please.')));
    const { stt } = await open();
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: false, turn_order: 0 });
    await tick(4);
    const early = fetchMock.mock.calls[0][1].signal as AbortSignal;
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes. And my email.', end_of_turn: false, turn_order: 0 });
    await tick(4);
    expect(early.aborted).toBe(true);
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes. And my email.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    const last = JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);
    expect(last.messages.at(-1)).toEqual({ role: 'user', content: 'I keep avoiding my taxes. And my email.' });
    expect(events.filter((e) => e.type === 'transcript.agent')).toHaveLength(1); // the dropped request never spoke
  });

  it('never asks early for a turn that sounds unfinished, and still waits through the pause', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay, let us open the email draft.')));
    const { stt } = await open({ holdMs: 400 });
    stt.push({ type: 'Turn', transcript: 'I need to, um, send that email and, uh,', end_of_turn: false, turn_order: 0 });
    stt.push({ type: 'Turn', transcript: 'I need to send that email and', end_of_turn: false, turn_order: 0 });
    await tick(6);
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('what Stay learned about the person goes with every turn (it never did before 2 Nov 2026)', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay.')));
    const { stt } = await open({ personal: 'Learned: 10-minute blocks got 3 of 3 started.' });
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: true, turn_order: 0 });
    await tick(20);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.context.personal).toBe('Learned: 10-minute blocks got 3 of 3 started.');
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

  it('an orb-look call the person did not ask for is not run: the model is asked again, in words', async () => {
    // persona run, 2 Nov 2026: "show me exactly how you'd log a sprint" made the model set the orb shape to "exactly" and Stay said Done
    fetchMock
      .mockResolvedValueOnce(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: 's1', function: { name: 'app', arguments: '{"action":"shape","value":"exactly"}' } }] } }] }))
      .mockResolvedValueOnce(sse(text('At the end of each sprint I check in with you.')));
    const { stt } = await open({ tools: true });
    stt.push({ type: 'Turn', transcript: "show me exactly how you'd log a sprint.", end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(events.find((e) => e.type === 'tool.call')).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).withTools).toBe(false);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toContain('check in');
  });

  it('when Stay already said it in words, a simple action gets no second reply (soak: "Parking that thought. Got it.Parking that.")', async () => {
    fetchMock.mockResolvedValueOnce(sse(
      { choices: [{ delta: { content: 'Parking that thought. Got it.' } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'pk1', function: { name: 'app', arguments: '{"action":"park","value":"call the dentist"}' } }] } }] },
    ));
    const { s, stt } = await open({ tools: true });
    stt.push({ type: 'Turn', transcript: 'park it: call the dentist.', end_of_turn: true, turn_order: 0 });
    await tick(14);
    s.send(JSON.stringify({ type: 'tool.result', call_id: 'pk1', result: '{"ok":true}' }));
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(1); // no second model call
    const said = events.filter((e) => e.type === 'transcript.agent').map((e) => e.text);
    expect(said).toEqual(['Parking that thought. Got it.']);
    expect(events.at(-1)?.type).toBe('reply.done');
  });

  it('a park nobody asked for is not run: the model answers in words (file-mic run, 3 Nov 2026: "Parked." to a person thinking out loud)', async () => {
    fetchMock
      .mockResolvedValueOnce(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'k1', function: { name: 'app', arguments: '{"action":"park","value":"send that email"}' } }] } }] }))
      .mockResolvedValueOnce(sse(text('Open the email and type the first line.')));
    const { stt } = await open({ tools: true });
    stt.push({ type: 'Turn', transcript: 'So I need to send that email and I keep thinking about how to start it.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(events.find((e) => e.type === 'tool.call')).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toContain('first line');
  });

  it('an orb-look call the person did ask for still runs', async () => {
    fetchMock.mockResolvedValueOnce(sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: 's2', function: { name: 'app', arguments: '{"action":"shape","value":"heart"}' } }] } }] }));
    const { stt } = await open({ tools: true });
    stt.push({ type: 'Turn', transcript: 'make the orb a heart.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(events.find((e) => e.type === 'tool.call')).toMatchObject({ call_id: 's2', arguments: { action: 'shape', value: 'heart' } });
  });

  it('after an interruption, a short fragment is held so the rest of the sentence is heard too', async () => {
    FakeWS.auto = false; // Stay is mid-reply: audio has arrived and is still playing
    fetchMock.mockImplementation(async () => sse(text('Here is a long reply that is being spoken right now.')));
    const { stt, tts } = await open({ holdMs: 250 });
    stt.push({ type: 'Turn', transcript: 'plan my week.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    tts.push({ type: 'Audio', audio: 'A'.repeat(64000), flush_id: 0 }); // about 1.3 s of speech, so still playing
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stt.push({ type: 'Turn', transcript: 'wait stop', end_of_turn: false, turn_order: 1 });
    stt.push({ type: 'Turn', transcript: 'Wait, stop.', end_of_turn: true, turn_order: 1 });
    await tick(8);
    expect(fetchMock).toHaveBeenCalledTimes(1); // not answered yet: the fragment is being held
    stt.push({ type: 'Turn', transcript: 'just one tiny step please.', end_of_turn: false, turn_order: 2 });
    stt.push({ type: 'Turn', transcript: 'just one tiny step please.', end_of_turn: true, turn_order: 2 });
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.messages.at(-1).content).toBe('Wait, stop. just one tiny step please.');
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

describe('fastVoiceFor', () => {
  it('uses the language native §2.4 voice_id for non-English fast voice', () => {
    expect(fastVoiceFor('anna', 'es')).toBe('1a48e481-7f02-5e96-bb84-68fcac65c2b2'); // Mateo (es)
    expect(fastVoiceFor('anna', 'fr')).toBe('04e17f09-99f7-5cac-8903-30d6b3de48fc'); // Claire (fr)
    expect(fastVoiceFor('anna', 'de')).toBe('8659d94f-872e-554f-8152-71a535ec0da5'); // Greta (de)
    expect(fastVoiceFor('charles', 'pt')).toBe('d7aada97-72e8-520d-b253-0e7ec0bb79c2'); // Lucas (pt)
  });
  it('maps English picks to verified §2.4 voice_ids and swaps a non-English voice out on English', () => {
    expect(fastVoiceFor('jane', 'en')).toBe('aai-jane');
    expect(fastVoiceFor('lola', 'en')).toBe('aai-anna');
    expect(fastVoiceFor('', 'en')).toBe('aai-anna');
  });
});

describe('Full-duplex overlap, endpointing presets, utterance speculation & multi-flush WordBoundaries', () => {
  it('classifies conversational backchannels vs explicit interruptions accurately', () => {
    expect(isBackchannelOnly('yeah')).toBe(true);
    expect(isBackchannelOnly('mm-hmm')).toBe(true);
    expect(isBackchannelOnly('uh huh')).toBe(true);
    expect(isBackchannelOnly('got it')).toBe(true);
    expect(isBackchannelOnly('stop')).toBe(false);
    expect(isBackchannelOnly('wait actually change that')).toBe(false);

    expect(isExplicitInterruption('stop')).toBe(true);
    expect(isExplicitInterruption('Wait')).toBe(true);
    expect(isExplicitInterruption('pause please')).toBe(true);
    expect(isExplicitInterruption('hold on')).toBe(true);
    expect(isExplicitInterruption('yeah')).toBe(false);
  });

  it('does NOT cancel assistant speech when user utters a 2-word backchannel ("uh huh", "got it")', async () => {
    FakeWS.auto = false;
    fetchMock.mockImplementation(async () => sse(text('Here is a calm two minute step for your taxes.')));
    const { s, stt, tts } = await open();
    stt.push({ type: 'Turn', transcript: 'help me with taxes.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    tts.push({ type: 'Audio', audio: 'A'.repeat(48000), flush_id: 0 });
    const cancelsBefore = tts.sent.filter((d) => typeof d === 'string' && JSON.parse(d).type === 'Cancel').length;

    stt.push({ type: 'Turn', transcript: 'uh huh', end_of_turn: false, turn_order: 1 });
    stt.push({ type: 'Turn', transcript: 'uh huh', end_of_turn: true, turn_order: 1 });
    const cancelsAfter = tts.sent.filter((d) => typeof d === 'string' && JSON.parse(d).type === 'Cancel').length;
    expect(cancelsAfter).toBe(cancelsBefore);
    s.close();
  });

  it('immediately interrupts assistant speech on a single-word explicit stop ("stop" or "wait")', async () => {
    FakeWS.auto = false;
    fetchMock.mockImplementation(async () => sse(text('Here is a long explanation that you want to stop right now.')));
    const { s, stt, tts } = await open();
    stt.push({ type: 'Turn', transcript: 'help me.', end_of_turn: true, turn_order: 0 });
    await tick(12);
    tts.push({ type: 'Audio', audio: 'A'.repeat(48000), flush_id: 0 });
    const cancelsBefore = tts.sent.filter((d) => typeof d === 'string' && JSON.parse(d).type === 'Cancel').length;

    stt.push({ type: 'Turn', transcript: 'stop', end_of_turn: false, turn_order: 1 });
    const cancelsAfter = tts.sent.filter((d) => typeof d === 'string' && JSON.parse(d).type === 'Cancel').length;
    expect(cancelsAfter).toBeGreaterThan(cancelsBefore);
    s.close();
  });

  it('monotonically offsets WordBoundaries across multiple TTS flushes in the same reply', async () => {
    const { tts } = await open();
    tts.push({
      type: 'WordBoundaries',
      words: [
        { text: 'First', start: 0, end: 250 },
        { text: 'sentence.', start: 260, end: 600 },
      ],
    });
    // Second flush resets start to 0 from provider TTS
    tts.push({
      type: 'WordBoundaries',
      words: [
        { text: 'Second', start: 0, end: 300 },
        { text: 'sentence.', start: 320, end: 700 },
      ],
    });
    const wbEvents = events.filter((e) => e.type === 'word.boundaries');
    expect(wbEvents).toHaveLength(2);
    const secondFlushWords = wbEvents[1].words as Array<{ text: string; start: number; end: number }>;
    expect(secondFlushWords[0].start).toBeGreaterThanOrEqual(660);
    expect(secondFlushWords[1].end).toBeGreaterThan(secondFlushWords[0].start);
  });

  it('applies ENDPOINTING_PRESETS query params when endpointingMode is configured (without end_of_turn_confidence_threshold on universal-3-6-pro)', async () => {
    const s = new FastSocket({
      sttToken: 'stt',
      ttsToken: 'tts',
      warmUp: false,
      endpointingMode: 'reflective',
    });
    await tick(2);
    s.send(JSON.stringify({ type: 'session.update', session: { system_prompt: 'Stay', greeting: '', output: { voice: 'anna' }, tools: [] } }));
    await tick(6);
    const stt = FakeWS.instances.find((w) => !w.isTts)!;
    expect(stt.url).not.toContain('end_of_turn_confidence_threshold');
    expect(stt.url).toContain(`min_turn_silence=${ENDPOINTING_PRESETS.reflective.min_turn_silence}`);
    expect(stt.url).toContain(`max_turn_silence=${ENDPOINTING_PRESETS.reflective.max_turn_silence}`);
    s.close();
  });

  it('starts speculative LLM generation early when AssemblyAI Turn emits utterance before end_of_turn', async () => {
    fetchMock.mockResolvedValue(sse(text('Let us open the document together.')));
    const { stt } = await open();
    stt.push({
      type: 'Turn',
      transcript: 'I need help starting my report',
      utterance: 'I need help starting my report',
      end_of_turn: false,
      turn_order: 0,
    });
    await tick(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stt.push({
      type: 'Turn',
      transcript: 'I need help starting my report.',
      end_of_turn: true,
      turn_order: 0,
    });
    await tick(25);
    expect(fetchMock).toHaveBeenCalledTimes(1); // adopted speculative request
  });
});
describe('FastSocket: auto language follows what the person speaks', () => {
  const turn = (language_code: string, language_confidence: number, order = 0) => ({
    type: 'Turn', turn_order: order, transcript: 'Hola, necesito empezar mi tarea hoy.', end_of_turn: true, language_code, language_confidence,
  });
  const ttsSockets = () => FakeWS.instances.filter((w) => w.isTts);

  it('a confident Spanish turn reopens TTS in Spanish with the native Spanish voice, before replying', async () => {
    fetchMock.mockResolvedValue(sse(text('Claro, empecemos con un paso pequeño.')));
    const { stt } = await open({ autoLanguage: true });
    stt.push(turn('es', 0.95));
    await tick(30);
    expect(ttsSockets().length).toBe(2);
    expect(ttsSockets()[1].url).toContain('language=spanish');
    expect(ttsSockets()[1].url).toContain('voice_id=1a48e481-7f02-5e96-bb84-68fcac65c2b2');
    expect(events.some((e) => e.type === 'tts.language' && e.language === 'spanish')).toBe(true);
    expect(events.find((e) => e.type === 'transcript.user')?.language).toBe('es');
    // the reply was spoken on the new Spanish session, not dropped
    expect(ttsSockets()[1].sent.some((d) => typeof d === 'string' && d.includes('Generate'))).toBe(true);
  });

  it.each([
    ['low confidence (0.5)', 'es', 0.5, true],
    ['a language AssemblyAI TTS cannot speak', 'hi', 0.99, true],
    ['the same language as the session', 'en', 0.99, true],
    ['a pinned language (auto off)', 'es', 0.99, false],
  ])('does not move the voice for %s', async (_n, code, conf, auto) => {
    fetchMock.mockResolvedValue(sse(text('Okay, one small step.')));
    const { stt } = await open({ autoLanguage: auto });
    stt.push(turn(code, conf));
    await tick(30);
    expect(ttsSockets().length).toBe(1);
  });

  it('a switch more than a minute into the call opens the Spanish voice with a fresh token (the first one has expired)', async () => {
    // file-mic run, 3 Nov 2026: the switch came 100 s in, the reused call-start token got "Unauthorized: Signature has expired" four
    // times, and the Spanish reply was never spoken
    fetchMock.mockResolvedValue(sse(text('Claro, empecemos con un paso pequeño.')));
    const freshTtsToken = vi.fn(async () => 'tts-fresh');
    const { stt } = await open({ autoLanguage: true, freshTtsToken });
    FakeWS.expiredTokens.add('tts');
    stt.push(turn('es', 0.95));
    await tick(40);
    expect(freshTtsToken).toHaveBeenCalledTimes(1);
    const spanish = ttsSockets()[1];
    expect(new URL(spanish.url).searchParams.get('token')).toBe('tts-fresh');
    expect(spanish.sent.some((d) => typeof d === 'string' && d.includes('Generate'))).toBe(true);
    expect(types()).toContain('reply.audio');
    expect(types()).not.toContain('tts.unavailable');
  });

  it('a one- or two-word turn ("Hola.") never moves the voice, even when confidently Spanish', async () => {
    fetchMock.mockResolvedValue(sse(text('Hi.')));
    const { stt } = await open({ autoLanguage: true });
    stt.push({ type: 'Turn', turn_order: 0, transcript: 'Hola.', end_of_turn: true, language_code: 'es', language_confidence: 0.99 });
    await tick(30);
    expect(ttsSockets().length).toBe(1);
  });
});
describe('FastSocket: pictures', () => {
  const PIC = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';
  const bodyOf = (i: number) => JSON.parse(fetchMock.mock.calls[i][1].body as string);

  it('a typed message with a picture is a real turn, goes to the model with the picture and no tools, and the picture is used once', async () => {
    fetchMock.mockImplementation(async () => sse(text('I see an unfinished email.')));
    const { s } = await open({ tools: true });
    s.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: 'what is wrong with this?', image: PIC }));
    s.send(JSON.stringify({ type: 'reply.create' }));
    await tick(30);
    expect(bodyOf(0).image).toBe(PIC);
    expect(bodyOf(0).withTools).toBe(false);
    expect(bodyOf(0).messages.at(-1)).toEqual({ role: 'user', content: 'what is wrong with this?' });
    s.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: 'ok thanks' }));
    s.send(JSON.stringify({ type: 'reply.create' }));
    await tick(30);
    expect(bodyOf(1).image).toBeUndefined();
  });

  it('a shared frame is attached only to turns that point at it', async () => {
    fetchMock.mockImplementation(async () => sse(text('Looks like a form.')));
    const { s, stt } = await open();
    s.send(JSON.stringify({ type: 'input.image', image: PIC }));
    stt.push({ type: 'Turn', turn_order: 0, transcript: 'What do you see on my screen right now?', end_of_turn: true });
    await tick(40);
    expect(bodyOf(0).image).toBe(PIC);
    stt.push({ type: 'Turn', turn_order: 1, transcript: 'I keep avoiding my taxes.', end_of_turn: true });
    await tick(40);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(bodyOf(fetchMock.mock.calls.length - 1).image).toBeUndefined();
  });

  it('ignores a picture that is not a small image data URL', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay.')));
    const { s } = await open();
    s.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: 'look at this', image: 'https://evil.example/a.png' }));
    s.send(JSON.stringify({ type: 'reply.create' }));
    await tick(30);
    expect(bodyOf(0).image).toBeUndefined();
  });
});

describe('FastSocket: the server stops a reply to a picture', () => {
  const PIC = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD';
  const json = (o: object) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });

  it('crisis wording read from a picture: the app is told so it can show help, and nothing is spoken', async () => {
    fetchMock.mockResolvedValue(json({ safety: 'crisis' }));
    const { s } = await open();
    s.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: 'what does this say?', image: PIC }));
    s.send(JSON.stringify({ type: 'reply.create' }));
    await tick(30);
    expect(types()).toContain('safety.blocked');
    expect(types()).not.toContain('reply.audio');
  });

  it('an instruction about medication in a picture reply: the fixed boundary is what gets spoken', async () => {
    fetchMock.mockResolvedValue(json({ safety: 'medication' }));
    const { s } = await open();
    s.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: 'what does this say?', image: PIC }));
    s.send(JSON.stringify({ type: 'reply.create' }));
    await tick(30);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toMatch(/cannot advise on medication/);
  });

  it('without a picture the same answer is left to the app, which already checked the persons own words (no double speech)', async () => {
    fetchMock.mockResolvedValue(json({ safety: 'medication' }));
    const { s } = await open();
    s.send(JSON.stringify({ type: 'conversation.message', role: 'user', content: 'ok', }));
    s.send(JSON.stringify({ type: 'reply.create' }));
    await tick(30);
    expect(events.find((e) => e.type === 'transcript.agent')).toBeUndefined();
  });
});

describe('FastSocket: a lone greeting waits for the rest of the sentence', () => {
  it('isOpenerOnly: one greeting or filler word, never a real answer or a two-word greeting', () => {
    for (const t of ['Hola.', 'Hi,', 'Hello!', 'Um.', 'Okay.']) expect(isOpenerOnly(t), t).toBe(true);
    for (const t of ['Yes.', 'No.', 'Hi hello.', 'Hola, necesito ayuda.', 'Stop.', 'I am stuck', 'Okay, do it']) expect(isOpenerOnly(t), t).toBe(false);
  });

  it('"Hola." then the rest of the sentence is answered once, as one turn, not "Hola!" first', async () => {
    fetchMock.mockResolvedValue(sse(text('Claro, vamos paso a paso.')));
    const { stt } = await open();
    stt.push({ type: 'Turn', turn_order: 0, transcript: 'Hola.', end_of_turn: true });
    await new Promise((r) => setTimeout(r, 250));
    expect(types()).not.toContain('reply.started'); // still waiting: it was only the opening
    stt.push({ type: 'Turn', turn_order: 1, transcript: 'Hola, ahora necesito empezar mi tarea.', end_of_turn: true });
    await new Promise((r) => setTimeout(r, 900));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages.at(-1).content).toMatch(/necesito empezar mi tarea/);
  });

  it('a lone greeting that is not followed by anything is answered after the short wait', async () => {
    fetchMock.mockResolvedValue(sse(text('Hola, qué tal.')));
    const { stt } = await open();
    stt.push({ type: 'Turn', turn_order: 0, transcript: 'Hola.', end_of_turn: true });
    await new Promise((r) => setTimeout(r, 1100));
    expect(types()).toContain('reply.started');
  });
});

describe('FastSocket: a reply is never left on "Speaking"', () => {
  it('cancels whose acks were lost with the old voice session do not mute the next reply on the new one', async () => {
    FakeWS.dropCancelAck = true;
    fetchMock.mockResolvedValue(sse(text('Claro, empecemos con un paso pequeño.')));
    const { s, stt } = await open({ autoLanguage: true });
    // two early replies dropped in one turn: two Cancels, and the socket is replaced before either is acknowledged
    const internals = s as unknown as { cancel(): void };
    internals.cancel();
    internals.cancel();
    stt.push({ type: 'Turn', turn_order: 0, transcript: 'Hola, necesito empezar mi tarea hoy.', end_of_turn: true, language_code: 'es', language_confidence: 0.95 });
    await tick(30);
    expect(types()).toContain('reply.audio');
    expect(types()).toContain('reply.done');
  });

  it('the model finishing before the new language voice has opened still gets the reply spoken, flushed, and finished once', async () => {
    fetchMock.mockResolvedValue(sse(text('Hola, vamos paso a paso.')));
    const { stt } = await open({ autoLanguage: true });
    FakeWS.beginDelayMs = 80; // the Spanish voice session is slower to open than the (short) model reply
    stt.push({ type: 'Turn', turn_order: 0, transcript: 'Hola, necesito empezar mi tarea hoy.', end_of_turn: true, language_code: 'es', language_confidence: 0.95 });
    await new Promise((r) => setTimeout(r, 400));
    const order = types();
    expect(order).toContain('reply.audio');
    expect(order.filter((t) => t === 'reply.done')).toHaveLength(1);
    expect(order.lastIndexOf('reply.done')).toBeGreaterThan(order.indexOf('reply.started')); // never "done" before it started
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Hola, vamos paso a paso.');
    const spanish = FakeWS.instances.filter((w) => w.isTts)[1];
    const frames = spanish.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d));
    expect(frames.filter((m) => m.type === 'Flush')).toHaveLength(1);
  });

  it('a voice that goes silent after the reply is written still ends the reply', async () => {
    fetchMock.mockResolvedValue(sse(text('Open the tax folder.')));
    const { stt } = await open();
    FakeWS.instances.filter((w) => w.isTts).forEach((w) => ((FakeWS.auto = false), w));
    vi.useFakeTimers();
    try {
      stt.push({ type: 'Turn', turn_order: 0, transcript: 'I keep avoiding my taxes.', end_of_turn: true });
      await vi.advanceTimersByTimeAsync(500);
      expect(types()).toContain('reply.started');
      expect(types()).not.toContain('reply.done'); // no audio, no FlushDone: the reply is waiting
      await vi.advanceTimersByTimeAsync(8100);
      expect(types()).toContain('reply.done');
      expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Open the tax folder.');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('regional AssemblyAI voices', () => {
  it('Indian English and Mexican Spanish personas resolve to their real AssemblyAI voices', () => {
    expect(fastVoiceFor('chaiwala', 'en')).toBe('d9e70892-1ace-5638-b749-dd6a0ba44686'); // Andrew
    expect(fastVoiceFor('taco', 'es')).toBe('2aadec9a-80cc-5181-a9fc-f2a9fda0cf50'); // Constanza
    expect(fastVoiceFor('mariachi', 'es')).toBe('bff56a11-dc95-552e-a93a-59f68ca60b64'); // Antonio Luis
  });
  it('a Spanish-only voice never speaks English: it falls back to the default English voice', () => {
    expect(fastVoiceFor('taco', 'en')).toBe('aai-anna');
  });
  it('an Indian English voice asked for Spanish speaks the native Spanish voice', () => {
    expect(fastVoiceFor('chaiwala', 'es')).toBe('1a48e481-7f02-5e96-bb84-68fcac65c2b2');
  });
});

describe('FastSocket: speech-to-text reconnect', () => {
  const sttSockets = () => FakeWS.instances.filter((w) => !w.isTts);
  const ttsSockets = () => FakeWS.instances.filter((w) => w.isTts);
  const tokenOf = (w: FakeWS) => new URL(w.url).searchParams.get('token');
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const freshTokens = () => {
    let n = 0;
    return vi.fn(async () => `stt-fresh-${++n}`);
  };
  const userTexts = () => events.filter((e) => e.type === 'transcript.user').map((e) => e.text);
  const errors = () => events.filter((e) => e.type === 'session.error');

  it('an unexpected close opens a new STT socket with a fresh token; the call stays ready and the conversation carries on', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay, one small step.')));
    const freshSttToken = freshTokens();
    const { s, stt } = await open({ freshSttToken });
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    events.length = 0;
    stt.close(); // the service ends the speech-to-text session (the hour limit, a network blip)
    await wait(500);
    expect(sttSockets()).toHaveLength(2);
    expect(tokenOf(sttSockets()[1])).toBe('stt-fresh-1');
    expect(freshSttToken).toHaveBeenCalledTimes(1);
    expect(types()).toEqual(['stt.reconnecting', 'stt.reconnected']); // a calm state, and no error
    expect(s.readyState).toBe(FastSocket.OPEN);
    expect(ttsSockets()).toHaveLength(1); // the voice is untouched
    // the microphone now feeds the new socket
    s.send(JSON.stringify({ type: 'input.audio', audio: 'AAAA' }));
    expect(sttSockets()[1].sent.some((d) => d instanceof Uint8Array)).toBe(true);
    // the new session numbers its turns from 0 again: it is still heard, as a new turn, with the history from before the drop
    sttSockets()[1].push({ type: 'Turn', transcript: 'Okay, and then what?', end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(userTexts()).toEqual(['Okay, and then what?']);
    expect(events.find((e) => e.type === 'transcript.user')?.item_id).toBe('u-1'); // not a second "u-0"
    expect(types()).toContain('reply.done');
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body.messages.map((m: { content: string }) => m.content)).toEqual(expect.arrayContaining(['I keep avoiding my taxes.', 'Okay, and then what?']));
  });

  it('a close in the middle of a turn keeps the words heard so far and joins what the person says next', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay.')));
    const { stt } = await open({ freshSttToken: freshTokens(), holdMs: 500 }); // a hold longer than the reconnect
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my', end_of_turn: false, turn_order: 0 });
    stt.close();
    await wait(350);
    expect(errors()).toHaveLength(0);
    expect(userTexts()).toEqual([]); // still their turn: not answered half-heard
    sttSockets()[1].push({ type: 'Turn', transcript: 'taxes.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(userTexts()).toEqual(['I keep avoiding my taxes.']);
    await wait(600); // the old hold timer must not answer the same turn again
    expect(userTexts()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a close in the middle of a turn never leaves the turn open: what was heard is answered after the usual wait', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay.')));
    const { s, stt } = await open({ freshSttToken: freshTokens(), holdMs: 60 });
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes', end_of_turn: false, turn_order: 0 });
    stt.close();
    await wait(700);
    expect(userTexts()).toEqual(['I keep avoiding my taxes']);
    expect(types()).toContain('input.speech.stopped'); // the orb is not left on "listening to you"
    expect(types()).toContain('reply.done');
    expect(errors()).toHaveLength(0);
    expect(s.readyState).toBe(FastSocket.OPEN);
  });

  it('a second drop soon after a reconnect fails honestly instead of looping', async () => {
    const freshSttToken = freshTokens();
    const { s, stt } = await open({ freshSttToken });
    stt.close();
    await wait(500);
    expect(types()).toContain('stt.reconnected');
    sttSockets()[1].close();
    await wait(500);
    expect(errors()).toHaveLength(1);
    expect(errors()[0].code).toBe('stt_closed');
    expect(s.readyState).toBe(3);
    expect(sttSockets()).toHaveLength(2); // no third socket
    expect(freshSttToken).toHaveBeenCalledTimes(1);
  });

  it('when the new socket cannot open it tries twice, then fails honestly', async () => {
    FakeWS.deadSttTokens.add('stt-dead');
    const freshSttToken = vi.fn(async () => 'stt-dead');
    const { s, stt } = await open({ freshSttToken });
    stt.close();
    await wait(1400);
    expect(freshSttToken).toHaveBeenCalledTimes(2);
    expect(sttSockets()).toHaveLength(3); // the first one and two tries
    expect(types().filter((t) => t === 'stt.reconnecting')).toHaveLength(2);
    expect(types()).not.toContain('stt.reconnected');
    expect(errors()).toHaveLength(1);
    expect(errors()[0].code).toBe('stt_closed');
    expect(s.readyState).toBe(3);
  });

  it('a failed token request counts as a failed try', async () => {
    const freshSttToken = vi.fn(async (): Promise<string> => {
      throw new Error('mint');
    });
    const { s, stt } = await open({ freshSttToken });
    stt.close();
    await wait(1400);
    expect(freshSttToken).toHaveBeenCalledTimes(2);
    expect(sttSockets()).toHaveLength(1);
    expect(errors()).toHaveLength(1);
    expect(s.readyState).toBe(3);
  });

  it('without a way to get a fresh token a close fails the call at once, as before (the one-time token cannot be reused)', async () => {
    const { s, stt } = await open();
    stt.close();
    await tick(5);
    expect(sttSockets()).toHaveLength(1);
    expect(errors()).toHaveLength(1);
    expect(errors()[0].code).toBe('stt_closed');
    expect(s.readyState).toBe(3);
  });

  it('an Error from the service and the close after it are one failure: one new socket, not two', async () => {
    const { stt } = await open({ freshSttToken: freshTokens() });
    stt.push({ type: 'Error', error: 'session expired' });
    stt.close();
    await wait(600);
    expect(sttSockets()).toHaveLength(2);
    expect(types().filter((t) => t === 'stt.reconnecting')).toHaveLength(1);
    expect(types()).toContain('stt.reconnected');
    expect(errors()).toHaveLength(0);
  });

  it('closing the call on purpose never reconnects, even while a reconnect is waiting', async () => {
    const { s, stt } = await open({ freshSttToken: freshTokens() });
    stt.close();
    s.close(); // the person ends the call during the short wait before the new socket
    await wait(600);
    expect(sttSockets()).toHaveLength(1);
    expect(types()).not.toContain('stt.reconnected');
  });

  it('rotates the STT session at 55 minutes with a fresh token, before the hour limit ends it', async () => {
    vi.useFakeTimers();
    try {
      const freshSttToken = freshTokens();
      const { s, stt } = await open({ freshSttToken, fakeTimers: true });
      s.send(JSON.stringify({ type: 'capture.mode', on: true })); // hear and transcribe only, no model in this test
      await vi.advanceTimersByTimeAsync(54 * 60_000);
      expect(sttSockets()).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(2 * 60_000);
      expect(sttSockets()).toHaveLength(2);
      expect(tokenOf(sttSockets()[1])).toBe('stt-fresh-1');
      expect(stt.readyState).toBe(3); // the old one was closed on purpose
      expect(types()).not.toContain('session.error');
      expect(s.readyState).toBe(FastSocket.OPEN);
      sttSockets()[1].push({ type: 'Turn', transcript: 'Still here, hearing you.', end_of_turn: true, turn_order: 0 });
      await vi.advanceTimersByTimeAsync(50);
      expect(userTexts()).toEqual(['Still here, hearing you.']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits to rotate while the person is mid-turn, and rotates as soon as the turn is done', async () => {
    vi.useFakeTimers();
    try {
      fetchMock.mockImplementation(async () => sse(text('Okay.')));
      const { s, stt } = await open({ freshSttToken: freshTokens(), fakeTimers: true });
      s.send(JSON.stringify({ type: 'capture.mode', on: true }));
      await vi.advanceTimersByTimeAsync(54 * 60_000);
      stt.push({ type: 'Turn', transcript: 'I have been thinking about', end_of_turn: false, turn_order: 0 });
      await vi.advanceTimersByTimeAsync(2 * 60_000); // 55 minutes have passed, and they are still talking
      expect(sttSockets()).toHaveLength(1);
      stt.push({ type: 'Turn', transcript: 'I have been thinking about my taxes.', end_of_turn: true, turn_order: 0 });
      await vi.advanceTimersByTimeAsync(20_000);
      expect(userTexts()).toEqual(['I have been thinking about my taxes.']);
      expect(sttSockets()).toHaveLength(2);
      expect(types()).not.toContain('session.error');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('FastSocket: paused listening ("Hey Stay" wakes it)', () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const userTexts = () => events.filter((e) => e.type === 'transcript.user').map((e) => e.text);
  const pause = (s: FastSocket, on = true) => s.send(JSON.stringify({ type: 'listening.pause', on }));

  it('while paused nothing is answered, shown or remembered; "Hey Stay" resumes and is not answered itself', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay, one small step.')));
    const { s, stt } = await open();
    pause(s);
    events.length = 0;
    stt.push({ type: 'SpeechStarted', timestamp: 1 });
    stt.push({ type: 'Turn', transcript: 'Let me tell my friend about', end_of_turn: false, turn_order: 0 });
    stt.push({ type: 'Turn', transcript: 'Let me tell my friend about my day.', end_of_turn: true, turn_order: 0 });
    await tick(20);
    expect(events).toEqual([]); // not even a "listening" flicker
    expect(fetchMock).not.toHaveBeenCalled();
    stt.push({ type: 'Turn', transcript: 'Hey, Stay.', end_of_turn: true, turn_order: 1 });
    stt.push({ type: 'Turn', transcript: 'Hey, Stay.', end_of_turn: true, turn_order: 1, turn_is_formatted: true }); // the formatted re-send
    await tick(20);
    expect(types()).toEqual(['listening.resumed']);
    expect(fetchMock).not.toHaveBeenCalled();
    // awake again: the next turn is answered, and the paused talk never reached the model
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: true, turn_order: 2 });
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].body as string).not.toContain('my friend');
    expect(userTexts()).toEqual(['I keep avoiding my taxes.']);
  });

  it('"resume" and "stay listen" wake it too; a sentence that merely contains the word does not', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay.')));
    const { s, stt } = await open();
    pause(s);
    events.length = 0;
    stt.push({ type: 'Turn', transcript: 'I need to update my resume before Friday.', end_of_turn: true, turn_order: 0 });
    await tick(10);
    expect(events).toEqual([]);
    stt.push({ type: 'Turn', transcript: 'Resume.', end_of_turn: true, turn_order: 1 });
    await tick(10);
    expect(types()).toEqual(['listening.resumed']);
    pause(s);
    events.length = 0;
    stt.push({ type: 'Turn', transcript: 'Stay, listen.', end_of_turn: true, turn_order: 2 });
    await tick(10);
    expect(types()).toEqual(['listening.resumed']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un-pausing from the app lets the next turn through', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay.')));
    const { s, stt } = await open();
    pause(s);
    pause(s, false);
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my taxes.', end_of_turn: true, turn_order: 0 });
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('pausing drops a turn that was being held, so nothing is answered after the pause', async () => {
    fetchMock.mockImplementation(async () => sse(text('Okay.')));
    const { s, stt } = await open({ holdMs: 40 });
    stt.push({ type: 'Turn', transcript: 'I keep avoiding my', end_of_turn: true, turn_order: 0 }); // trails off: held a moment in case the sentence goes on
    pause(s);
    await wait(300); // the hold would have answered it by now
    expect(fetchMock).not.toHaveBeenCalled();
    expect(userTexts()).toEqual([]);
  });
});
