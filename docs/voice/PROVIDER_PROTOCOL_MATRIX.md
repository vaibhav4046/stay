# PROVIDER PROTOCOL MATRIX

| Provider Engine | Transport | Handshake / Auth | Audio Format | Framing Protocol | Barge-In Mechanism | Fallback Behavior |
|---|---|---|---|---|---|---|
| **Managed AssemblyAI Voice Agent** | WebSocket (`wss://agents.assemblyai.com/v1/ws`) | Ephemeral single-use token via `/api/voice/token` | Mono PCM16 24kHz Base64 | `session.ready` -> `input.audio` -> `reply.audio.data` -> `reply.done` | `reply.done` with `status: "interrupted"` -> instant epoch cancel | Falls back to Quiet Text Mode |
| **FastSocket Cascade (AssemblyAI TTS)** | WebSocket (`wss://tts.us.assemblyai.com/v1/ws`) | Ephemeral token via `/api/voice/fast-token` | Mono PCM16 24kHz Base64 (`pcm_s16le`) | `Begin` -> `Generate` -> `Flush` -> `Audio.audio` -> `FlushDone` | Send `Cancel`, receive `Cancelled`, local epoch clear | Falls back to Azure or Browser Speech |
| **Azure AI Speech** | HTTP/REST Relay (`/api/voice/tts`) | User-provided BYOK key in `x-stay-tts-key` header | Mono PCM16 24kHz Chunked Stream | SSML -> raw binary stream -> `Audio` frames | AbortController aborts HTTP stream | Falls back to Browser Speech |
| **Browser SpeechSynthesis** | Web Speech API | Client-native | System Speech Engine | `window.speechSynthesis.speak()` | `speechSynthesis.cancel()` | Falls back to Quiet Text Mode |
| **Quiet Text Mode** | HTTP/REST | None required | Text only | `/api/voice/chat` | User stops typing | Always available |
