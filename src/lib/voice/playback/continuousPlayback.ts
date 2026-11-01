import { Pcm16Decoder } from './pcm16';
import { StreamingResampler } from './sampleRateConverter';
import { PlaybackEpoch } from './epochs';

export interface PlaybackTelemetry {
  state: 'BUFFERING' | 'PLAYING' | 'DRAINING' | 'STOPPED';
  bufferedMs: number;
  prebufferMs?: number;
  backpressure?: boolean;
  renderedSamples: number;
  underflows: number;
  underflowCount: number;
  overflows: number;
  overflowCount: number;
  staleDropped: number;
  dupDropped: number;
  fadeCount?: number;
  lastNonZeroAt: number;
  rms: number;
  peak: number;
}

export interface EnqueueMeta {
  sessionEpoch?: number;
  replyEpoch?: number;
  sampleRate?: number;
  sequence?: number;
  seq?: number;
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
  private autoSeq = 0;

  private telemetry: PlaybackTelemetry = {
    state: 'STOPPED',
    bufferedMs: 0,
    prebufferMs: 100,
    backpressure: false,
    renderedSamples: 0,
    underflows: 0,
    underflowCount: 0,
    overflows: 0,
    overflowCount: 0,
    staleDropped: 0,
    dupDropped: 0,
    fadeCount: 0,
    lastNonZeroAt: 0,
    rms: 0,
    peak: 0,
  };

  private firstRenderTimestamp: number | null = null;
  private replyEnqueueStartTimestamp: number | null = null;
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

    const targetDest = options?.destinationNode ?? ctx.destination;
    this.gainNode.connect(targetDest);

    // Feed analyser for visualization without connecting analyser to destination (prevents mic feedback loop)
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
              prebufferMs: msg.prebufferMs ?? 100,
              backpressure: Boolean(msg.backpressure || msg.bufferedMs > 20000),
              renderedSamples: msg.renderedSamples,
              underflows: msg.underflows ?? msg.underflowCount ?? 0,
              underflowCount: msg.underflowCount ?? msg.underflows ?? 0,
              overflows: msg.overflows ?? msg.overflowCount ?? 0,
              overflowCount: msg.overflowCount ?? msg.overflows ?? 0,
              staleDropped: msg.staleDropped ?? 0,
              dupDropped: msg.dupDropped ?? 0,
              fadeCount: msg.fadeCount ?? 0,
              lastNonZeroAt: msg.lastNonZeroAt ?? 0,
              rms: msg.rms,
              peak: msg.peak,
            };
            if (this.telemetry.state === 'PLAYING' && this.firstRenderTimestamp === null) {
              this.firstRenderTimestamp = performance.now();
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

  isBackpressured(): boolean {
    return this.telemetry.bufferedMs > 20000;
  }

  /**
   * Enqueue a PCM16 chunk (base64 string or Uint8Array/ArrayBuffer) with { replyEpoch, seq }.
   */
  enqueuePcm16(input: string | Uint8Array | ArrayBuffer, meta?: EnqueueMeta): void {
    const sEpoch = meta?.sessionEpoch ?? this.epochs.sessionEpoch;
    const rEpoch = meta?.replyEpoch ?? this.epochs.replyEpoch;

    if (!this.epochs.isValid(sEpoch, rEpoch)) {
      this.telemetry.staleDropped++;
      return;
    }

    const seq = meta?.seq ?? meta?.sequence ?? this.autoSeq++;

    if (this.replyEnqueueStartTimestamp === null) {
      this.replyEnqueueStartTimestamp = performance.now();
    }

    const pcm16 = this.decoder.decode(input);
    if (pcm16.length === 0) return;

    const sourceRate = meta?.sampleRate ?? 24000;
    const targetRate = this.ctx?.sampleRate ?? sourceRate;

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
        seq,
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

    const now = this.ctx.currentTime;
    const startAt = Math.max(now + 0.08, this.fallbackNextTime);
    source.start(startAt);
    this.fallbackNextTime = startAt + buffer.duration;

    this.fallbackSources.add(source);
    source.onended = () => {
      this.fallbackSources.delete(source);
    };
  }

  /**
   * §6.3.1 — Duck playback to -18 dB within one audio render quantum when SpeechStarted arrives.
   */
  setDucked(ducked: boolean): void {
    const targetLinear = ducked ? 0.1258925 : 1.0;
    if (!this.fallbackMode && this.workletNode) {
      this.workletNode.port.postMessage({ type: 'duck', ducked });
    } else if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(targetLinear, this.ctx.currentTime, 0.003);
    }
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
    this.autoSeq = 0;
    this.decoder.reset();
    this.resampler?.reset();
    this.firstRenderTimestamp = null;
    this.replyEnqueueStartTimestamp = null;

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
    return this.telemetry.underflows;
  }

  getOverflowCount(): number {
    return this.telemetry.overflows;
  }

  getStaleDropped(): number {
    return this.telemetry.staleDropped;
  }

  getDupDropped(): number {
    return this.telemetry.dupDropped;
  }

  /**
   * §6.5 — Renamed from getFirstAudibleLatency: measures ms from first enqueue to first PLAYING telemetry,
   * which is internal buffer delay, NOT end-to-end audible acoustic latency.
   */
  getEnqueueToFirstRenderMs(): number | null {
    if (this.firstRenderTimestamp !== null && this.replyEnqueueStartTimestamp !== null) {
      return Math.round(this.firstRenderTimestamp - this.replyEnqueueStartTimestamp);
    }
    return null;
  }

  /** @deprecated Use getEnqueueToFirstRenderMs() — enqueue-to-render is not end-to-end audible latency. */
  getFirstAudibleLatency(): number | null {
    return this.getEnqueueToFirstRenderMs();
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
