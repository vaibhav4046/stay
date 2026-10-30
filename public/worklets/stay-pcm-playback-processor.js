/**
 * Stay AudioWorklet Continuous PCM Playback Processor
 * Runs on device audio rendering clock (128 samples per quantum).
 * Decouples network jitter from audio rendering with adaptive prebuffering and click-free crossfades.
 */

class StayPcmPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // 4 seconds ring capacity at standard context rate (e.g. 192,000 samples @ 48kHz)
    this.bufferSize = 192000;
    this.ring = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.bufferedCount = 0;

    this.activeSessionEpoch = 1;
    this.activeReplyEpoch = 1;

    // States: 'BUFFERING' | 'PLAYING' | 'DRAINING' | 'STOPPED'
    this.state = 'STOPPED';
    this.markedEnd = false;
    this.muted = false;

    // Prebuffer configuration (adaptive 80-150ms default ~100ms)
    this.prebufferMs = 100;
    this.prebufferSamples = Math.floor((this.prebufferMs / 1000) * sampleRate);

    // Fade ramps: ~5ms window to eliminate clicks on boundary
    this.fadeLength = Math.max(16, Math.floor((0.005) * sampleRate));
    this.currentGain = 1.0;
    this.targetGain = 1.0;

    // Telemetry & metrics
    this.renderedSamples = 0;
    this.underflowCount = 0;
    this.overflowCount = 0;
    this.telemetryDecimator = 0;

    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(e) {
    const msg = e.data;
    if (!msg) return;

    switch (msg.type) {
      case 'enqueue': {
        // Discard stale or canceled generations
        if (msg.sessionEpoch !== this.activeSessionEpoch || msg.replyEpoch !== this.activeReplyEpoch) {
          return;
        }

        const input = msg.samples;
        if (!input || input.length === 0) return;

        // Check overflow
        if (this.bufferedCount + input.length > this.bufferSize) {
          this.overflowCount++;
          // Retain recent data, drop oldest to avoid corrupting pointers
          const toDrop = (this.bufferedCount + input.length) - this.bufferSize;
          this.readIndex = (this.readIndex + toDrop) % this.bufferSize;
          this.bufferedCount -= toDrop;
        }

        // Copy input to circular ring
        for (let i = 0; i < input.length; i++) {
          this.ring[this.writeIndex] = input[i];
          this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
        }
        this.bufferedCount += input.length;

        if (this.state === 'STOPPED') {
          this.state = 'BUFFERING';
          this.targetGain = 1.0;
        }
        break;
      }

      case 'markEnd': {
        if (msg.sessionEpoch === this.activeSessionEpoch && msg.replyEpoch === this.activeReplyEpoch) {
          this.markedEnd = true;
          if (this.state === 'PLAYING' || this.state === 'BUFFERING') {
            this.state = 'DRAINING';
          }
        }
        break;
      }

      case 'cancel': {
        // Instantly invalidate epoch, clear ring buffer, fade out immediately
        this.activeReplyEpoch = msg.replyEpoch || (this.activeReplyEpoch + 1);
        this.clearRing();
        this.markedEnd = false;
        this.state = 'STOPPED';
        this.targetGain = 0.0;
        this.currentGain = 0.0;
        break;
      }

      case 'prebufferMs': {
        if (typeof msg.ms === 'number' && msg.ms >= 40 && msg.ms <= 400) {
          this.prebufferMs = msg.ms;
          this.prebufferSamples = Math.floor((this.prebufferMs / 1000) * sampleRate);
        }
        break;
      }

      case 'setMuted': {
        this.muted = !!msg.muted;
        this.targetGain = this.muted ? 0.0 : 1.0;
        break;
      }

      case 'clear': {
        this.clearRing();
        this.state = 'STOPPED';
        break;
      }
    }
  }

  clearRing() {
    this.readIndex = 0;
    this.writeIndex = 0;
    this.bufferedCount = 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || !output[0]) return true;
    const channel = output[0];
    const quantumLength = channel.length; // usually 128 samples

    // State transition from BUFFERING -> PLAYING
    if (this.state === 'BUFFERING') {
      if (this.bufferedCount >= this.prebufferSamples || this.markedEnd) {
        this.state = this.markedEnd ? 'DRAINING' : 'PLAYING';
      } else {
        // Still buffering: emit silence
        channel.fill(0);
        this.sendTelemetry(0, 0);
        return true;
      }
    }

    if (this.state === 'STOPPED') {
      channel.fill(0);
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
      } else {
        // Underflow reached!
        if (this.state === 'PLAYING') {
          // Network stall occurred mid-utterance
          this.underflowCount++;
          this.state = 'BUFFERING'; // Re-enter buffering until next packets
          this.targetGain = 0.0; // Fade to silence
        } else if (this.state === 'DRAINING') {
          // Normal playback completed
          this.state = 'STOPPED';
          this.markedEnd = false;
        }
      }

      // Smooth gain ramping (fade in / fade out over fadeLength)
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
      sumSq += outSample * outSample;
    }

    this.renderedSamples += renderedThisQuantum;
    const rms = Math.sqrt(sumSq / quantumLength);
    this.sendTelemetry(rms, peak);

    return true;
  }

  sendTelemetry(rms, peak) {
    this.telemetryDecimator++;
    // Decimate to ~30-40Hz (at 48k, ~14 quanta ~ 37ms)
    if (this.telemetryDecimator >= 14) {
      this.telemetryDecimator = 0;
      const bufferedMs = (this.bufferedCount / sampleRate) * 1000;
      this.port.postMessage({
        type: 'telemetry',
        state: this.state,
        bufferedMs,
        renderedSamples: this.renderedSamples,
        underflowCount: this.underflowCount,
        overflowCount: this.overflowCount,
        rms,
        peak,
      });
    }
  }
}

registerProcessor('stay-pcm-playback-processor', StayPcmPlaybackProcessor);
