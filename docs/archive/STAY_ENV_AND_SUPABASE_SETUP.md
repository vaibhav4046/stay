# Stay Environment & Supabase Setup Guide (`docs/STAY_ENV_AND_SUPABASE_SETUP.md`)

**Date:** 17 October 2026  
**Target:** Local Development & Supabase Cloud Production

---

## 1. Environment Variables Configuration

Create a `.env.local` file in the project root:

```ini
# ==============================================================================
# Stay — Environment Variables
# ==============================================================================

# 1. AssemblyAI Voice Agent (Required for real-time full-duplex voice)
# Server-only secret used by /api/voice/token to mint single-use ephemeral tokens.
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here

# 2. Groq LLM API (Required for high-speed OpenAI-compatible coach inference)
# Server-only secret used by /api/coach/plan.
GROQ_API_KEY=your_groq_api_key_here

# 3. Supabase Cloud Configuration (Optional: Stay runs 100% offline in Guest Mode without these)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# 4. Next.js Public App URL (For OAuth redirects and PWA manifest)
NEXT_PUBLIC_APP_URL=https://stay-two-swart.vercel.app
```

> [!NOTE]
> If `NEXT_PUBLIC_SUPABASE_URL` is omitted, Stay seamlessly defaults to **Guest Mode**, storing all sessions, check-ins, memory, and settings in browser `localStorage`. No features are locked.

---

## 2. Supabase SQL Schema & Row Level Security (RLS)

Run the following SQL migration script in the **Supabase SQL Editor** (`https://supabase.com/dashboard/project/<your-project-ref>/sql`):

```sql
-- ==============================================================================
-- Stay Database Schema & Row-Level Security Policies
-- ==============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    care_context TEXT NOT NULL DEFAULT 'adhd_diagnosed',
    interaction_mode TEXT NOT NULL DEFAULT 'voice_and_text',
    proactive_checkins BOOLEAN NOT NULL DEFAULT true,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only select their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can only insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can only update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- 2. Coach Sessions Table
CREATE TABLE IF NOT EXISTS public.coach_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ,
    mode TEXT NOT NULL DEFAULT 'voice',
    care_context TEXT NOT NULL DEFAULT 'adhd_diagnosed',
    task_text TEXT NOT NULL,
    barrier_type TEXT NOT NULL,
    strategy_key TEXT NOT NULL,
    first_step TEXT NOT NULL,
    planned_minutes INTEGER NOT NULL DEFAULT 5,
    actual_seconds INTEGER,
    outcome TEXT,
    helpful_rating INTEGER,
    crisis_triggered BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only select their own sessions"
    ON public.coach_sessions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own sessions"
    ON public.coach_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own sessions"
    ON public.coach_sessions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own sessions"
    ON public.coach_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- 3. Treatment Check-ins Table
CREATE TABLE IF NOT EXISTS public.treatment_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    taken_status TEXT NOT NULL,
    side_effects_noted BOOLEAN NOT NULL DEFAULT false,
    side_effect_note TEXT,
    focus_rating INTEGER,
    sleep_quality INTEGER
);

ALTER TABLE public.treatment_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only select their own checkins"
    ON public.treatment_checkins FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own checkins"
    ON public.treatment_checkins FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own checkins"
    ON public.treatment_checkins FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only delete their own checkins"
    ON public.treatment_checkins FOR DELETE
    USING (auth.uid() = user_id);

-- 4. Long-Term Cognitive User Memory Table
CREATE TABLE IF NOT EXISTS public.user_memory (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    role_or_field TEXT,
    core_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
    known_strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    facts JSONB NOT NULL DEFAULT '[]'::jsonb,
    recent_sessions_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_active TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only select their own memory profile"
    ON public.user_memory FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own memory profile"
    ON public.user_memory FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only update their own memory profile"
    ON public.user_memory FOR UPDATE
    USING (auth.uid() = user_id);

-- 5. Audit Log Events Table (For GDPR / HIPAA Transparency)
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    event_type TEXT NOT NULL,
    event_summary TEXT NOT NULL
);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only select their own audit log"
    ON public.audit_events FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can only insert their own audit events"
    ON public.audit_events FOR INSERT
    WITH CHECK (auth.uid() = user_id);
```

---

## 3. Google OAuth Setup Instructions

To enable one-click Google Sign-In with Supabase:

1. **Google Cloud Console (`https://console.cloud.google.com`):**
   - Create a project: `Stay Companion`.
   - Configure **OAuth Consent Screen** with your application name and support email.
   - Go to **Credentials** -> **Create Credentials** -> **OAuth client ID** -> Web application.
   - In **Authorized redirect URIs**, add:  
     `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Copy the generated `Client ID` and `Client Secret`.

2. **Supabase Dashboard (`https://supabase.com/dashboard`):**
   - Go to **Authentication** -> **Providers** -> **Google**.
   - Toggle **Enable Google provider**.
   - Paste the Google `Client ID` and `Client Secret`.
   - Click **Save**.

3. **URL Configuration:**
   - Under **Authentication** -> **URL Configuration**:
   - Set **Site URL** to: `https://stay-two-swart.vercel.app` (or `http://localhost:3000` for development).
   - In **Redirect URLs**, add:  
     `https://stay-two-swart.vercel.app/**` and `http://localhost:3000/**`.

---

## 4. Guest Mode & Cloud Sync Architecture

Stay enforces a zero-barrier onboarding design:
1. **Unauthenticated Users (Guest Mode):**
   - Can immediately talk to the Stay Signal orb or type a task.
   - All session logs, check-ins, cognitive profile data, and PDF reports reside entirely in browser `localStorage`.
   - Zero personal data is transmitted to external databases.
2. **Account Linking:**
   - When a user decides to sign in via Google OAuth or email magic link, Stay automatically reads the local `localStorage` queue, prompts the user for consent, and batches writes to the Supabase tables under their authenticated `auth.uid()`.
   - One-click "Erase All Data" wipes both local storage and cloud records immediately.
