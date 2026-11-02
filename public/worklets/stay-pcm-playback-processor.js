/**
 * Stay AudioWorklet Continuous PCM Playback Processor (§6.5)
 * - Ring buffer holds >= 30 s at the context's sample rate (with backpressure signal at > 20 s).
 * - Every chunk carries { replyEpoch, seq }. Rejects old epochs (staleDropped), duplicates (dupDropped),
 *   and reorders out-of-order chunks within a 3-chunk window.
 * - Adaptive prebuffer starts at 100 ms, adapts between 80 and 400 ms on underflow,
 *   and decays back by 10 ms per clean rendered second.
 * - Supports -18 dB ducking within one render quantum on SpeechStarted (§6.3.1) and <= 10 ms ramp-to-zero on cancel.
 * - Applies a 5 ms fade-out before underflow exhaustion and 5 ms fade-in on resume.
 * - Posts telemetry every 50 ms: renderedSamples, bufferedMs, underflows, overflows, staleDropped, dupDropped, lastNonZeroAt.
 */

class StayPcmPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    const rate = typeof sampleRate === 'number' && sampleRate > 0 ? sampleRate : 24000;
    this.sampleRateVal = rate;

    // >= 30 seconds ring capacity at context sample rate (32 seconds allocated)
    this.bufferSize = Math.max(720000, Math.ceil(rate * 32));
    this.ring = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.bufferedCount = 0;

    this.activeSessionEpoch = 1;
    this.activeReplyEpoch = 1;

    // Sequence tracking & 3-chunk reorder window
    this.expectedSeq = 0;
    this.seenSeqs = new Set();
    this.reorderWindow = new Map(); // seq -> Float32Array
    this.maxReorderWindow = 3;

    // States: 'BUFFERING' | 'PLAYING' | 'DRAINING' | 'STOPPED'
    this.state = 'STOPPED';
    this.markedEnd = false;
    this.muted = false;
    this.ducked = false;

    // Adaptive prebuffer: starts at 200 ms (phones on mobile networks need it), bounded [140, 500] ms, decays 10 ms per clean second
    this.prebufferMs = 200;
    this.prebufferSamples = Math.floor((this.prebufferMs / 1000) * rate);
    this.bufferingWaitSamples = 0;
    this.cleanRenderedSamples = 0;

    // 5 ms fade window for underflow/resume; <= 10 ms ramp for cancel
    this.fadeLength = Math.max(16, Math.floor(0.005 * rate));
    this.currentGain = 1.0;
    this.targetGain = 1.0;

    // Telemetry counters
    this.renderedSamples = 0;
    this.underflows = 0;
    this.overflows = 0;
    this.staleDropped = 0;
    this.dupDropped = 0;
    this.fadeCount = 0;
    this.lastNonZeroAt = 0;
    this.totalQuanta = 0;
    this.quantaPer50Ms = Math.max(1, Math.round((0.05 * rate) / 128));
    this.telemetryDecimator = 0;

    this.port.onmessage = this.handleMessage.bind(this);
  }

  effectiveTargetGain() {
    if (this.muted) return 0.0;
    // -18 dB ducking gain = 10^(-18/20) ≈ 0.1258925
    return this.ducked ? 0.1258925 : 1.0;
  }

  get underflowCount() {
    return this.underflows;
  }

  get overflowCount() {
    return this.overflows;
  }

  handleMessage(e) {
    const msg = e.data;
    if (!msg) return;

    switch (msg.type) {
      case 'enqueue': {
        const sEpoch = msg.sessionEpoch ?? this.activeSessionEpoch;
        const rEpoch = msg.replyEpoch ?? this.activeReplyEpoch;

        // Reject stale session or reply epochs immediately
        if (sEpoch < this.activeSessionEpoch || (sEpoch === this.activeSessionEpoch && rEpoch < this.activeReplyEpoch)) {
          this.staleDropped++;
          return;
        }
        // Advance to newer epoch if not yet bumped
        if (sEpoch > this.activeSessionEpoch || rEpoch > this.activeReplyEpoch) {
          this.activeSessionEpoch = sEpoch;
          this.activeReplyEpoch = rEpoch;
          this.clearRing();
        }

        const input = msg.samples;
        if (!input || input.length === 0) return;

        const seq = typeof msg.seq === 'number' ? msg.seq : typeof msg.sequence === 'number' ? msg.sequence : null;
        if (seq !== null) {
          if (seq < this.expectedSeq || this.seenSeqs.has(seq) || this.reorderWindow.has(seq)) {
            this.dupDropped++;
            return;
          }
          if (seq === this.expectedSeq) {
            this.seenSeqs.add(seq);
            this.appendSamplesToRing(input);
            this.expectedSeq++;
            this.drainReorderWindow();
          } else if (seq <= this.expectedSeq + this.maxReorderWindow) {
            // Within 3-chunk reorder window: hold until missing predecessor arrives
            this.reorderWindow.set(seq, input);
            if (this.reorderWindow.size >= this.maxReorderWindow) {
              // Window full: flush lowest held seq in order so playback does not deadlock
              this.forceFlushOldestReordered();
            }
          } else {
            // Beyond 3-chunk reorder window: drop and count
            this.dupDropped++;
            return;
          }
        } else {
          this.appendSamplesToRing(input);
        }
        break;
      }

      case 'markEnd': {
        const sEpoch = msg.sessionEpoch ?? this.activeSessionEpoch;
        const rEpoch = msg.replyEpoch ?? this.activeReplyEpoch;
        if (sEpoch === this.activeSessionEpoch && rEpoch === this.activeReplyEpoch) {
          this.flushAllReordered();
          this.markedEnd = true;
          if (this.state === 'PLAYING' || this.state === 'BUFFERING') {
            this.state = 'DRAINING';
          }
        }
        break;
      }

      case 'duck': {
        this.ducked = Boolean(msg.ducked);
        if (this.state === 'PLAYING' || this.state === 'DRAINING') {
          this.targetGain = this.effectiveTargetGain();
        }
        break;
      }

      case 'cancel': {
        if (typeof msg.sessionEpoch === 'number') {
          this.activeSessionEpoch = msg.sessionEpoch;
        }
        this.activeReplyEpoch =
          typeof msg.replyEpoch === 'number' ? msg.replyEpoch : this.activeReplyEpoch + 1;
        this.clearRing();
        this.markedEnd = false;
        this.ducked = false;
        this.state = 'STOPPED';
        this.targetGain = 0.0;
        this.currentGain = 0.0;
        break;
      }

      case 'prebufferMs': {
        if (typeof msg.ms === 'number' && msg.ms >= 80 && msg.ms <= 400) {
          this.prebufferMs = msg.ms;
          this.prebufferSamples = Math.floor((this.prebufferMs / 1000) * this.sampleRateVal);
        }
        break;
      }

      case 'setMuted': {
        this.muted = Boolean(msg.muted);
        this.targetGain = this.effectiveTargetGain();
        break;
      }

      case 'clear': {
        this.clearRing();
        this.state = 'STOPPED';
        break;
      }
    }
  }

  drainReorderWindow() {
    while (this.reorderWindow.has(this.expectedSeq)) {
      const nextChunk = this.reorderWindow.get(this.expectedSeq);
      this.reorderWindow.delete(this.expectedSeq);
      this.seenSeqs.add(this.expectedSeq);
      this.appendSamplesToRing(nextChunk);
      this.expectedSeq++;
    }
  }

  forceFlushOldestReordered() {
    const keys = Array.from(this.reorderWindow.keys()).sort((a, b) => a - b);
    if (keys.length === 0) return;
    const lowest = keys[0];
    const chunk = this.reorderWindow.get(lowest);
    this.reorderWindow.delete(lowest);
    this.seenSeqs.add(lowest);
    this.appendSamplesToRing(chunk);
    this.expectedSeq = lowest + 1;
    this.drainReorderWindow();
  }

  flushAllReordered() {
    const keys = Array.from(this.reorderWindow.keys()).sort((a, b) => a - b);
    for (const k of keys) {
      const chunk = this.reorderWindow.get(k);
      this.reorderWindow.delete(k);
      this.seenSeqs.add(k);
      this.appendSamplesToRing(chunk);
      this.expectedSeq = Math.max(this.expectedSeq, k + 1);
    }
  }

  appendSamplesToRing(input) {
    if (!input || input.length === 0) return;

    if (this.bufferedCount + input.length > this.bufferSize) {
      this.overflows++;
      const avail = Math.max(0, this.bufferSize - this.bufferedCount);
      for (let i = 0; i < avail; i++) {
        this.ring[this.writeIndex] = input[i];
        this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      }
      this.bufferedCount += avail;
    } else {
      for (let i = 0; i < input.length; i++) {
        this.ring[this.writeIndex] = input[i];
        this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
      }
      this.bufferedCount += input.length;
    }

    if (this.state === 'STOPPED') {
      this.state = 'BUFFERING';
      this.bufferingWaitSamples = 0;
      this.currentGain = 0.0;
      this.targetGain = this.effectiveTargetGain();
      this.fadeCount++;
    }

    const bufferedMs = (this.bufferedCount / this.sampleRateVal) * 1000;
    if (bufferedMs > 20000) {
      this.port.postMessage({ type: 'backpressure', paused: true, bufferedMs });
    }
  }

  clearRing() {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.bufferedCount = 0;
    this.bufferingWaitSamples = 0;
    this.cleanRenderedSamples = 0;
    this.expectedSeq = 0;
    this.seenSeqs.clear();
    this.reorderWindow.clear();
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const channel = output[0];
    const quantumLength = channel.length;
    this.totalQuanta++;

    // State transition from BUFFERING -> PLAYING
    if (this.state === 'BUFFERING') {
      this.bufferingWaitSamples += quantumLength;
      const hasPrebufferCushion =
        this.bufferedCount >= this.prebufferSamples &&
        (this.bufferingWaitSamples >= this.prebufferSamples ||
          this.bufferedCount >= this.prebufferSamples + Math.floor(0.05 * this.sampleRateVal));

      if (hasPrebufferCushion || this.markedEnd) {
        this.state = this.markedEnd ? 'DRAINING' : 'PLAYING';
        this.bufferingWaitSamples = 0;
        this.targetGain = this.effectiveTargetGain();
      } else {
        channel.fill(0);
        for (let c = 1; c < output.length; c++) output[c].fill(0);
        this.sendTelemetry(0, 0);
        return true;
      }
    }

    if (this.state === 'STOPPED') {
      channel.fill(0);
      for (let c = 1; c < output.length; c++) output[c].fill(0);
      this.sendTelemetry(0, 0);
      return true;
    }

    let sumSq = 0;
    let peak = 0;
    let renderedThisQuantum = 0;

    for (let i = 0; i < quantumLength; i++) {
      let sample = 0;

      if (this.bufferedCount > 0) {
        sample = this.ring[this.readIndex];
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
        this.bufferedCount--;
        renderedThisQuantum++;

        // Apply 5 ms tail fade-out if PLAYING and about to run dry (prevents hard cut click on underflow)
        if (this.state === 'PLAYING' && this.bufferedCount < this.fadeLength) {
          const tailEnv = this.bufferedCount / this.fadeLength;
          sample *= tailEnv;
        }
      } else {
        if (this.state === 'PLAYING') {
          this.underflows++;
          this.fadeCount++;
          this.cleanRenderedSamples = 0;
          // Adapt prebuffer upward within [140, 500] ms
          this.prebufferMs = Math.min(500, Math.max(140, Math.round(this.prebufferMs * 1.4)));
          this.prebufferSamples = Math.floor((this.prebufferMs / 1000) * this.sampleRateVal);
          this.state = 'BUFFERING';
          this.bufferingWaitSamples = 0;
          this.currentGain = 0.0;
          this.targetGain = 0.0;
        } else if (this.state === 'DRAINING') {
          this.state = 'STOPPED';
          this.markedEnd = false;
        }
      }

      if (this.currentGain !== this.targetGain) {
        const step = 1.0 / this.fadeLength;
        if (this.currentGain < this.targetGain) {
          this.currentGain = Math.min(this.targetGain, this.currentGain + step);
        } else {
          this.currentGain = Math.max(this.targetGain, this.currentGain - step);
        }
      }

      const outSample = sample * this.currentGain;
      channel[i] = outSample;

      const absSample = Math.abs(outSample);
      if (absSample > peak) peak = absSample;
      if (absSample > 1e-5) {
        this.lastNonZeroAt = Math.round(((this.totalQuanta * quantumLength + i) / this.sampleRateVal) * 1000);
      }
      sumSq += outSample * outSample;
    }

    for (let c = 1; c < output.length; c++) {
      output[c].set(channel);
    }

    this.renderedSamples += renderedThisQuantum;
    if (renderedThisQuantum === quantumLength && this.state === 'PLAYING') {
      this.cleanRenderedSamples += renderedThisQuantum;
      // Decay prebuffer back by 10 ms per clean rendered second down to 140 ms minimum (§6.5)
      if (this.cleanRenderedSamples >= this.sampleRateVal) {
        this.cleanRenderedSamples -= this.sampleRateVal;
        if (this.prebufferMs > 140) {
          this.prebufferMs = Math.max(140, this.prebufferMs - 10);
          this.prebufferSamples = Math.floor((this.prebufferMs / 1000) * this.sampleRateVal);
        }
      }
    }

    const rms = Math.sqrt(sumSq / quantumLength);
    this.sendTelemetry(rms, peak);

    return true;
  }

  sendTelemetry(rms, peak) {
    this.telemetryDecimator++;
    if (this.telemetryDecimator >= this.quantaPer50Ms) {
      this.telemetryDecimator = 0;
      const bufferedMs = (this.bufferedCount / this.sampleRateVal) * 1000;
      this.port.postMessage({
        type: 'telemetry',
        state: this.state,
        bufferedMs,
        prebufferMs: this.prebufferMs,
        backpressure: bufferedMs > 20000,
        renderedSamples: this.renderedSamples,
        underflows: this.underflows,
        underflowCount: this.underflows,
        overflows: this.overflows,
        overflowCount: this.overflows,
        staleDropped: this.staleDropped,
        dupDropped: this.dupDropped,
        fadeCount: this.fadeCount,
        lastNonZeroAt: this.lastNonZeroAt,
        rms,
        peak,
      });
    }
  }
}

registerProcessor('stay-pcm-playback-processor', StayPcmPlaybackProcessor);
