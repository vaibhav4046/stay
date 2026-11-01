# Stay — Threat Model (`B2–B6`)

## 1. System Boundaries & Trust Zones

```
[ Browser Client (Untrusted) ]
   │  HTTPS (Same-Origin + HMAC Cookie stay_session_sig)
   ▼
[ Next.js Route Handlers (Trust Boundary) ]
   ├─ /api/voice/fast-token ──► AssemblyAI Token Service (streaming.assemblyai.com / token.us.assemblyai.com)
   ├─ /api/voice/chat       ──► LLM Provider (Groq or validated BYOK endpoint)
   ├─ /api/coach/plan       ──► Deterministic Safety Gate ──► LLM Provider
   └─ /api/mcp, /api/a2a    ──► Bearer-authenticated Agent RPC
```

---

## 2. Threats, Mitigations, and Residual Risks

| ID | Threat | Attack Vector | Mitigation in Code | Residual Risk |
|---|---|---|---|---|
| **T1** | Token minting / LLM quota exhaustion | Automated script calling `/api/voice/fast-token` or `/api/voice/chat` | `guardPaidRoute` in `src/lib/security/apiGuard.ts`: Same-Origin check (`403`), HMAC session cookie (`401`), `10` token mints/min/session, `3` concurrent voice sessions/session, `30` chat requests/min/session (`429` + `Retry-After`), plus IP rate limit layer. | **In-memory rate limiters are per serverless instance.** Across multiple Vercel edge/node instances, a distributed attacker can multiply the per-instance allowance unless Upstash/Vercel KV is configured. |
| **T2** | Prompt injection & system role spoofing | Client sending `role: "system"` in `/api/voice/chat` or injecting instructions via spoken transcript | `/api/voice/chat` rejects any `role: "system"` message (`400`), caps history at `<= 20` turns and `<= 8 KB` (`413`), and prepends `buildServerVoiceSystemPrompt()` on the server. All tool arguments are validated against `AppActionArgsSchema` outside the model. | LLM outputs can still phrase text unexpectedly within the 3-beat length budget; deterministic crisis/medication checks run before and after LLM generation. |
| **T3** | SSRF via custom BYOK `baseUrl` | Supplying private IPv4/IPv6, hex/octal IP, cloud metadata IP (`169.254.169.254`), or DNS-rebinding domain (`*.nip.io`) in `x-stay-llm-base` | `safeBaseUrl()`, `isPrivateIp()`, and `resolvesPublic()` reject non-HTTPS, IP literals, hex/octal IPs, IPv4-mapped IPv6 (`::ffff:7f00:1`, `::ffff:a9fe:a9fe`), Teredo, 6to4, and private DNS A/AAAA records; `fetch` uses `redirect: "error"`. | Time-of-check to time-of-use (TOCTOU) between `dns.lookup` and `fetch` socket connect if an attacker controls an authoritative DNS server with 0-second TTL; mitigated by preferring preset hosts (`api.groq.com`, `api.mistral.ai`, `api.openai.com`). |
| **T4** | Browser XSS stealing persisted BYOK keys | Malicious script reading `window.localStorage.getItem('stay_byok')` | `src/lib/byok/config.ts` keeps keys in memory (`memoryByok`) by default and clears `localStorage`. Opt-in `sessionStorage` requires explicit user selection. | If XSS executes while a key is active in memory or `sessionStorage`, the active tab's key could still be read. |
| **T5** | Sensitive task text leakage in telemetry | OpenInference spans recording raw ADHD worries or crisis phrases | `/api/a2a/rpc` logs only `taskLength` and high-level `safetyTrigger` category, never `taskText` or `matchedPhrase`. | Server platform access logs still record HTTP paths and status codes. |
