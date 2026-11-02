# Stay Telephone Voice Agent (LiveKit + AssemblyAI)

This directory contains the telephony backend for Stay, enabling users to call their ADHD body-double companion directly over the telephone network (SIP / PSTN).

```
Microphone/SIP -> LiveKit Room -> AssemblyAI Universal-3.6 Pro STT
                                             ↓
LiveKit Room/SIP ← AssemblyAI TTS-1 ← Stay 3-Beat Coach LLM
```

> **Updated 2 Nov 2026.** `agent.py` now runs on livekit-agents 1.8 (`AgentSession`); the old `VoicePipelineAgent` code could not run on the version it pinned. The model is Groq (`GROQ_API_KEY`), not OpenAI. Every caller turn goes through the web app's own crisis and medication checks (`POST $STAY_URL/api/safety/check`) before the model is asked, with a local keyword list as the fallback. Tests: `uv run --no-project --with-requirements agent/requirements.txt --with pytest pytest agent/test_agent.py -q`. Not done: deploying it, and a phone number (both need the owner's yes).

## Features

- **LiveKit Agents Pipeline**: Real-time bidirectional WebRTC & SIP audio routing.
- **AssemblyAI Universal-3.6 Pro STT**: Realtime speech transcription and streaming turn detection.
- **AssemblyAI-TTS-1**: Streaming text-to-speech with natural pacing and low latency.
- **ADHD 3-Beat Coaching**: Matches the web app's shared system prompt (`shared/coach-prompt.json`).
- **Call Safety Limits**: Automatic 10-minute cap (570s warning, 600s graceful termination) to protect minutes.
- **Emergency Crisis Guard**: Standard boundary advice instructing callers to contact local emergency services.

---

## Step-by-Step Setup: Free US Phone Number via LiveKit Cloud

LiveKit provides 50 free inbound telephony minutes per month on the Build plan.

> **CRITICAL RULE**: Do not purchase or provision phone numbers without explicit user consent.

### 1. Prerequisites

Install the LiveKit CLI:
```bash
# macOS
brew install livekit-cli

# Windows (via Scoop or binary)
scoop bucket add livekit https://github.com/livekit/scoop-bucket.git
scoop install livekit-cli

# Linux
curl -sSL https://get.livekit.io/cli | bash
```

### 2. Configure LiveKit Cloud Project

Authenticate the CLI with your LiveKit Cloud credentials:
```bash
lk cloud auth
```

### 3. Rent a Free US Inbound Phone Number

List available phone numbers:
```bash
lk sip inbound list-numbers
```

Provision a number (first number is free on the Build tier):
```bash
lk sip inbound create-number --country US
```
Note the resulting E.164 phone number (e.g. `+1-415-555-0199`).

### 4. Create Explicit Dispatch Rule

Create a SIP dispatch rule that routes incoming calls directly to the Stay voice agent:
```bash
cat << 'EOF' > sip-rule.json
{
  "name": "stay-inbound-dispatch",
  "trunk_ids": [],
  "rule": {
    "dispatch_rule_individual": {
      "room_prefix": "stay-call-",
      "pin": ""
    }
  }
}
EOF

lk sip inbound create-dispatch-rule --config sip-rule.json
```

Associate the phone number with the dispatch rule:
```bash
lk sip inbound update-number <NUMBER_ID> --dispatch-rule-id <DISPATCH_RULE_ID>
```

### 5. Local Testing (Console Mode)

You can run and test the agent locally before cloud deployment:
```bash
cd agent
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Run in development mode
python agent.py dev
```

To test via telephone console simulation:
```bash
python agent.py connect --room test-room
```

### 6. Deploy to LiveKit Cloud

Deploy the agent container to LiveKit Cloud:
```bash
lk agent deploy --livekit-url <LIVEKIT_URL> --api-key <LIVEKIT_API_KEY> --api-secret <LIVEKIT_API_SECRET>
```

Set required environment variables in LiveKit Cloud:
```bash
lk agent env set ASSEMBLYAI_API_KEY="<YOUR_KEY>"
lk agent env set OPENAI_API_KEY="<YOUR_KEY>"
lk agent env set ASSEMBLYAI_VOICE_ID="49c443a4-8a1d-5f7e-b70b-98bdbd9823c3"
```

### 7. Telephony Disclosure & Cost Transparency

- **Allowance**: 50 inbound minutes per month included on LiveKit Cloud Build tier.
- **Direction**: Inbound only. Stay will never make unsolicited outbound phone calls.
- **Long-Distance / International**: Inbound US number. Standard carrier international rates apply if dialed from outside the United States.
