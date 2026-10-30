# STAY SECURITY, PRIVACY & HEALTH-BOUNDARY AUDIT
**Date:** 2026-10-31T00:00:00Z  
**Branch:** feat/omnirush-continuous-voice  
**Target:** Stay Voice-First ADHD Task Initiation Companion  
**Methodology:** Source-to-sink threat modeling based on Cloudflare Security Audit patterns, OWASP Top 10 API Security, and Clinical Boundary Protocols.

---

## 1. Secrets & Credential Lifecycle
- **Server-Side API Credentials:**
  - \`ASSEMBLYAI_API_KEY\` and \`GROQ_API_KEY\` are accessed strictly via server-side routes (\`/api/voice/token\`, \`/api/voice/fast-token\`, \`/api/voice/chat\`).
  - No secret environment variables use \`NEXT_PUBLIC_\` prefix.
  - Tracked source code, git diffs, and package manifests were scanned; zero raw credentials committed.
- **Client BYOK (Bring-Your-Own-Key) Pattern:**
  - Users may provide their own AssemblyAI or Azure Speech keys.
  - BYOK credentials are transmitted to server routes via ephemeral HTTP headers (\`x-stay-aai-key\`, \`x-stay-tts-key\`).
  - Keys are consumed strictly per-request and are never stored in server databases, session cookies, or server log files.
- **Browser Ephemeral Token Minting:**
  - Browser clients never connect to AssemblyAI using account root keys.
  - \`/api/voice/token\` mints single-use temporary tokens with a 180s expiration window.
  - \`/api/voice/fast-token\` mints temporary STT/TTS tokens with a 120s expiration window.
  - Token minting endpoints enforce an IP-based rate limit of 25 requests per 10-minute window to prevent quota exhaustion attacks.

---

## 2. Server-Side Request Forgery (SSRF) Defense
- **Implementation:** \`src/lib/llm/provider.ts\` and \`tests/unit/ssrf.test.ts\` (38 passing unit tests).
- **Enforcement:**
  - \`isPrivateIp()\` blocks all IPv4/IPv6 loopback addresses (\`127.0.0.1\`, \`::1\`), private RFC1918 subnets (\`10.0.0.0/8\`, \`172.16.0.0/12\`, \`192.168.0.0/16\`), carrier-grade NAT (\`100.64.0.0/10\`), link-local metadata (\`169.254.169.254\`), and non-routable interfaces (\`0.0.0.0\`).
  - \`resolvesPublic()\` validates DNS resolution asynchronously before dispatching outbound requests to prevent DNS rebinding attacks.

---

## 3. Audio & Transcript Privacy
- **Microphone Consent:**
  - Microphone access is initiated exclusively through an explicit user gesture ("Talk to Stay" button).
  - Web Audio input tracks are stopped and unmounted immediately upon session disconnection.
- **Audio Persistence:**
  - Stay stores zero raw audio recordings on its servers. Audio streams as transient PCM16 chunks through the WebSocket connection to AssemblyAI.
- **Transcript Storage:**
  - Transcripts reside in browser \`localStorage\` under user control.
  - "Delete All Data" button in Settings executes a full purge of local transcripts, parked thoughts, routines, and custom instructions.

---

## 4. Content Security Policy (CSP) & HTTP Headers
- **Headers Verified via Playwright E2E:**
  - \`Content-Security-Policy\`:
    - \`default-src 'self'\`
    - \`frame-ancestors 'none'\` (Anti-clickjacking)
    - \`object-src 'none'\`
    - \`connect-src 'self' wss://streaming.assemblyai.com wss://streaming-tts.assemblyai.com wss://tts.us.assemblyai.com wss://agents.assemblyai.com https://*.supabase.co wss://*.supabase.co\`
    - \`worker-src 'self' blob:\`
  - \`X-Frame-Options: DENY\`
  - \`X-Content-Type-Options: nosniff\`
  - \`Referrer-Policy: strict-origin-when-cross-origin\`
  - \`Permissions-Policy: camera=(), microphone=(self), geolocation=(), display-capture=()\`

---

## 5. Health, Crisis & Diagnostic Boundaries
- **Acute Crisis Interception:**
  - \`src/lib/safety/crisis.ts\` intercepts statements indicating self-harm or suicidal ideation (\`"I want to die"\`, \`"I want to kill myself"\`, \`"quiero morir"\`, etc.).
  - Coaching is halted immediately. A high-contrast emergency screen displays UK emergency contacts:
    - **999**: Emergency services
    - **NHS 111**: Urgent medical advice
    - **116 123**: Samaritans (24/7 free call)
    - **85258**: Shout Crisis Text Line
- **Medical & Medication Advice Refusal:**
  - Any inquiry regarding prescription dosages, drug interactions, or diagnostic labeling triggers a strict refusal boundary:
    - *"I cannot provide medical advice, diagnosis, or medication recommendations. Please speak with your doctor or pharmacist."*
- **Non-Shaming Tone Enforcement:**
  - The voice prompt and outputs explicitly ban shaming triggers: *"streak lost"*, *"behind"*, *"lazy"*, *"should have"*, *"failed"*.

---

## 6. Known Limitations & Disclosures
- **Client-Side Storage:** BYOK keys stored in \`localStorage\` rely on the host operating system's device security. If a user shares an unlocked device, keys could be read by another local user.
- **Third-Party Processing:** Audio data transits AssemblyAI's infrastructure under their standard API terms and data privacy policies.
- **Non-Clinical Disclaimer:** Stay is a behavioral initiation and focus companion, not a medical device, diagnostic tool, or clinical psychiatric therapy substitute.
