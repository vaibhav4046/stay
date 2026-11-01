# Stay — Security Audit & Remediation Report (`B2–B6`)

## 1. Executive Summary
This document records the security audit and remediation performed across Stay's API routes, LLM boundary, Bring-Your-Own-Key (BYOK) configuration, and agent endpoints (`/api/mcp`, `/api/a2a/rpc`) on branch `hackathon-hardening`.

---

## 2. Findings & Fixes Implemented

### 2.1 Paid API Routes (`/api/voice/fast-token`, `/api/voice/token`, `/api/voice/chat`, `/api/voice/tts`, `/api/orb/shape`, `/api/coach/plan`) — **FIXED (`B2`)**
- **Prior state:** Paid routes relied only on a loose per-IP counter (`25` per 10 min or `60` per min), did not verify `Origin`/`Host` headers, did not issue or verify signed session cookies, did not enforce a request body byte cap before `req.json()`, and did not return `Retry-After` on `429`.
- **Remediation (`src/lib/security/apiGuard.ts`):**
  - **Same-Origin Verification (`verifySameOrigin`):** Rejects requests where `Origin` host does not match `Host` / `X-Forwarded-Host` with HTTP `403`.
  - **Signed Anonymous Session Cookie (`stay_session_sig`):** Mints and verifies an HMAC-SHA256 signed session cookie (`<sessionId>.<issuedAtSec>.<hexHmac>`, `HttpOnly; SameSite=Lax; Max-Age=86400`) using `crypto.timingSafeEqual`. Tampered or expired cookies return HTTP `401`.
  - **Request Size Cap (`readBoundedJson`):** Rejects requests exceeding `32 KB` (`32,768` bytes) via both `Content-Length` precheck and UTF-8 buffer byte-length check with HTTP `413`.
  - **Layered Rate Limiting & Concurrency (`guardPaidRoute`):**
    - `token`: `10` token mints/min/session (`20`/min/IP) and max `3` concurrent active voice sessions per session (`x-stay-voice-instance`).
    - `chat`: `30` requests/min/session (`60`/min/IP).
    - `coach`: `20` requests/min/session (`40`/min/IP).
    - Exceeding any limit returns HTTP `429` with a `Retry-After` header.

### 2.2 Server-Side LLM Boundary (`/api/voice/chat`) — **FIXED (`B3`)**
- **Prior state:** `/api/voice/chat` accepted `role: 'system'` messages directly from the client and allowed up to `40` messages of `4,000` characters each.
- **Remediation (`src/app/api/voice/chat/route.ts` & `src/lib/voice/agentTool.ts`):**
  - Rejects any client-supplied `role: 'system'` message with HTTP `400`.
  - Bounds conversation history to `<= 20` turns and `<= 8 KB` (`8,192` bytes) total content (`413` if exceeded).
  - Pre-builds the system prompt exclusively on the server (`buildServerVoiceSystemPrompt`) and treats user transcripts as untrusted data.
  - Validates tool calls outside the model via `validateAppActionArgs` (`AppActionArgsSchema`).

### 2.3 Bring-Your-Own-Key (BYOK) Storage & SSRF Hardening — **FIXED (`B4`)**
- **Prior state:**
  - `src/lib/byok/config.ts` persisted raw API keys to `window.localStorage` by default and returned unvalidated config on load.
  - `src/lib/llm/provider.ts` used `redirect: 'manual'` instead of `redirect: 'error'` and did not reject hex-encoded IPv4-mapped IPv6 (`::ffff:7f00:1`, `::ffff:a9fe:a9fe`), Teredo (`2001:0000::/32`), 6to4 (`2002::/16`), hex/octal IPv4 authorities, or DNS rebinding suffixes (`*.nip.io`, `*.sslip.io`).
- **Remediation:**
  - `src/lib/byok/config.ts`: Stores keys in an in-memory variable (`memoryByok`) by default and clears `localStorage`. Opt-in `sessionStorage` persistence is used only when `persistSession: true` is explicitly passed. `loadByok()` validates saved config with `validateByokConfig` and `safeBaseUrl`, returning `EMPTY_BYOK` if invalid.
  - `src/lib/llm/provider.ts` & `src/lib/llm/stream.ts`: Hardened `safeBaseUrl()` and `isPrivateIp()`, added custom lookup injection to `resolvesPublic()` for stubbed SSRF testing, and switched `fetch` to `redirect: 'error'`.

### 2.4 MCP & A2A Endpoints (`/api/mcp`, `/api/a2a/rpc`) — **FIXED (`B5`)**
- **Prior state:** Unauthenticated in production, contained a banned dopamine-mechanism claim in `/api/mcp`, logged raw `taskText` in `/api/a2a/rpc` spans, and returned `Access-Control-Allow-Origin: *`.
- **Remediation:**
  - Enforced `guardPaidRoute` + `Bearer <STAY_AGENT_API_TOKEN>` check when `STAY_AGENT_API_TOKEN` is configured, `NODE_ENV === 'production'`, or `x-stay-require-agent-auth: 1` is set.
  - Removed the dopamine claim in `/api/mcp`.
  - Removed raw `taskText` and `matchedPhrase` from telemetry spans in `/api/a2a/rpc`.
  - Removed wildcard `Access-Control-Allow-Origin: *`.

---

## 3. Client Bundle Secret Scan (`B6`)
Scanned `.next/static` for `ASSEMBLYAI_API_KEY`, `GROQ_API_KEY`, `ELEVENLABS_API_KEY`, `STAY_SESSION_SECRET`, `gsk_`, and `sk-`.
- **Result:** `0` server secrets present in `.next/static`.
