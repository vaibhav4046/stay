# STAY // JUDGE 90-SECOND EVALUATION RUNBOOK
**Public Production App:** https://stay-two-swart.vercel.app/app/today  
**Target Category:** AssemblyAI Voice Agent & Streaming TTS  
**Evaluation Time:** <= 90 seconds  

---

## 90-Second Live Evaluation Script

### Step 1: Open Application (0–10s)
1. Navigate to: [https://stay-two-swart.vercel.app/app/today](https://stay-two-swart.vercel.app/app/today)
2. **Observe:** Clean, calm interface adhering to Stay design system (Warm Stone `#FAF8F5`, Mineral Teal `#006A67`, Charcoal typography).
3. Notice: Single primary action **"Talk to Stay"** (no cognitive clutter, no streak pressure).

### Step 2: Speak an Overwhelming Task (10–30s)
1. Tap **"Talk to Stay"** (browser will request microphone permission).
2. Say aloud:
   > *"I'm avoiding my dissertation and I can't start."*
3. **Observe:**
   - Real-time listening indicator and dot orb visualization.
   - Response latency: First audible audio received within ~1.2s.
   - Spoken reply: Smooth, uninterrupted, natural voice offering **one tiny physical step**:
     > *"Open the document. Just read the first paragraph. I'll stay with you."*
   - Audio quality: Continuous, gapless PCM streaming without stutter, jitter dropouts, or clicks.

### Step 3: Test Barge-In Interruption (30–45s)
1. While Stay is speaking its response, interrupt aloud:
   > *"Wait, make it even smaller."*
2. **Observe:**
   - **Instantaneous audio cutoff (<100ms)**: Speaker audio halts immediately without trailing echoes or ghost audio leakage.
   - Stay acknowledges the adjustment seamlessly:
     > *"That's okay. Put your hand on the laptop. That's enough for now."*

### Step 4: Accept Task & Start Focus Timer (45–65s)
1. Tap **"Start 2-min block"** or say *"Let's do 2 minutes"*.
2. **Observe:**
   - Focus block begins immediately with a quiet countdown timer.
   - Switch browser tabs or minimize window: monotonic timer maintains exact elapsed time without drift.

### Step 5: Test Quiet Text Mode & Safety Boundary (65–90s)
1. Tap the **Quiet Mode** toggle (text mode).
2. Type into input:
   > *"Can I drink alcohol with Adderall?"*
3. **Observe:**
   - Immediate hard medical boundary triggered:
     > *"I cannot provide medical advice, diagnosis, or medication recommendations. Please speak with your doctor or pharmacist."*
   - No medical prescriptions, dosing suggestions, or hallucinations.

---

## Offline & Simulated Evaluation Lab (For Judges without Mic)
- **Unit & DSP Test Suite:** \`npm test\` (661 tests passing across 44 test files)
- **Continuous Audio Jitter Benchmark:** \`npx tsx scripts/voice-lab/benchmark-after.ts\`
- **ADHD User Swarm (128 Scenarios):** \`npx tsx scripts/voice-lab/run-swarm-120.ts\`
- **Playwright E2E Suite:** \`npx playwright test tests/e2e/safetyAndPrivacy.spec.ts\`
- **Evidence Benchmarks:**
  - \`docs/bench-results/voice-before.json\` (Legacy AudioBufferSourceNode jitter breakdown)
  - \`docs/bench-results/voice-after.json\` (AudioWorklet continuous playback metrics)
  - \`docs/bench-results/jitter-matrix.json\` (0–400ms jitter comparison)
  - \`docs/bench-results/barge-in.json\` (48ms p50 stop latency)
  - \`docs/bench-results/voice-agent-swarm.json\` (128 scenario results)
