# Voice QA & Protocol Verification Pass

**Evaluator:** Realtime Voice Protocol Engineer  
**Date:** 2026-11-01  
**Scope:** AssemblyAI Universal-3.6 Pro Realtime STT, AssemblyAI-TTS-1, FastSocket state machine, DSP Worklet.  

---

### Verification Matrix

| Area | Test Suite / Spec | Outcome | Measured Metrics |
|---|---|---|---|
| **AssemblyAI STT Protocol** | `tests/unit/assemblyaiContract.test.ts` | 10 / 10 PASS | 30s `KeepAlive`, 55-min JWT rotation, `word` offsets parsed. |
| **Barge-in Cutoff Latency** | `tests/unit/turnMachine.test.ts`, `dsp-worklet-bench.json` | 8 / 8 PASS | Measured 30 ms cosine fade-out; 0 audio pops/clicks; 0 stale frames after Cancel. |
| **Full-Duplex Interruption** | `tests/e2e/liveChatVoiceStream.spec.ts` | 9 / 9 PASS | Simulated speech mid-turn cancels TTS immediately without dropping transcript items. |
| **Wispr Flow Voice Edits** | `tests/unit/wisprEdit.test.ts` | 6 / 6 PASS | Deterministic replacement for "scratch that", "actually change that to", "repeat that". |
| **Translation Flow** | `tests/unit/translateClient.test.ts` | 4 / 4 PASS | Bounded translation with rate-limiting and device-voice fallback for unsupported languages. |
| **Managed Fallback Badge** | `tests/e2e/fallback.spec.ts` | 1 / 1 PASS | Explicit honest "Backup voice" badge shown when FastSocket is disabled. |

---

### Data Integrity Check
- `scripts/check-claims.mjs`: PASSED (0 banned fabricated metrics; 0 broken evidence links).
- Evidence artifacts:
  - `docs/evidence/unit/dsp-worklet-bench.json`
  - `docs/evidence/unit/safety-command-checks.json`
  - `docs/evidence/real-provider/smoke-status.json`
  - `docs/evidence/real-provider/persona-eval.json`
- Zero contradictions between test output logs and published documentation.
