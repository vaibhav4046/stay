# Non-Blocking Product & Engineering Backlog

The following items are verified non-blocking enhancements deferred for post-hackathon cycles:

1. **Meta WhatsApp Cloud Integration (STRETCH §8.8)**:
   - Status: Fully specified in `docs/WHATSAPP_PLAN.md` with security and opt-in rules.
   - Requirement: Official Meta Cloud API verification and approved utility notification template.
2. **Real PSTN Telephony Cloud Deployment (STRETCH §8.7)**:
   - Status: LiveKit agent worker complete in `agent/agent.py` with Dockerfile and livekit.toml.
   - Requirement: Provisioning LiveKit Cloud SIP trunk and inbound US phone number (pending user operator sign-off).
3. **Offline Audio Worklet Model Caching**:
   - Cache Silero VAD weights locally in IndexedDB for instant offline cold starts.
4. **Export to Apple Health / Google Fit**:
   - Allow optional synchronization of logged focus sessions into Mindful Minutes.
