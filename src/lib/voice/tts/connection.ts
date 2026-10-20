import { TTS_CLOSED, TTS_OPEN, type TtsConnection } from './types';

type Json = Record<string, unknown>;

/**
 * Base for the engines that are not AssemblyAI. It speaks the AssemblyAI TTS socket's protocol toward FastSocket:
 * Generate adds text, Flush starts speaking what was added, Cancel drops everything (and is always acknowledged with
 * Cancelled, which FastSocket counts), Terminate closes. Subclasses implement `speak` and `halt`.
 */
export abstract class ProtocolTts implements TtsConnection {
  readyState = 0;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  private pending = '';
  private flushCounter = 0;
  /** Bumped by Cancel; a subclass's late callbacks compare against it and stay silent when it changed. */
  protected epoch = 0;

  constructor() {
    // FastSocket installs its handlers right after construction, so open on the next microtask.
    queueMicrotask(() => {
      if (this.readyState !== 0) return;
      this.readyState = TTS_OPEN;
      this.emit({ type: 'Begin', id: 'local' });
    });
  }

  /** Speak `text` as flush `flushId`. Must emit Audio (zero or more, in order) and then exactly one FlushDone, unless cancelled. */
  protected abstract speak(flushId: number, text: string, epoch: number): void;
  /** Stop sound and abort work in flight. */
  protected abstract halt(): void;

  protected emit(m: Json): void {
    if (this.readyState !== TTS_OPEN) return;
    this.onmessage?.({ data: JSON.stringify(m) });
  }

  send(raw: string): void {
    if (this.readyState !== TTS_OPEN) return;
    let m: Json;
    try {
      m = JSON.parse(raw) as Json;
    } catch {
      return;
    }
    switch (m.type) {
      case 'Generate':
        if (typeof m.text === 'string') this.pending += (this.pending ? ' ' : '') + m.text;
        break;
      case 'Flush': {
        const id = this.flushCounter++;
        const text = this.pending.trim();
        this.pending = '';
        if (text) this.speak(id, text, this.epoch);
        else this.emit({ type: 'FlushDone', flush_id: id });
        break;
      }
      case 'Cancel':
        this.epoch++;
        this.pending = '';
        this.halt();
        this.emit({ type: 'Cancelled' });
        break;
      case 'Terminate':
        this.close();
        break;
      default:
        break; // KeepAlive and anything else needs no answer
    }
  }

  close(): void {
    if (this.readyState === TTS_CLOSED) return;
    this.epoch++;
    this.halt();
    this.readyState = TTS_CLOSED;
    this.onclose?.();
  }

  protected fail(code: string): void {
    this.emit({ type: 'Error', error_code: code, error: `speech engine error: ${code}` });
  }
}
