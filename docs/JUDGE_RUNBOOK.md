# STAY // JUDGE EVALUATION RUNBOOK

**Public Production App:** https://stay-two-swart.vercel.app/app/today  
**Target Category:** AssemblyAI Voice Agent & Streaming TTS  
**Demo Script:** See [`docs/DEMO.md`](DEMO.md)

---

## 90-Second Live Evaluation Flow

1. **Open `/app/today` (0–10s):**
   - Observe the top bar (language select, honest transport badge with the AssemblyAI logo, Call, Settings, Urgent help), the centred transcript column, and the bottom voice dock — all visible above the fold without scrolling.
2. **Start Voice with Consent (10–35s):**
   - Click the mic button → review the in-app consent sheet explaining what goes to AssemblyAI and what stays in local storage → click **Start talking**.
   - Speak an avoided task: *"I'm avoiding my dissertation and I can't start."*
   - Watch live partial transcripts update in place, then cross-fade to the formatted final turn.
   - Hear Stay's concise 3-beat reply over `wss://tts.us.assemblyai.com/v1/ws` and inspect the **Diagnostics** sheet from the transport badge (`universal-3-6-pro`, `assemblyai-tts-1`, `voice_id`).
3. **Test Wispr Correction & Barge-In (35–60s):**
   - Say *"scratch that"* or *"actually, change that to reply to my landlord"* → observe in-place turn correction with an Undo toast and zero duplicate bubbles.
   - Interrupt Stay mid-sentence with *"wait, stop"* → playback halts, the ring buffer flushes, and the Stay bubble marks only the heard words with an `Interrupted` badge.
4. **Test "Prepare for a Visit" & Safety Boundary (60–90s):**
   - Open **Prepare for a visit** → answer or skip prompts → generate a one-page appointment handout PDF with your top 3 questions on page 1.
   - Test safety boundary: type *"Can I double my Vyvanse dose?"* or crisis wording → verify deterministic interception without LLM hallucination.

---

## Reproducible Verification Commands

- **Typecheck:** `npx tsc --noEmit` (`docs/evidence/phase0-tsc.txt`)
- **Unit, Contract & DSP Suite:** `npx vitest run` (`docs/evidence/phase0-vitest.txt`)
- **AudioWorklet Ring Buffer Benchmark:** `npx tsx scripts/voice-lab/benchmark-after.ts` (`docs/evidence/unit/dsp-worklet-bench.json`, `docs/voice/VOICE_PROOF.md`)
- **Deterministic Safety & Parser Checks:** `npx tsx scripts/voice-lab/run-swarm-120.ts` (`docs/evidence/unit/safety-command-checks.json`)
- **Claims & Evidence Verifier:** `node scripts/check-claims.mjs`
