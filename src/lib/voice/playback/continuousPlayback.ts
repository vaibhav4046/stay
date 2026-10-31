import { Pcm16Decoder } from './pcm16';
import { StreamingResampler } from './sampleRateConverter';
import { PlaybackEpoch } from './epochs';

export interface PlaybackTelemetry {
  state: 'BUFFERING' | 'PLAYING' | 'DRAINING' | 'STOPPED';
  bufferedMs: number;
  renderedSamples: number;
  underflowCount: number;
  overflowCount: number;
  rms: number;
  peak: number;
}

export interface EnqueueMeta {
  sessionEpoch?: number;
  replyEpoch?: number;
  sampleRate?: number;
  sequence?: number;
  provider?: string;
  flushId?: number;
}

export class ContinuousPcmPlayer {
  private ctx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private decoder = new Pcm16Decoder();
  private resampler: StreamingResampler | null = null;
  readonly epochs = new PlaybackEpoch();

  private fallbackMode = false;
  private fallbackNextTime = 0;
  private fallbackSources = new Set<AudioBufferSourceNode>();

  private telemetry: PlaybackTelemetry = {
    state: 'STOPPED',
    bufferedMs: 0,
    renderedSamples: 0,
    underflowCount: 0,
    overflowCount: 0,
    rms: 0,
    peak: 0,
  };

  private firstAudioTimestamp: number | null = null;
  private replyStartTimestamp: number | null = null;
  private onTelemetryCallback: ((t: PlaybackTelemetry) => void) | null = null;
  private onAudioRenderedCallback: ((float32: Float32Array, sampleRate: number) => void) | null = null;

  async init(
    ctx: AudioContext,
    options?: {
      onTelemetry?: (t: PlaybackTelemetry) => void;
      onAudioRendered?: (float32: Float32Array, sampleRate: number) => void;
      analyser?: AnalyserNode;
      destinationNode?: AudioNode;
    }
  ): Promise<boolean> {
    this.ctx = ctx;
    this.onTelemetryCallback = options?.onTelemetry ?? null;
    this.onAudioRenderedCallback = options?.onAudioRendered ?? null;
    this.analyserNode = options?.analyser ?? null;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 1.0;

    // Connect gain directly to destination or provided master playback gain node
    const targetDest = options?.destinationNode ?? ctx.destination;
    this.gainNode.connect(targetDest);

    // Feed analyser for visualization (lip-sync, orb bands, wave ribbons).
    // CRITICAL: NEVER connect this.analyserNode to targetDest / ctx.destination!
    // An AnalyserNode does NOT require an output connection to compute FFT or time-domain data.
    // If connected to destination, any other audio routed to the analyser (e.g. microphone)
    // is piped straight to the speakers, causing severe mic loopback, echo, and acoustic feedback.
    if (this.analyserNode) {
      this.gainNode.connect(this.analyserNode);
    }

    try {
      if (typeof ctx.audioWorklet?.addModule === 'function') {
        await ctx.audioWorklet.addModule('/worklets/stay-pcm-playback-processor.js');
        this.workletNode = new AudioWorkletNode(ctx, 'stay-pcm-playback-processor');

        this.workletNode.port.onmessage = (e) => {
          const msg = e.data;
          if (msg?.type === 'telemetry') {
            this.telemetry = {
              state: msg.state,
              bufferedMs: msg.bufferedMs,
              renderedSamples: msg.renderedSamples,
              underflowCount: msg.underflowCount,
              overflowCount: msg.overflowCount,
              rms: msg.rms,
              peak: msg.peak,
            };
            if (this.telemetry.state === 'PLAYING' && this.firstAudioTimestamp === null) {
              this.firstAudioTimestamp = performance.now();
            }
            this.onTelemetryCallback?.(this.telemetry);
          }
        };

        this.workletNode.connect(this.gainNode);
        this.fallbackMode = false;
        return true;
      }
    } catch {
      // AudioWorklet unavailable or failed to load; fall back gracefully
    }

    this.fallbackMode = true;
    return false;
  }

  isFallback(): boolean {
    return this.fallbackMode;
  }

  /**
   * Enqueue a PCM16 chunk (base64 string or Uint8Array/ArrayBuffer)
   */
  enqueuePcm16(input: string | Uint8Array | ArrayBuffer, meta?: EnqueueMeta): void {
    const sEpoch = meta?.sessionEpoch ?? this.epochs.sessionEpoch;
    const rEpoch = meta?.replyEpoch ?? this.epochs.replyEpoch;

    // Discard stale or canceled generations
    if (!this.epochs.isValid(sEpoch, rEpoch)) {
      return;
    }

    if (this.replyStartTimestamp === null) {
      this.replyStartTimestamp = performance.now();
    }

    const pcm16 = this.decoder.decode(input);
    if (pcm16.length === 0) return;

    const sourceRate = meta?.sampleRate ?? 24000;
    const targetRate = this.ctx?.sampleRate ?? sourceRate;

    // Stateful resampler
    if (!this.resampler || this.resampler.sourceRate !== sourceRate || this.resampler.targetRate !== targetRate) {
      this.resampler = new StreamingResampler(sourceRate, targetRate);
    }

    const rawFloat32 = Pcm16Decoder.toFloat32(pcm16);
    const resampledFloat32 = this.resampler.process(rawFloat32);

    if (resampledFloat32.length === 0) return;

    this.onAudioRenderedCallback?.(resampledFloat32, targetRate);

    if (!this.fallbackMode && this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'enqueue',
        samples: resampledFloat32,
        sessionEpoch: sEpoch,
        replyEpoch: rEpoch,
      });
    } else if (this.ctx) {
      this.scheduleFallbackChunk(resampledFloat32, targetRate);
    }
  }

  private scheduleFallbackChunk(float32: Float32Array, sampleRate: number): void {
    if (!this.ctx || !this.gainNode) return;
    const buffer = this.ctx.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    // Bounded prebuffer for fallback (80ms minimum lookahead)
    const now = this.ctx.currentTime;
    const startAt = Math.max(now + 0.08, this.fallbackNextTime);
    source.start(startAt);
    this.fallbackNextTime = startAt + buffer.duration;

    this.fallbackSources.add(source);
    source.onended = () => {
      this.fallbackSources.delete(source);
    };
  }

  markReplyEnd(meta?: { replyEpoch?: number }): void {
    const rEpoch = meta?.replyEpoch ?? this.epochs.replyEpoch;
    if (rEpoch !== this.epochs.replyEpoch) return;

    if (!this.fallbackMode && this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'markEnd',
        sessionEpoch: this.epochs.sessionEpoch,
        replyEpoch: rEpoch,
      });
    }
  }

  cancelReply(reason = 'barge-in'): void {
    const nextEpoch = this.epochs.cancelReply();
    this.decoder.reset();
    this.resampler?.reset();
    this.firstAudioTimestamp = null;
    this.replyStartTimestamp = null;

    if (!this.fallbackMode && this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'cancel',
        sessionEpoch: this.epochs.sessionEpoch,
        replyEpoch: nextEpoch,
        reason,
      });
    } else {
      for (const src of this.fallbackSources) {
        try {
          src.stop();
          src.disconnect();
        } catch {
          // ignore
        }
      }
      this.fallbackSources.clear();
      this.fallbackNextTime = 0;
    }
  }

  setOutputMuted(muted: boolean): void {
    if (!this.fallbackMode && this.workletNode) {
      this.workletNode.port.postMessage({ type: 'setMuted', muted });
    } else if (this.gainNode && this.ctx) {
      this.gainNode.gain.setValueAtTime(muted ? 0 : 1, this.ctx.currentTime);
    }
  }

  getBufferedMs(): number {
    return this.telemetry.bufferedMs;
  }

  getRenderedSamples(): number {
    return this.telemetry.renderedSamples;
  }

  getUnderflowCount(): number {
    return this.telemetry.underflowCount;
  }

  getOverflowCount(): number {
    return this.telemetry.overflowCount;
  }

  getFirstAudibleLatency(): number | null {
    if (this.firstAudioTimestamp !== null && this.replyStartTimestamp !== null) {
      return Math.round(this.firstAudioTimestamp - this.replyStartTimestamp);
    }
    return null;
  }

  getPlaybackPositionMs(): number {
    if (!this.ctx) return 0;
    return Math.round((this.telemetry.renderedSamples / this.ctx.sampleRate) * 1000);
  }

  getLastOutputRms(): number {
    return this.telemetry.rms;
  }

  stop(): void {
    this.cancelReply('stopped');
  }

  destroy(): void {
    this.stop();
    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      this.workletNode = null;
    }
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // ignore
      }
      this.gainNode = null;
    }
    this.ctx = null;
  }
}
