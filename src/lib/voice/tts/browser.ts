import { ProtocolTts } from './connection';

/**
 * The device's own speechSynthesis voice. Honest limits, all inherent to the browser API:
 *  - it gives no audio samples, so the orb's real-audio lip sync cannot follow it (Stay shows the speaking state only);
 *  - it plays where the microphone can hear it, so `muteMic` is true while it talks and the person cannot interrupt by voice;
 *  - voices differ by device; an Android or Edge "Natural" voice sounds far better than an older Windows one.
 */
export class BrowserTts extends ProtocolTts {
  private speaking = false;
  private queued = 0;

  constructor(private readonly opts: { locale: string; voiceName?: string; synth?: SpeechSynthesis; rate?: number }) {
    super();
  }

  get muteMic(): boolean {
    return this.speaking || this.queued > 0;
  }

  private get synth(): SpeechSynthesis | undefined {
    return this.opts.synth ?? (typeof window !== 'undefined' ? window.speechSynthesis : undefined);
  }

  protected speak(flushId: number, text: string, epoch: number): void {
    const synth = this.synth;
    if (!synth) {
      this.fail('no_speech_synthesis');
      this.emit({ type: 'FlushDone', flush_id: flushId });
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = this.opts.locale;
    u.rate = this.opts.rate ?? 1;
    const voice = this.opts.voiceName ? synth.getVoices().find((v) => v.name === this.opts.voiceName) : undefined;
    if (voice) u.voice = voice;
    this.queued++;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      this.queued = Math.max(0, this.queued - 1);
      if (this.queued === 0) this.speaking = false;
      if (epoch === this.epoch) this.emit({ type: 'FlushDone', flush_id: flushId });
    };
    u.onstart = () => {
      this.speaking = true;
      // an empty Audio frame tells FastSocket the reply has begun (it tracks the flush range and the speaking state)
      if (epoch === this.epoch) this.emit({ type: 'Audio', audio: '', flush_id: flushId });
    };
    u.onend = finish;
    u.onerror = (e) => {
      // 'canceled' / 'interrupted' come from our own cancel(); anything else is a real failure
      const err = (e as SpeechSynthesisErrorEvent).error;
      if (err !== 'canceled' && err !== 'interrupted' && epoch === this.epoch) this.fail(String(err));
      finish();
    };
    synth.speak(u);
  }

  protected halt(): void {
    this.speaking = false;
    this.queued = 0;
    try {
      this.synth?.cancel();
    } catch {
      // already idle
    }
  }
}
