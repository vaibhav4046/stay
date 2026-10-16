# Data Privacy & Governance (`docs/DATA_PRIVACY.md`)

## 1. Data Minimisation Principles

Stay is designed for adults with ADHD who need practical support without invasive surveillance:
1. **No raw audio recording storage:** Voice audio is streamed ephemerally to AssemblyAI (`wss://agents.assemblyai.com/v1/ws`) for real-time speech-to-text and voice response. Stay does not store raw audio files in Supabase or browser storage.
2. **Structured session records only:** By default, Stay stores only the structured task text, selected barrier, chosen strategy, shrunk first step, focus duration, and outcome (`started`, `partly_started`, `not_started`, `paused_or_stopped`).
3. **Separation of synthetic demo data:** All sample data in `/demo` is stored in an isolated in-memory / demo namespace and explicitly labeled *"Sample data — not a real user or clinical record"*.

---

## 2. Storage & Row-Level Security (RLS)

- **Supabase PostgreSQL Tables (`supabase/migrations/001_stay_schema.sql`):**
  - `profiles`: Care context (`waitlisted`, `medicated`, `in_therapy`, `self_managing`, `prefer_not_to_say`), interaction mode, proactive check-in preference.
  - `coach_sessions`: Structured coaching loop records and outcomes.
  - `treatment_checkins`: Self-reported treatment adherence, focus rating, sleep quality, and plain-text side-effect notes for clinician discussion.
  - `audit_events`: User-visible log of tool calls, exports, and safety events.
- **Row-Level Security:** Every table enforces `auth.uid() = user_id` across `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
- **Local-First Mode:** Users who use Stay without a cloud account store their records locally in their browser (`localStorage` key namespace `stay_v1_*`) and have identical one-click export and delete controls.

---

## 3. User Data Rights & Controls (`/app/settings` & `/app/reports`)

1. **Clinician PDF Preview & Section Toggles:** Nothing is exported without the user previewing the exact summary and choosing which sections (e.g., treatment notes, barriers, strategy table) to include.
2. **Full JSON Data Export:** Users can download a complete JSON archive of their profile, coaching sessions, treatment check-ins, and audit events at any time from `/app/settings`.
3. **One-Click Delete All Data:** Users can permanently wipe all local records and (when authenticated) delete all Supabase rows via `/api/account/delete` + client storage purge, with immediate confirmation.
