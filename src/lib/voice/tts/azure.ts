import { ttsHeaders } from '@/lib/byok/config';
import { ProtocolTts } from './connection';

function bytesToB64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

interface Job {
  id: number;
  chunks: string[];
  done: boolean;
}

/**
 * Azure AI Speech through Stay's relay (/api/voice/tts). Each Flush is one request that streams raw 24 kHz PCM back;
 * requests run in parallel so the next sentence is ready before the last one ends, but audio is released strictly in order.
 *
 * Status: written to Microsoft's documented REST API; run against a mocked relay in tests, NOT against a live Azure key.
 */
export class AzureTts extends ProtocolTts {
  private jobs: Job[] = [];
  private aborts = new Set<AbortController>();

  constructor(private readonly opts: { voice: string; locale: string; endpoint?: string; headers?: () => Record<string, string>; fetchImpl?: typeof fetch }) {
    super();
  }

  protected speak(flushId: number, text: string, epoch: number): void {
    const job: Job = { id: flushId, chunks: [], done: false };
    this.jobs.push(job);
    const ctl = new AbortController();
    this.aborts.add(ctl);
    void this.run(job, text, epoch, ctl).finally(() => this.aborts.delete(ctl));
  }

  private async run(job: Job, text: string, epoch: number, ctl: AbortController): Promise<void> {
    const f = this.opts.fetchImpl ?? fetch;
    let carry: Uint8Array | null = null;
    try {
      const res = await f(this.opts.endpoint ?? '/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.opts.headers ? this.opts.headers() : ttsHeaders()) },
        body: JSON.stringify({ text, voice: this.opts.voice, locale: this.opts.locale }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) {
        if (epoch === this.epoch) {
          this.fail(String(res.status));
          job.done = true; // a failed sentence is skipped so the reply still completes
          this.pump();
        }
        return;
      }
      const reader = res.body.getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (epoch !== this.epoch) return;
        if (done) break;
        if (!value || value.length === 0) continue;
        // 16-bit samples must not be split across chunks
        let buf: Uint8Array = value;
        if (carry) {
          const joined = new Uint8Array(carry.length + value.length);
          joined.set(carry);
          joined.set(value, carry.length);
          buf = joined;
          carry = null;
        }
        if (buf.length % 2) {
          carry = buf.slice(buf.length - 1);
          buf = buf.subarray(0, buf.length - 1);
        }
        if (buf.length) job.chunks.push(bytesToB64(buf));
        this.pump();
      }
    } catch {
      if (epoch === this.epoch) {
        this.fail('network');
        job.done = true;
        this.pump();
      }
      return;
    }
    if (epoch !== this.epoch) return;
    job.done = true;
    this.pump();
  }

  /** Release audio and completions in flush order. */
  private pump(): void {
    for (;;) {
      const head = this.jobs[0];
      if (!head) return;
      while (head.chunks.length) this.emit({ type: 'Audio', audio: head.chunks.shift(), flush_id: head.id });
      if (!head.done) return;
      this.jobs.shift();
      this.emit({ type: 'FlushDone', flush_id: head.id });
    }
  }

  protected halt(): void {
    this.jobs = [];
    for (const c of this.aborts) c.abort();
    this.aborts.clear();
  }
}
