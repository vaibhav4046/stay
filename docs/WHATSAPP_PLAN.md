# Stay WhatsApp Companion Architecture & Safety Plan

> **Status: `NOT_RUN` (Deferred / Stretch Architecture)**
>
> Stay intentionally leaves `STAY_WHATSAPP=0` enabled by default to prevent unsolicited outbound messaging and preserve zero-cloud privacy guarantees unless explicit user opt-in and Meta Cloud API credentials are configured.
> Stay is an ADHD task initiation self-help companion; it is never a "24/7 therapist" or clinical service.

---

## 1. System Architecture

```
User Voice Note (WhatsApp)
          ↓
Meta Cloud API Webhook (/api/whatsapp/webhook)
          ↓
AssemblyAI Pre-Recorded Audio STT (Universal-3.6 / Core)
          ↓
Safety Guard (Crisis & Medication Filter)
          ↓
Stay ADHD Coach LLM (3-beat concise prompt, max 75 tokens)
          ↓
Meta Cloud API Outbound Send Message (Within 24h Customer Service Window)
```

---

## 2. Inbound Voice Note Processing

1. **Webhook Ingestion**:
   - Verify SHA-256 HMAC signature using `X-Hub-Signature-256` and `WHATSAPP_APP_SECRET`.
   - Extract media ID for incoming `.ogg` / `.opus` voice notes.
2. **Media Download & Decryption**:
   - Fetch media URL using Graph API token.
   - Stream audio bytes with rate-limiting.
3. **AssemblyAI Pre-Recorded STT**:
   - Upload audio stream to AssemblyAI upload API (`https://api.assemblyai.com/v2/upload`).
   - Request transcription with `speech_model="universal-3-6-pro"`.
   - Poll or receive webhook on transcription completion.

---

## 3. Pacing & Boundary Rules

1. **3-Beat Response Format**:
   - Beat 1: Warm acknowledgment ($\le 6$ words).
   - Beat 2: One tiny concrete physical step ($\le 15$ words).
   - Beat 3: Optional short question ($\le 8$ words).
2. **Clinical Boundaries**:
   - Crisis keywords trigger immediate crisis line redirect and stop coaching flow.
   - Medication dosing questions trigger deterministic referral to prescribing clinician or GP.
3. **Opt-in & Frequency Limits**:
   - Proactive nudges ("Your 2-minute focus block?") only sent to explicitly opted-in users.
   - Maximum 2 proactive messages per day.
   - Any incoming message containing "STOP", "UNSUBSCRIBE", or "PAUSE" immediately removes user from the nudge queue.

---

## 4. Environment Variables Specification

When ready to run in production:
```env
STAY_WHATSAPP=0                     # Set to 1 only after Meta business verification
WHATSAPP_VERIFY_TOKEN="<random>"     # Webhook challenge verification token
WHATSAPP_ACCESS_TOKEN="<meta_token>" # Graph API bearer token
WHATSAPP_PHONE_NUMBER_ID="<id>"      # Meta Cloud phone number ID
WHATSAPP_APP_SECRET="<secret>"       # Webhook signature verification
```
