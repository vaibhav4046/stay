/**
 * Fast voice: a WebSocket-shaped object that speaks the same server events as the AssemblyAI Voice Agent, but is built
 * from three parts: AssemblyAI streaming speech-to-text, a chat model of the person's choice (through /api/voice/chat),
 * and AssemblyAI streaming text-to-speech. Because it emits the Voice Agent's events (input.speech.started,
 * transcript.user, reply.audio, tool.call, ...), the rest of the voice hook is unchanged.
 *
 * Why: measured from the true end of speech, the Voice Agent took about 2.5 s; speech-to-text 0.9 s + first model token
 * 0.3 s + first synthesized audio 0.2 s add up to about 1.4 s. This class is how that sum is realised and checked.
 */
import { byokHeaders } from '@/lib/byok/config';

export interface FastSocketConfig {
  sttToken: string;
  ttsToken: string;
  /** Mic format: 24 kHz mono 16-bit little-endian (what pcm-processor.js produces). */
  sampleRate?: number;
  /** How long to wait after a turn that trails off ("and, uh,") before answering. Default 2200 ms. */
  holdMs?: number;
  /** Ping the chat route when the session starts so the first reply is not slowed by a cold function. Default true. */
  warmUp?: boolean;
}

export interface FastSession {
  systemPrompt: string;
  greeting: string;
  voice: string;
  /** AssemblyAI TTS language name: english, spanish, french, german, italian, portuguese */
  ttsLanguage: string;
  tools: boolean;
}

type Json = Record<string, unknown>;
type ChatMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: unknown[]; tool_call_id?: string };

export const FAST_TTS_LANGUAGE: Record<string, string> = { en: 'english', es: 'spanish', fr: 'french', de: 'german', it: 'italian', pt: 'portuguese' };
/**
 * Actions whose result needs no explaining: after the app confirms it did them, Stay says one short line straight away
 * instead of waiting for a second model call (about 1.3 s saved on every spoken command).
 */
const QUICK_KIND: Record<string, 'done' | 'parked' | 'saved' | 'added'> = {
  list_add: 'added', dump: 'done', remind: 'done', park: 'parked', memory_add: 'saved', timer_start: 'done', timer_stop: 'done', color: 'done', shape: 'done', open: 'done', quiet: 'done', pause: 'done', ground: 'done', game: 'done',
};
const QUICK_PHRASE: Record<string, Record<'done' | 'parked' | 'saved' | 'added', string>> = {
  english: { done: 'Done.', parked: 'Parked.', saved: 'Got it, I will remember.', added: 'Added.' },
  spanish: { done: 'Hecho.', parked: 'Guardado para después.', saved: 'Entendido, lo recordaré.', added: 'Añadido.' },
  french: { done: "C'est fait.", parked: 'Mis de côté.', saved: "Compris, je m'en souviendrai.", added: 'Ajouté.' },
  german: { done: 'Erledigt.', parked: 'Zurückgestellt.', saved: 'Verstanden, ich merke es mir.', added: 'Hinzugefügt.' },
  italian: { done: 'Fatto.', parked: 'Messo da parte.', saved: 'Capito, me lo ricordo.', added: 'Aggiunto.' },
  portuguese: { done: 'Feito.', parked: 'Guardado para depois.', saved: 'Entendi, vou lembrar.', added: 'Adicionado.' },
};
export function quickConfirmation(action: unknown, resultJson: string, ttsLanguage: string): string | null {
  const kind = typeof action === 'string' ? QUICK_KIND[action] : undefined;
  if (!kind) return null;
  try {
    if ((JSON.parse(resultJson) as { ok?: boolean }).ok !== true) return null;
  } catch {
    return null;
  }
  return (QUICK_PHRASE[ttsLanguage] ?? QUICK_PHRASE.english)[kind];
}

const STT_URL = 'wss://streaming.assemblyai.com/v3/ws';
const TTS_URL = 'wss://streaming-tts.assemblyai.com/v1/ws';
const MAX_HISTORY = 14;

/** Splits streamed text into speakable chunks: a sentence end followed by space, once there is enough to say. */
export function takeSpeakable(buffer: string, first = false): { chunk: string; rest: string } | null {
  // the first chunk of a reply may end at a comma or dash so speech starts a beat sooner; later chunks wait for a sentence end
  const m = (first ? /^([\s\S]{14,}?[.!?…。！？,;:—])(\s+|$)/ : /^([\s\S]{18,}?[.!?…。！？])(\s+|$)/).exec(buffer);
  if (!m) return null;
  return { chunk: m[1].trim(), rest: buffer.slice(m[0].length) };
}

/**
 * True when a finished turn sounds unfinished: it ends on a filler ("um", "uh"), a connector ("and", "but", "because"), an
 * article or preposition, or trailing punctuation like a comma or an ellipsis. A full stop, question mark or exclamation
 * mark means the person is done. People with ADHD pause mid-thought; Stay waits instead of talking into the pause.
 */
export function soundsUnfinished(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/[.?!。！？]["')\]]?$/.test(t) && !/\.{2,}$|…$/.test(t)) return false;
  if (/[,;:…-]$/.test(t) || /\.{2,}$/.test(t)) return true;
  return /\b(?:um+|uh+|er+m?|ah+|hmm+|mm+|like|and|but|so|because|cause|or|then|if|that|which|to|the|a|an|my|of|for|with|about|maybe|just|i|i'm|i've|it's)$/i.test(t);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class FastSocket {
  static readonly OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  private cfg: Required<FastSocketConfig>;
  private session: FastSession | null = null;
  private notes: string[] = [];
  private history: ChatMessage[] = [];
  private stt: WebSocket | null = null;
  private tts: WebSocket | null = null;
  private inUserTurn = false;
  private lastTurnOrder = -1;
  private genId = 0;
  private abort: AbortController | null = null;
  // The server numbers flushes itself and may report several as one FlushDone, so completion is tracked by id range,
  // and audio from a cancelled reply is recognised by the server's Cancelled acknowledgement, not by counting.
  private sentFlushes = 0;
  private replyBaseId: number | null = null;
  private lastDoneId = -1;
  private staleCancels = 0;
  private llmDone = false;
  private spoken = '';
  private toolWaiters = new Map<string, (r: string) => void>();
  private closed = false;
  private agentSpeaking = false;
  private carry = ''; // an unfinished thought, held while the person hesitates
  private holdTimer: ReturnType<typeof setTimeout> | undefined;
  private holds = 0;

  constructor(cfg: FastSocketConfig) {
    this.cfg = { sampleRate: 24000, holdMs: 2200, warmUp: true, ...cfg };
    queueMicrotask(() => {
      this.readyState = FastSocket.OPEN;
      this.onopen?.();
    });
  }

  // ---- WebSocket-like surface -------------------------------------------------------------------------------------

  send(raw: string): void {
    let m: Json;
    try {
      m = JSON.parse(raw) as Json;
    } catch {
      return;
    }
    switch (m.type) {
      case 'session.update':
        void this.start((m.session || {}) as Json);
        break;
      case 'input.audio':
        if (this.stt?.readyState === WebSocket.OPEN && typeof m.audio === 'string') this.stt.send(b64ToBytes(m.audio));
        break;
      case 'conversation.message':
        if (typeof m.content === 'string') this.notes = [...this.notes.slice(-4), m.content.slice(0, 300)];
        break;
      case 'reply.create':
        void this.generate(typeof m.instructions === 'string' ? m.instructions : undefined);
        break;
      case 'tool.result': {
        const w = this.toolWaiters.get(String(m.call_id));
        if (w) {
          this.toolWaiters.delete(String(m.call_id));
          w(typeof m.result === 'string' ? m.result : JSON.stringify(m.result ?? {}));
        }
        break;
      }
      case 'session.end':
        this.close();
        break;
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.cancel();
    for (const s of [this.stt, this.tts]) {
      try {
        if (s?.readyState === WebSocket.OPEN) s.send(JSON.stringify({ type: 'Terminate' }));
        s?.close();
      } catch {
        // already gone
      }
    }
    this.readyState = 3;
    this.onclose?.();
  }

  // ---- internals --------------------------------------------------------------------------------------------------

  private emit(m: Json): void {
    if ((globalThis as { __stayFastDebug?: boolean }).__stayFastDebug && m.type !== 'reply.audio') console.debug('[fast]', Math.round(performance.now()), m.type, typeof m.text === 'string' ? m.text.slice(0, 60) : m.type === 'tool.call' ? JSON.stringify(m.arguments).slice(0, 80) : '');
    if (!this.closed) this.onmessage?.({ data: JSON.stringify(m) });
  }

  private fail(code: string): void {
    this.emit({ type: 'session.error', code, message: 'fast voice connection failed' });
    this.close();
  }

  private async start(session: Json): Promise<void> {
    this.session = {
      systemPrompt: String(session.system_prompt || ''),
      greeting: String(session.greeting || ''),
      voice: String((session.output as Json | undefined)?.voice || 'anna'),
      ttsLanguage: String((session as Json).tts_language || 'english'),
      tools: Array.isArray(session.tools) && session.tools.length > 0,
    };
    try {
      await Promise.all([this.openStt(), this.openTts()]);
    } catch {
      return this.fail('connection_failed');
    }
    this.emit({ type: 'session.ready' });
    if (this.cfg.warmUp) void fetch('/api/voice/chat', { method: 'GET' }).catch(() => undefined); // warm the function while the greeting plays
    if (this.session.greeting) void this.speakOnly(this.session.greeting);
  }

  private openStt(): Promise<void> {
    return new Promise((resolve, reject) => {
      const q = new URLSearchParams({ sample_rate: String(this.cfg.sampleRate), encoding: 'pcm_s16le', speech_model: 'universal-3-6-pro', token: this.cfg.sttToken });
      const ws = new WebSocket(`${STT_URL}?${q}`);
      this.stt = ws;
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return;
        const m = JSON.parse(e.data) as Json;
        if (m.type === 'Begin') resolve();
        else if (m.type === 'Turn') this.onTurn(m);
        else if (m.type === 'Error') this.fail('stt_error');
      };
      ws.onerror = () => reject(new Error('stt'));
      ws.onclose = () => {
        if (!this.closed) this.fail('stt_closed');
      };
    });
  }

  private openTts(): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = this.session as FastSession;
      const q = new URLSearchParams({ token: this.cfg.ttsToken, voice: s.voice, language: s.ttsLanguage });
      const ws = new WebSocket(`${TTS_URL}?${q}`);
      this.tts = ws;
      ws.onmessage = (e) => {
        if (typeof e.data !== 'string') return;
        const m = JSON.parse(e.data) as Json;
        if (m.type === 'Begin') resolve();
        else if (m.type === 'Audio' && typeof m.audio === 'string') this.onTtsAudio(m);
        else if (m.type === 'FlushDone') this.onFlushDone(Number(m.flush_id));
        else if (m.type === 'Cancelled') this.staleCancels = Math.max(0, this.staleCancels - 1);
        else if (m.type === 'Error') this.fail('tts_error');
      };
      ws.onerror = () => reject(new Error('tts'));
      ws.onclose = () => {
        if (!this.closed) this.fail('tts_closed');
      };
    });
  }

  /** Streaming transcript -> the Voice Agent's user events. */
  private onTurn(m: Json): void {
    const text = String(m.transcript || '').trim();
    const order = Number(m.turn_order ?? -1);
    if (order >= 0 && order <= this.lastTurnOrder) return; // a late or formatted re-send of a turn already handled
    if (!m.end_of_turn) {
      if (!text) return;
      // Someone starting to talk over Stay (two words, so a cough or echo does not cut it off) stops it.
      if (!this.inUserTurn) {
        if (this.agentSpeaking && text.split(/\s+/).length < 2) return;
        this.inUserTurn = true;
        this.cancel();
        this.emit({ type: 'input.speech.started' });
      }
      if (this.holdTimer) {
        clearTimeout(this.holdTimer);
        this.holdTimer = undefined; // they carried on: it was a pause, not the end
      }
      this.emit({ type: 'transcript.user.delta', text: this.carry ? `${this.carry} ${text}` : text });
      return;
    }
    if (order === this.lastTurnOrder || !text) return; // the formatted re-send of a turn we already handled
    this.lastTurnOrder = order;
    const full = this.carry ? `${this.carry} ${text}` : text;
    if (soundsUnfinished(full) && this.holds < 3) {
      // trailing off: keep the turn open and give them time to finish the thought
      this.holds++;
      this.carry = full;
      this.inUserTurn = true;
      if (this.holdTimer) clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(() => this.finishTurn(order), this.cfg.holdMs);
      return;
    }
    this.carry = full;
    this.finishTurn(order);
  }

  private finishTurn(order: number): void {
    if (this.closed) return;
    const text = this.carry;
    this.carry = '';
    this.holds = 0;
    this.holdTimer = undefined;
    if (!text) return;
    if (!this.inUserTurn) this.emit({ type: 'input.speech.started' });
    this.inUserTurn = false;
    this.emit({ type: 'input.speech.stopped' });
    this.emit({ type: 'transcript.user', text, item_id: `u-${order}` });
    this.history = [...this.history, { role: 'user' as const, content: text }].slice(-MAX_HISTORY);
    void this.generate();
  }

  private cancel(): void {
    this.genId++;
    this.abort?.abort();
    this.abort = null;
    this.sentFlushes = 0;
    this.replyBaseId = null;
    this.lastDoneId = -1;
    this.agentSpeaking = false;
    this.toolWaiters.clear();
    try {
      if (this.tts?.readyState === WebSocket.OPEN) {
        this.tts.send(JSON.stringify({ type: 'Cancel' }));
        this.staleCancels++;
      }
    } catch {
      // closing
    }
  }

  private onTtsAudio(m: Json): void {
    if (this.staleCancels > 0) return; // audio of a reply that was cancelled, still in flight
    if (this.replyBaseId === null) this.replyBaseId = Number(m.flush_id);
    this.agentSpeaking = true;
    this.emit({ type: 'reply.audio', data: m.audio });
  }

  private onFlushDone(flushId: number): void {
    if (this.staleCancels > 0) return;
    this.lastDoneId = Math.max(this.lastDoneId, flushId);
    this.maybeFinish();
  }

  private say(text: string, gen: number): void {
    if (!text || gen !== this.genId || this.tts?.readyState !== WebSocket.OPEN) return;
    if (this.spoken === '') this.emit({ type: 'reply.started' });
    this.spoken += (this.spoken ? ' ' : '') + text;
    this.sentFlushes++;
    this.tts.send(JSON.stringify({ type: 'Generate', text }));
    this.tts.send(JSON.stringify({ type: 'Flush' }));
  }

  private maybeFinish(): void {
    if (!this.llmDone || this.spoken === '') return;
    const allDone = this.replyBaseId === null ? this.lastDoneId >= 0 : this.lastDoneId >= this.replyBaseId + this.sentFlushes - 1;
    if (!allDone) return;
    const text = this.spoken;
    this.spoken = '';
    this.sentFlushes = 0;
    this.replyBaseId = null;
    this.lastDoneId = -1;
    this.agentSpeaking = false;
    this.history = [...this.history, { role: 'assistant' as const, content: text }].slice(-MAX_HISTORY);
    this.emit({ type: 'transcript.agent', text, item_id: `a-${Date.now()}` });
    this.emit({ type: 'reply.done' });
  }

  private speakOnly(text: string): void {
    const gen = ++this.genId;
    this.llmDone = true;
    this.spoken = '';
    this.sentFlushes = 0;
    this.replyBaseId = null;
    this.lastDoneId = -1;
    this.say(text, gen);
  }

  /** One model turn: stream the reply into speech, run at most one app tool, then speak the confirmation. */
  private async generate(extraInstruction?: string, toolFollowUp = false): Promise<void> {
    const gen = ++this.genId;
    const ctl = new AbortController();
    this.abort?.abort();
    this.abort = ctl;
    this.llmDone = false;
    this.spoken = toolFollowUp ? this.spoken : '';
    const s = this.session as FastSession;
    const system = [s.systemPrompt, ...this.notes].filter(Boolean).join('\n');
    const messages: ChatMessage[] = [{ role: 'system', content: system }, ...this.history, ...(extraInstruction ? [{ role: 'system' as const, content: extraInstruction }] : [])];

    let res: Response;
    try {
      res = await fetch('/api/voice/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...byokHeaders() },
        body: JSON.stringify({ messages, withTools: s.tools && !toolFollowUp }),
        signal: ctl.signal,
      });
    } catch {
      if (gen === this.genId) this.finishSilently();
      return;
    }
    if (gen !== this.genId) return;
    if (!res.ok || !res.body || (res.headers.get('content-type') || '').includes('application/json')) {
      // a safety gate answered instead of the model (the hook already shows the right screen), or the model was unavailable
      return this.finishSilently();
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let line = '';
    let pendingText = '';
    const calls = new Map<number, { id: string; name: string; args: string }>();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (gen !== this.genId) return void reader.cancel();
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (line of lines) {
          if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
          let delta: { content?: string; tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }> } | undefined;
          try {
            delta = JSON.parse(line.slice(6)).choices?.[0]?.delta;
          } catch {
            continue;
          }
          if (delta?.content) {
            pendingText += delta.content;
            for (let part = takeSpeakable(pendingText, this.spoken === ''); part; part = takeSpeakable(pendingText, this.spoken === '')) {
              pendingText = part.rest;
              this.say(part.chunk, gen);
            }
          }
          for (const tc of delta?.tool_calls || []) {
            const cur = calls.get(tc.index) || { id: '', name: '', args: '' };
            calls.set(tc.index, { id: tc.id || cur.id, name: tc.function?.name || cur.name, args: cur.args + (tc.function?.arguments || '') });
          }
        }
      }
    } catch {
      if (gen !== this.genId) return;
    }
    if (gen !== this.genId) return;
    if (pendingText.trim()) this.say(pendingText.trim(), gen);

    const call = [...calls.values()].find((c) => c.name);
    if (call) {
      const id = call.id || `call-${Date.now()}`;
      let args: Json = {};
      try {
        args = call.args ? (JSON.parse(call.args) as Json) : {};
      } catch {
        // malformed arguments: run with none, the handler reports what is missing
      }
      this.history = [...this.history, { role: 'assistant' as const, content: null, tool_calls: [{ id, type: 'function', function: { name: call.name, arguments: call.args || '{}' } }] }].slice(-MAX_HISTORY);
      const result = new Promise<string>((resolve) => this.toolWaiters.set(id, resolve));
      this.emit({ type: 'tool.call', call_id: id, name: call.name, arguments: args });
      const out = await Promise.race([result, new Promise<string>((r) => setTimeout(() => r('{"ok":true}'), 4000))]);
      if (gen !== this.genId) return;
      this.history = [...this.history, { role: 'tool' as const, tool_call_id: id, content: out.slice(0, 1500) }].slice(-MAX_HISTORY);
      const quick = quickConfirmation(args.action, out, s.ttsLanguage);
      if (quick) {
        this.llmDone = true;
        this.say(quick, gen);
        return;
      }
      return void this.generate(undefined, true);
    }

    this.llmDone = true;
    if (this.spoken === '' && toolFollowUp) {
      // the action ran but the model had nothing to add: never leave the person in silence after a command
      this.say((QUICK_PHRASE[s.ttsLanguage] ?? QUICK_PHRASE.english).done, gen);
      return;
    }
    if (this.spoken === '') return this.finishSilently();
    this.maybeFinish();
  }

  private finishSilently(): void {
    this.llmDone = true;
    this.spoken = '';
    this.agentSpeaking = false;
    this.emit({ type: 'reply.done' });
  }
}
