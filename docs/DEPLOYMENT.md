# Deployment Guide (`docs/DEPLOYMENT.md`)

## 1. Hosting Environment & Prerequisites

Stay is a modern Next.js 15 application designed for zero-config deployment to Vercel or any Node.js hosting platform (Render, Fly.io, Railway, AWS ECS).

### Required Environment Variables

Configure these in your hosting provider's dashboard (e.g. Vercel Project Settings -> Environment Variables):

| Variable | Description | Where used |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | AssemblyAI production API key | Server only (`/api/voice/token`, `agent:sync`) |
| `ASSEMBLYAI_AGENT_ID` | Stored Voice Agent ID (`agent_c70c56210f7c41548f7785d33dc6c8ab`) | Server only (`/api/voice/token`) |
| `GROQ_API_KEY` | Groq production API key | Server only (`/api/coach/plan`, `agent:sync`) |
| `GROQ_MODEL` | Groq chat model (default: `openai/gpt-oss-120b`) | Server only (`/api/coach/plan`) |
| `NEXT_PUBLIC_APP_URL` | Public origin of the deployment | Public client & server |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `true` to enable the interactive no-login demo | Public client |
| `NEXT_PUBLIC_SUPABASE_URL` | Optional Supabase project URL | Public client & server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional Supabase anonymous API key | Public client |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional Supabase admin service key | Server only (`/api/account/delete`) |

*Note: If Supabase variables are omitted, Stay automatically runs in local-first mode using client-side `localStorage`, requiring zero external database setup.*

---

## 2. One-Time Voice Agent Provisioning

Before or immediately after deploying, you can sync the stored AssemblyAI voice agent configuration with:

```bash
npm run agent:sync
```

This ensures the agent prompt, Anna voice (`24000` Hz PCM16), client-side tools (`propose_coaching_plan`, `start_focus_timer`, `record_session_outcome`), and Groq LLM configuration are active.

---

## 3. Production Build & Local Preview

```bash
# Production Next.js build
npm run build

# Start production server
npm run start
```
