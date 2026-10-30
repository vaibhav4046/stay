# STAY CONTINUOUS PCM PLAYBACK ARCHITECTURE

```
[ Incoming Base64 PCM16 Chunks ]
             │
             ▼
   [ Pcm16Decoder ] ── (Odd-Byte Carry & Little-Endian Signed Int16)
             │
             ▼
 [ StreamingResampler ] ── (Stateful 24k -> AudioContext rate, phase-retained)
             │
             ▼
[ AudioWorklet Node: StayPcmPlaybackProcessor ]
   ├── Bounded Circular Ring Buffer (192,000 samples ~ 4s capacity)
   ├── Adaptive Prebuffer State Machine (BUFFERING -> PLAYING -> DRAINING)
   ├── 5ms Click-Free Crossfade Ramping (Fade-in on start, fade-out on stall)
   └── Monotonic Generation Epochs (Immediate flush on barge-in)
             │
             ▼
       [ GainNode ]
             │
      ┌──────┴──────┐
      ▼             ▼
[ AnalyserNode ]  [ AudioDestinationNode (Speaker) ]
      │
      ▼
[ 30Hz Telemetry & Orb Lip-Sync Bus ]
```

## Key Architectural Invariants
1. **Hardware Clock Decoupling:** The AudioWorklet consumes audio on Web Audio's native 128-sample rendering quantum clock, completely detached from network packet jitter.
2. **Single Source of Truth:** One long-lived `AudioWorkletNode` per session rather than thousands of transient `AudioBufferSourceNode` objects.
3. **Odd-Byte Boundary Safety:** Network chunks splitting 16-bit boundaries retain the carry byte across packets.
4. **Stateful Sample Rate Conversion:** If `ctx.sampleRate` is 44.1kHz or 48kHz, the resampler retains fractional phase between chunks, preventing phase jumps.
5. **Instantaneous Interruption:** `cancelReply()` clears the ring buffer and increments generation epoch synchronously. In-flight packets from old epochs are discarded at zero cost.
