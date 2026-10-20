import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FastSocket, quickConfirmation } from '@/lib/voice/fastSocket';

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
  const s = new FastSocket({ sttToken: 'stt', ttsToken: 'tts', holdMs: opts.holdMs ?? 60, interruptHoldMs: opts.holdMs ?? 60, warmUp: false });
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


const turn = (stt: FakeWS, order: number, t: string) => stt.push({ type: 'Turn', transcript: t, end_of_turn: true, turn_order: order });
const spokenTexts = (tts: FakeWS) => tts.sent.filter((d): d is string => typeof d === 'string').map((d) => JSON.parse(d)).filter((m) => m.type === 'Generate').map((m) => m.text);

describe('agentic additions to FastSocket', () => {
  it('capture mode: every turn is transcribed for the app, but the model is never called and nothing is said', async () => {
    const { s, stt, tts } = await open();
    s.send(JSON.stringify({ type: 'capture.mode', on: true }));
    turn(stt, 0, 'I need to call mum and the bins.');
    turn(stt, 1, 'Also the landlord email.');
    await tick(20);
    expect(events.filter((e) => e.type === 'transcript.user').map((e) => e.text)).toEqual(['I need to call mum and the bins.', 'Also the landlord email.']);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(spokenTexts(tts)).toEqual([]);
    expect(types()).not.toContain('reply.started');
  });

  it('capture mode off: the next turn is answered normally, and the captured turns are not in the history', async () => {
    fetchMock.mockResolvedValue(sse(text('Okay, start with the bins.')));
    const { s, stt } = await open();
    s.send(JSON.stringify({ type: 'capture.mode', on: true }));
    turn(stt, 0, 'I need to call mum.');
    await tick(10);
    s.send(JSON.stringify({ type: 'capture.mode', on: false }));
    turn(stt, 1, 'What should I do first?');
    await tick(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages.filter((m: { role: string }) => m.role === 'user').map((m: { content: string }) => m.content)).toEqual(['What should I do first?']);
  });

  it('reply.say speaks the exact words, with no model call', async () => {
    const { s, tts } = await open();
    s.send(JSON.stringify({ type: 'reply.say', text: 'Start with the bins, about five minutes.' }));
    await tick(20);
    expect(spokenTexts(tts)).toEqual(['Start with the bins, about five minutes.']);
    expect(events.find((e) => e.type === 'transcript.agent')?.text).toBe('Start with the bins, about five minutes.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a tool result can carry its own truthful line (quick:true), English only; otherwise the old rules hold', () => {
    const r = JSON.stringify({ ok: true, quick: true, say: 'Moved the bins to later.' });
    expect(quickConfirmation('list_edit', r, 'english')).toBe('Moved the bins to later.');
    expect(quickConfirmation('list_edit', r, 'spanish')).toBeNull(); // no fixed phrase for list_edit: the model answers in Spanish
    expect(quickConfirmation('park', r, 'spanish')).toBe('Guardado para después.');
    expect(quickConfirmation('list_edit', JSON.stringify({ ok: false, quick: true, say: 'x' }), 'english')).toBeNull();
    expect(quickConfirmation('list_edit', JSON.stringify({ ok: true, say: 'no flag' }), 'english')).toBeNull();
  });
});
