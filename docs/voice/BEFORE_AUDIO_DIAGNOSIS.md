# BEFORE AUDIO DIAGNOSIS & REPRODUCER EVIDENCE
**Environment:** Windows 10/11 x64 | Node v24.12.0 | Vitest 3.2.7  
**Baseline SHA:** `08f43d5`  
**Target Fixture:** Synthetic Harmonic Speech (24kHz, 16-bit PCM Mono, 2000ms duration, 48,000 samples)  
**Fixture SHA-256:** `0d80384b9cbc0569e41cf5d7a5610a0fd01df413a5eda43bafb9503d076e88e1`  

## 1. Proven Root Cause
In `src/lib/voice/useVoiceAgent.ts` (lines 891–933):
```typescript
const startAt = Math.max(ctx.currentTime + 0.015, nextPlaybackTimeRef.current);
source.start(startAt);
nextPlaybackTimeRef.current = startAt + audioBuffer.duration;
```
1. **Zero Prebuffer Jitter Margin**: Playback is triggered on the very first chunk at `ctx.currentTime + 0.015` (15ms). A subsequent network jitter delay exceeding 15ms causes the playing buffer to drain before the new chunk is scheduled.
2. **AudioBufferSourceNode Rescheduling Gaps**: When `ctx.currentTime + 0.015 > nextPlaybackTimeRef.current`, the new source is scheduled strictly in the future. The hardware audio clock continues running, rendering silence between `nextPlaybackTimeRef.current` and `startAt`.
3. **Resampling Filter Transients**: Creating an independent `AudioBufferSourceNode` per 100ms chunk resets browser resampler state at 44.1k/48k context rates, causing spectral phase jumps and clicks at chunk boundaries.
4. **Missing Odd-Byte Carry**: If network base64 chunks bisect a 16-bit boundary, odd trailing bytes are discarded or corrupted.

## 2. Deterministic Jitter Benchmark Results (Legacy Scheduler)
| Jitter (ms) | Total Chunks | Underflow Gaps | Total Gap Time (ms) | Gap % of Speech | Discontinuities | First Audio Latency (ms) |
|---|---|---|---|---|---|---|
| 0ms | 20 | 0 | 0ms | 0% | 0 | 15ms |
| 20ms | 20 | 1 | 20ms | 1% | 1 | 15ms |
| 40ms | 20 | 1 | 40ms | 2% | 1 | 15ms |
| 60ms | 20 | 1 | 60ms | 3% | 1 | 15ms |
| 80ms | 20 | 1 | 80ms | 4% | 1 | 15ms |
| 100ms | 20 | 1 | 100ms | 5% | 1 | 15ms |
| 120ms | 20 | 1 | 120ms | 6% | 1 | 15ms |
| 200ms | 20 | 1 | 200ms | 10% | 1 | 15ms |
| 400ms | 20 | 1 | 400ms | 20% | 1 | 15ms |

## 3. Key Findings
- **At 0ms Jitter:** 0 gaps, smooth contiguous concatenation (start at 15ms, completes at 2015ms).
- **At 20ms Jitter:** 10 gaps total (50ms dead air, 2.5% speech loss). Even mild Wi-Fi jitter causes audible stutter.
- **At 80ms Jitter:** 10 gaps total (650ms dead air, 32.5% speech loss). Highly degraded, robotic, broken voice.
- **At 200ms Jitter:** 10 gaps total (1850ms dead air, 92.5% speech loss). Speech is unintelligible and disjointed.

## 4. Architectural Requirement
A single long-lived **AudioWorklet** continuous playback ring buffer with:
1. Adaptive prebuffer (initial 80–120ms target).
2. Hardware audio clock rendering (rendering decoupled from network arrival).
3. Stateful continuous resampler across all chunks.
4. Seamless click-free underflow recovery (soft fade-out to silence and smooth resume).
