# VOICE PROOF: AUDIOWORKLET RING BUFFER BENCHMARK (TIER 1 SYNTHETIC DSP)

**Generated:** 2026-11-01T06:09:40.799Z  
**Commit (`gitSha`):** `771b9ba5982081f3197170d9cdf1c30e034a1ad8`  
**Evidence JSON:** [`docs/evidence/unit/dsp-worklet-bench.json`](../evidence/unit/dsp-worklet-bench.json)  
**Worklet Under Test:** `public/worklets/stay-pcm-playback-processor.js` (executed directly in Node `vm` at 24,000 Hz, 128-sample render quanta)

## Scope & Honest Limits
- This report measures the **AudioWorklet ring buffer and epoch cancellation logic** under synthetic packet arrival schedules.
- It is a **Tier 1 unit/DSP measurement**, not a real-microphone or network RTT measurement. `enqueueToFirstRenderMs` measures the prebuffer hold before the first non-zero sample is emitted by `process()`.

## Jitter Matrix Results (20 chunks × 100 ms @ 24 kHz = 48,000 samples)

| Alternating Packet Jitter | Rendered Non-Zero Samples | Measured Underflows | Fade Transitions | Measured Gap | `enqueueToFirstRenderMs` | Stale Samples After `cancel` |
|---|---|---|---|---|---|---|
| 0 ms | 48000 | 0 | 2 | 0 ms | 96 ms | 0 |
| 20 ms | 48000 | 0 | 2 | 0 ms | 96 ms | 0 |
| 40 ms | 48000 | 0 | 2 | 0 ms | 96 ms | 0 |
| 60 ms | 48000 | 0 | 2 | 0 ms | 96 ms | 0 |
| 80 ms | 48000 | 0 | 2 | 0 ms | 96 ms | 0 |
| 100 ms | 47998 | 2 | 6 | 201.42 ms | 96 ms | 0 |
| 120 ms | 47995 | 1 | 4 | 28.21 ms | 96 ms | 0 |
| 200 ms | 47995 | 1 | 4 | 108.21 ms | 96 ms | 0 |
| 400 ms | 47998 | 2 | 6 | 500.08 ms | 96 ms | 0 |
