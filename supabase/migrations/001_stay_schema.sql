-- Stay — Supabase PostgreSQL Schema & Row-Level Security
-- Migration: 001_stay_schema.sql

create extension if not exists pgcrypto;

-- 1. User Profiles & Care Context
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  care_context text not null default 'self_managing'
    check (care_context in ('waitlisted', 'medicated', 'in_therapy', 'self_managing', 'prefer_not_to_say')),
  interaction_mode text not null default 'voice_and_text'
    check (interaction_mode in ('voice_and_text', 'quiet_text_only')),
  proactive_checkins boolean not null default true,
  onboarding_completed boolean not null default false
);

-- 2. Task-Initiation Coaching Sessions
create table if not exists public.coach_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  mode text not null default 'voice'
    check (mode in ('voice', 'text')),
  care_context text not null default 'self_managing'
    check (care_context in ('waitlisted', 'medicated', 'in_therapy', 'self_managing', 'prefer_not_to_say')),
  task_text text not null check (char_length(task_text) between 1 and 280),
  barrier_type text not null
    check (barrier_type in (
      'overwhelm',
      'unclear_next_step',
      'perfectionism_or_fear',
      'boredom_or_distraction',
      'low_energy',
      'other'
    )),
  strategy_key text not null
    check (strategy_key in (
      'task_shrinking',
      'implementation_intention',
      'reframing',
      'timeboxing'
    )),
  first_step text not null check (char_length(first_step) between 1 and 280),
  planned_minutes integer not null default 10 check (planned_minutes between 1 and 60),
  actual_seconds integer check (actual_seconds is null or actual_seconds >= 0),
  outcome text
    check (outcome is null or outcome in ('started', 'partly_started', 'not_started', 'paused_or_stopped')),
  helpful_rating integer check (helpful_rating is null or helpful_rating between 1 and 5),
  crisis_triggered boolean not null default false
);

-- 3. Treatment & Daily Adherence Check-ins
create table if not exists public.treatment_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  taken_status text not null
    check (taken_status in ('taken', 'skipped', 'not_applicable', 'prefer_not_to_say')),
  side_effects_noted boolean not null default false,
  side_effect_note text check (side_effect_note is null or char_length(side_effect_note) <= 280),
  focus_rating integer check (focus_rating is null or focus_rating between 1 and 5),
  sleep_quality integer check (sleep_quality is null or sleep_quality between 1 and 5)
);

-- 4. User-Visible Audit Events
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  event_type text not null check (char_length(event_type) between 1 and 80),
  event_summary text not null check (char_length(event_summary) between 1 and 280)
);

-- Indexes for fast timeline & report queries
create index if not exists idx_coach_sessions_user_created
  on public.coach_sessions (user_id, created_at desc);

create index if not exists idx_treatment_checkins_user_created
  on public.treatment_checkins (user_id, created_at desc);

create index if not exists idx_audit_events_user_created
  on public.audit_events (user_id, created_at desc);

-- Enable Row-Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.coach_sessions enable row level security;
alter table public.treatment_checkins enable row level security;
alter table public.audit_events enable row level security;

-- RLS Policies: Users can only read/write/delete their own rows
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

create policy "coach_sessions_all_own" on public.coach_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "treatment_checkins_all_own" on public.treatment_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "audit_events_all_own" on public.audit_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
