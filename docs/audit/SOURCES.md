# Stay — Verified Upstream Documentation Sources (`SOURCES.md`)

Verified on **2026-11-01** against upstream AssemblyAI and LiveKit documentation per Rule R3.

---

## 1. AssemblyAI Streaming STT (`Universal-3.6 Pro`)

### 1.1 Streaming WebSocket API Spec
- **URL:** `https://www.assemblyai.com/docs/streaming/api-spec/streaming-websocket.md`
- **Verified Excerpts:**
  - Global endpoint: `wss://streaming.assemblyai.com/v3/ws`
  - US data residency: `wss://streaming.us.assemblyai.com/v3/ws`
  - EU data residency: `wss://streaming.eu.assemblyai.com/v3/ws`
  - Authentication: `Authorization` header (server-side) or `?token=<temporary_token>` query parameter (browser clients).
  - Required query parameters: `sample_rate=16000` (documented default; 8k–96k accepted), `encoding=pcm_s16le` (mono), `speech_model=universal-3-6-pro`.
  - Audio frames: Binary raw PCM bytes, 50–1000 ms chunks (100 ms = 1600 samples = 3200 bytes at 16 kHz).
  - Supported 3.6 Pro query parameters:
    - `min_turn_silence` (ms, default 128 in `min_latency`/`balanced` modes)
    - `max_turn_silence` (ms, default 1280)
    - `vad_threshold` (0.0–1.0, default 0.2)
    - `keyterms_prompt` (JSON array of up to 100 strings, each ≤ 50 chars)
    - `language_detection=true` (returns `language_code` per turn)
    - `language_codes` (JSON array of language codes to steer detection; omit for 32-language code-switching including Hindi `hi`)
    - `llm_gateway` (JSON string for real-time translation)
  - Universal-Streaming / 3.5-only parameters (**MUST NOT send on 3.6 Pro**):
    - `end_of_turn_confidence_threshold`
    - `format_turns`
    - `prompt`

### 1.2 Turn Detection & Message Sequence
- **URLs:**
  - `https://www.assemblyai.com/docs/streaming/turn-detection.md`
  - `https://www.assemblyai.com/docs/streaming/message-sequence.md`
- **Verified Excerpts:**
  - "Universal-3.6 Pro Realtime does not endpoint on silence alone. When a speaker pauses, the model evaluates what has been said so far to judge whether the speaker is finished or just pausing mid-thought."
  - Client → Server text JSON frames:
    - `{"type": "UpdateConfiguration", "agent_context": "<Stay's last reply>"}` (≤ 1750 chars)
    - `{"type": "ForceEndpoint"}`
    - `{"type": "KeepAlive"}`
    - `{"type": "Terminate"}`
  - Server → Client text JSON frames:
    - `Begin` (`id`, `expires_at`, `configuration`)
    - `SpeechStarted` (emitted once per turn when speech is detected — reliable barge-in signal)
    - `Turn` (`turn_order`, `transcript`, `end_of_turn`, `turn_is_formatted`, `words[]`, `language_code`). Every `Turn` re-transcribes the whole turn; replace bubble text, never append.
    - `LLMGatewayResponse` (`turn_order`, `data.choices[0].message.content`)
    - `Termination` (followed by WebSocket close `1000`).

### 1.3 Real-Time Translation via LLM Gateway
- **URL:** `https://www.assemblyai.com/docs/streaming/real-time-translation.md`
- **Verified Excerpts:**
  ```javascript
  const LLM_GATEWAY_CONFIG = {
    model: "qwen3.5-4b-32k-fast",
    prompt: "Translate the following English into natural Spanish and reply with only the translation: {{turn}}",
  };
  const CONNECTION_PARAMS = {
    sample_rate: 16000,
    speech_model: "universal-3-6-pro",
    llm_gateway: JSON.stringify(LLM_GATEWAY_CONFIG),
  };
  ```
  - `{{turn}}` is the exact template variable replaced by the server with the final transcript of each turn.
  - Translations arrive as `LLMGatewayResponse` messages containing `turn_order` and `data.choices[0].message.content`.

### 1.4 Streaming STT Temporary Token Endpoint
- **URL:** `https://www.assemblyai.com/docs/api-reference/streaming-api/generate-streaming-token.md`
- **Verified Excerpts:**
  - Endpoint: `GET https://streaming.assemblyai.com/v3/token?expires_in_seconds=60&max_session_duration_seconds=3600`
  - Header: `Authorization: <ASSEMBLYAI_API_KEY>`
  - `expires_in_seconds`: integer `1..600` (required).
  - `max_session_duration_seconds`: integer `60..10800` (optional, default 10800).

---

## 2. AssemblyAI Streaming TTS (`AssemblyAI-TTS-1`)

### 2.1 WebSocket API & Connect Parameters
- **URLs:**
  - `https://www.assemblyai.com/docs/tts/api-reference/websocket-api.md`
  - `https://www.assemblyai.com/docs/tts/connect-parameters.md`
  - `https://www.assemblyai.com/docs/tts/voices.md`
- **Verified Excerpts:**
  - Endpoint: `wss://tts.us.assemblyai.com/v1/ws?token=...&voice_id=<slug_or_UUID>&language=english&sample_rate=24000&encoding=pcm_s16le`
  - **Voice parameter:** `voice_id` (takes library slug like `aai-jane`, `aai-anna` or UUID like `49c443a4-8a1d-5f7e-b70b-98bdbd9823c3`). **The parameter `voice` is retired and closes with `3006` (`voice is retired: name the voice with voice_id, for example voice_id=aai-anna`).**
  - **Supported TTS languages (`language` parameter):** `english`, `spanish`, `german`, `italian`, `portuguese`, `french`. (Hindi and other languages are not supported by AssemblyAI TTS; use device voice with an explicit badge).
  - **Client → Server messages:**
    - `{"type": "Generate", "text": "..."}` — consecutive `Generate` texts are concatenated with **no separator** (caller must preserve spaces).
    - `{"type": "Flush"}` — synthesizes buffered text and emits `FlushDone` with `flush_id`. Rate-limited by `max_control_frames_per_sec` (~3 s burst before close `3010`); never Flush per token or per clause.
    - `{"type": "Cancel"}` — cancels current synthesis; drop all incoming `Audio` until `Cancelled` arrives.
    - `{"type": "KeepAlive"}` — resets the 120-second `inactivity_timeout` (which otherwise closes with `3006`). Send every 30 s while idle.
    - `{"type": "Terminate"}` — wait for `Termination` (close `1000`) before closing socket.
  - **Server → Client messages:**
    - `Begin` (`configuration` with `voice_id`, `language`, `sample_rate`, `unknown_params`)
    - `Audio` (`audio` base64 PCM16, `flush_id`)
    - `FlushDone` (`flush_id`)
    - `Cancelled`
    - `WordBoundaries` (`flush_id`, `audio_start_ms`, `words: [{ word, start, end, confidence }]`). **Field is `word`, not `text`**, and `start`/`end` are in ms on the session timeline (subtract `audio_start_ms`).
    - `Error` (`error_type`, `retryable`)
    - `Termination`

### 2.2 Streaming TTS Temporary Token Endpoint
- **URL:** `https://www.assemblyai.com/docs/tts/authenticate-with-a-temporary-token.md`
- **Verified Excerpts:**
  - Endpoint: `GET https://token.us.assemblyai.com/v1/token?product=tts&expires_in_seconds=60&max_session_duration_seconds=3600`
  - Header: `Authorization: <ASSEMBLYAI_API_KEY>`
  - `product=tts` and `expires_in_seconds` (`1..600`) are both required.
  - Maximum session duration is 1 hour (`3600` seconds, closes with `3008` at the cap). Mint a fresh token for every connection attempt and reconnect.

---

## 3. LiveKit Telephony & AssemblyAI Plugin

- **URLs:**
  - `https://docs.livekit.io/telephony/start/phone-numbers.md`
  - `https://docs.livekit.io/agents/models/tts/assemblyai.md`
- **Verified Excerpts:**
  - "All LiveKit Cloud plans include 1 free US local phone number. The Build plan also includes 50 free inbound minutes."
  - "LiveKit Phone Numbers currently only supports inbound calling."
  - Python plugin: `uv add "livekit-agents[assemblyai]~=1.8"`, `assemblyai.STT(model="universal-3-6-pro")`, `assemblyai.TTS(model="assemblyai-tts-1", voice="<UUID>", language="english", sample_rate=24000)`.
  - Custom cloned voices require the AssemblyAI plugin (not LiveKit Inference).

---

## Crisis contacts (T0.3), checked 2026-11-02

Search results only; the owner should open each page once before release (the master prompt marks these numbers "re-check").

- **NHS 111, mental health option (England):** https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/behaviours/help-for-suicidal-thoughts/ and several NHS trust pages ("call 111 and choose the mental health option"; some say option 2). Wording in the app: "choose the mental health option (option 2 in most of England)". Scotland, Wales and Northern Ireland have their own routes; the app does not claim they use option 2.
- **Samaritans 116 123, 24/7, free:** https://www.samaritans.org (listed by NHS pages above).
- **Shout, text SHOUT to 85258, 24/7, UK:** https://giveusashout.org
- **988, Canada (call or text, English and French):** https://988.ca/about ; **988, US (call or text):** the US 988 Suicide & Crisis Lifeline; the search did not return a US page, so this one rests on common knowledge until the owner opens https://988lifeline.org.
- **Anywhere else:** https://findahelpline.com (lists the Canadian 988 service, so it is a live directory).
- Region choice: browser time zone first, then the language's country; unknown shows every region (src/lib/safety/region.ts).
