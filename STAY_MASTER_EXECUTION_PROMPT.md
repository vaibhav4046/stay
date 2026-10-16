# STAY — Autonomous Hackathon Build, Product, Design, Voice, Demo, and GTM Master Prompt

**Target deadline:** Friday, 23 October 2026  
**Primary objective:** Deliver a real, deployed, judge-ready product that demonstrably helps a user go from task avoidance to a started action, records the outcome, learns transparently from repeated sessions, and creates a user-controlled clinician summary.  
**Working rule:** Inspect, build, verify, deploy, and prepare the submission package autonomously. Do not stop after producing a plan or attractive mockups.

---

## 0. EXECUTION DIRECTIVE

You are the complete product team operating inside the current Antigravity project/repository: principal product engineer, full-stack engineer, real-time voice engineer, UX researcher, product designer, 3D/motion designer, security reviewer, QA engineer, video editor, launch strategist, and technical writer.

You may have access to these coding/reasoning models: Claude Opus 5.5, Argon, Gemini 3.8 Flash, and DeepSeek V4.1 Flash. Use them as a deliberate review/execution ladder, not as four agents independently rewriting the same repository:

1. **Gemini 3.8 Flash in Antigravity:** primary implementation and browser/terminal execution, where available.
2. **Claude Opus 5.5:** architecture, threat modelling, difficult debugging, clinical/product-safety review, and final quality critique. Use only for high-value tasks.
3. **Argon:** independent design and interaction critique, complex UI/3D decisions, and visual-polish review when available.
4. **DeepSeek V4.1 Flash:** bounded implementation, test repair, migration, documentation, and fallback coding tasks when the primary executor reaches a limit.
5. **Groq API:** runtime language model for the actual Stay voice agent through AssemblyAI's custom OpenAI-compatible LLM integration, subject to a working end-to-end compatibility test.

Do not burn context by asking every model to redo the same implementation. Delegate sharply scoped tasks, keep decisions in repository documentation, and have one lead integrator own the code. If a named model is not actually available in this environment, continue using the available model and report that limitation without blocking.

### Non-negotiable behaviour

- Start by inspecting the existing repository, Git state, existing architecture, build scripts, dependencies, routes, tests, database state, current deployment and existing environment-variable *names*. Preserve working parts and enhance the actual application. Do not blindly replace a functioning repository with a new scaffold.
- Do not ask the user to make routine product or implementation decisions. Choose the safest reasonable default and record the decision.
- Never print, log, commit, expose, screenshot, or place API key values in the browser bundle. Inspect only whether required secrets are present, and redact values in all output.
- Never claim something works unless it was executed and verified. Do not fabricate a live URL, GitHub repo, demo recording, metrics, deployment status or submission receipt.
- Continue through all phases. Run the application, tests, type checks, lint and production build. Use the available browser tool to click through the real application, not just inspect source code.
- When blocked by missing account authorization, deployment login, required credential or human-only approval, finish every independent task first, create the best possible preview/local deliverable, and provide the smallest exact unblock step. Never silently pretend the external step succeeded.
- No real patient data in the hackathon demo. All seeded identities, sessions, adherence logs and reports must be synthetic and visibly labelled as sample data.
- Prioritize one excellent end-to-end product loop over breadth. Add stretch capabilities only after the main loop is real, tested and demonstrable.

### First action

Inspect the repository and current browser/deployment context. Read `package.json`, the lockfile, `README`, `AGENTS.md`, `CLAUDE.md`, `.cursor/rules`, existing project instructions, route tree, all existing pages, Supabase migrations/policies, Vercel config, and all test/build scripts. Check `git status` before touching files. Summarize findings into `docs/BUILD_AUDIT.md`, then start implementation immediately. Do not stop and ask for approval of ordinary implementation choices.

---

## 1. PRODUCT THESIS: STAY

### The single-sentence proposition

**Stay helps adults with ADHD make a start on the task they are avoiding, records what helped, and prepares a clear progress summary they can choose to share with their clinician.**

Main landing-page headline: **“When starting is the hard part.”**  
Supporting line: “Talk through what's getting in the way. Find one manageable first step. Stay with it for a few minutes.”  
Primary CTA: **Try a short session**.  
Secondary CTA: **Explore the demo**.

Stay is a supportive tool, not a diagnostic service, a replacement for prescribed treatment, or a proven ADHD treatment. Avoid claims that it cures ADHD, guarantees adherence, improves symptoms, detects emotional states accurately, or matches outcomes in clinical trials. Cause selection and personalised strategy recommendations are hypotheses to measure with user-reported outcomes.

### Primary users

- Adults with ADHD who struggle to initiate tasks.
- People waiting for assessment or treatment in the UK.
- People already receiving care who want practical day-to-day support.
- People who prefer speaking to typing, with full typed-input parity.

The product's accessibility standard is broad: the experience should also work for someone tired, anxious, overwhelmed, unfamiliar with AI, using a small phone, using a screen reader, in a shared room, or temporarily unable to use a microphone.

### Core job to be done

“I know what I need to do. I am not starting. Help me find a small first step without making me feel worse.”

### Product differentiation

Demonstrate a complete closed loop:

**spoken task → clarified obstacle → bounded strategy → concrete first step → timer → proactive opt-in check-in → recorded outcome → transparent pattern → user-controlled clinician PDF.**

Do not claim there is no competing product or that the market has no equivalent. Demonstrate why this particular loop is useful and unusually complete.

---

## 2. DESIGN REFERENCES AND REQUIRED DESIGN CONTRACT

Use each reference for a distinct job. Do not clone screenshots or reproduce proprietary assets. Inspect the actual pages and available images, record observed patterns, then create an original Stay design system.

### Refero: core product UX

- Refero search for voice UI: https://refero.design/?q=voice%20app
- Refero Styles search for voice UI: https://styles.refero.design/?q=voice+app
- Perplexity AI style reference: https://styles.refero.design/style/e9fff87a-63ce-4c19-840f-98233db62f58
- Hims health-product style reference: https://styles.refero.design/style/0a489bce-4f93-4b38-b612-d87b1d00999e
- Refero Clean SaaS collection: https://styles.refero.design/design-styles/clean-saas
- Refero web app and mobile app galleries: https://refero.design/web-apps and https://refero.design/ios-apps

Borrow the clear focal action, restrained accent, practical hierarchy, polished empty/loading/error states, and health-product trust cues. Do not copy an exact app screen. If any supplied deep link changes, use the public Refero search/gallery and document the replacement URL.

### MotionSites: cinematic public-facing 3D

- Main gallery: https://motionsites.ai/
- 3D website collection: https://motionsites.ai/3d-websites
- 3D tutorial/academy: https://motionsites.ai/academy
- A general motion-reference collection: https://motionsites.ai/backgrounds

Use MotionSites to study composition, deliberate motion, scroll choreography and the quality bar for a premium web hero. The application itself must stay calm, fast, readable and low-distraction. Use one memorable custom 3D element in the hero and a smaller version/state representation in the live voice experience.

### Product-quality and agent workflow references

- Caveman skill: https://github.com/JuliusBrussee/caveman
- Ponytail skill: https://github.com/dietrichgebert/ponytail
- Design Engineering agent skill graph: https://github.com/AgentsORG/design-engineering
- Alternate focused frontend-design skill: https://github.com/Xialiang98/design-visual-frontend
- HyperFrames video generation: https://github.com/heygen-com/hyperframes
- HyperFrames documentation: https://hyperframes.heygen.com/introduction
- Supademo interactive embeds: https://supademo.com/features/embed
- Supademo embed documentation: https://docs.supademo.com/share/embed

Evaluate each repository's license, install steps, maintenance, permissions, compatibility and security before installing. Do not blindly install all skills. Preferred: install the design-engineering skill (if compatible) and HyperFrames' core skills; use Caveman/Ponytail where supported and where they do not obscure precise requirements or security warnings.

### Visual direction: “Quiet kinetic instrument”

Stay should feel like a thoughtful, contemporary wellbeing tool with crafted motion. It should not look like a generic AI startup, hospital portal, meditation clone, therapy stock website, or gamified todo app.

Base palette:
- Canvas: `#FAF8F5`
- Surface: `#FFFFFF`
- Recessed surface: `#F1EFE9`
- Primary ink: `#212422`
- Secondary ink: `#626B66`
- Muted text: `#747A75` only where contrast is still adequate
- Border subtle: `#E9E6DF`
- Border strong: `#D5D1C8`
- Primary accent: `#006A67`
- Primary accent hover: `#005653`
- Focus ring: high-visibility combination of accent and offset, checked in browser
- Success/warning/danger/info: explicit semantic tokens with accessible contrast; never use colour as the sole indicator.

Typography:
- Choose a readable, high-quality text family. Start by comparing **DM Sans** and **Instrument Sans** (or an existing high-quality project font) in actual screen captures. Use one family for interface/body and, only if justified, a second display face. Do not default automatically to Inter/Geist/Space Grotesk.
- Body 16–18px, generous line height (around 1.5–1.65), strong small-text contrast.
- Display copy should be warm and compact. In-app heading 26–34px depending on viewport. Body and labels never shrink merely to fit a decorative composition.
- Use 400 regular body, 500 medium, 600 semibold; avoid weight proliferation.

Tokens:
- 4px micro spacing; 8px base grid; predictable 8/12/16/24/32/48/64/88/112 spacing.
- Radius: 6px compact chip, 10px control, 14px panel, 20px hero/large surface, pill only for genuinely pill-shaped control.
- Surfaces are distinguished primarily by colour and borders, not large shadows.
- Define typography, spacing, radii, border, surface, semantic colour, focus, elevation, z-index and motion tokens in one place. Use CSS variables and Tailwind semantic aliases, never scattered arbitrary hex values.
- Use SVG or a purposeful icon set. Avoid emoji as product iconography. Avoid an entire interface built out of generic icons.
- Use copy as the first visual hierarchy. Keep the main task action visibly primary.

Motion grammar:
- Small acknowledgement 120–180ms; standard interface transition 180–260ms; larger page transitions 280–420ms only when they communicate navigation/state.
- Prefer ease-out / restrained cubic-bezier. No overshooting springs as a default; no decorative loops. Animate only to express focus, listening, speaking, progress, completion or meaningful transition.
- Respect `prefers-reduced-motion`. Provide a still, non-WebGL fallback. Pause nonessential continuous animation when off-screen or when the user prefers reduced motion.

### The original 3D concept

Create an original **“Stay signal”**: a tactile, sculptural, soft-edged object/field built with a small, lazy-loaded Three.js / React Three Fiber scene if the repository stack allows. It should feel like a crafted audio instrument, not an AI gradient blob, random orb, neon ring, liquid-glass ball, or stock 3D download.

- On the public landing page, its motion is subtle and tells a story of noise settling into a single clear pulse. It must not compete with the headline or CTA.
- Inside the voice session, the same visual language has explicit states: idle, connecting, listening, thinking, speaking, interrupted, saving, complete and error.
- Connect animation to actual application/AssemblyAI states; never fake live microphone activity or pretend the model is listening when it is not.
- If audio energy is used, derive it only from authorised, local microphone samples and do not store raw audio. Do not use captured audio for analytics.
- Load the 3D scene lazily. Keep a static custom SVG/CSS fallback, short load time, mobile GPU fallback and meaningful accessible label. Never make completing a session depend on WebGL.
- No automatic camera movement, endless scroll hijack, autoplay audio, or excessive parallax. All voice animation can be paused; reduced motion receives a calm static representation.
- Optimize geometry, draw calls, DPR and assets. Measure performance on a normal laptop and mid-range mobile emulator before release.

### Design anti-patterns to actively remove

No generic purple/blue gradients, fake testimonials, arbitrary KPI counters, invented health metrics, neon, glassmorphism, giant shadows, card-grid spam, fake terminal windows, endless hover animations, random pastel category colours, auto-playing audio, inaccessible small text, hidden focus indicators, unexplained microphone activation, “AI magic” sparkle icons, or placeholder buttons. Do not mechanically delete components just because they are common; justify each element by the user's job.

---

## 3. INFORMATION ARCHITECTURE AND ROUTES

Inspect existing routes and preserve good ones. Ensure the following capability exists, using route names appropriate to the actual stack:

1. `/` — marketing page with clear proposition, interactive product proof, real demo entry point, privacy/safety explanation and CTA.
2. `/demo` — synthetic-data guided interactive demo, no login required; must not claim to be a real patient record.
3. `/app/today` — authenticated primary experience, one main action.
4. `/app/history` — prior session history, filters only when useful, clear empty state.
5. `/app/treatment` — optional treatment check-in and data boundary explanation.
6. `/app/reports` — report preview, export and what will be shared.
7. `/app/settings` — voice preferences, quiet mode, privacy controls, export/delete actions.
8. `/privacy` — accurate privacy notice reflecting actual SDKs, data flows, storage, retention and deletion.
9. `/terms` — plain-language terms skeleton with any professional/legal review gaps explicitly identified; do not claim legal approval.
10. A useful help/safety route or accessible crisis panel from every appropriate view.

The public demo and actual logged-in product must be visually consistent and share real components. Do not create a deceptive fake chat recording to impersonate a working live voice connection.

### Top-level navigation

Marketing: Stay wordmark, How it works, Safety & privacy, Try Stay.  
App: Today, History, Treatment, Reports; Settings and Help are secondary. On mobile use concise bottom navigation if appropriate, with a clear active state and enough room for the primary action. Avoid more than four primary destinations at a time.

---

## 4. FEATURE SPECIFICATION: THE ENTIRE PRODUCT LOOP

### A. Voice-first onboarding, about two minutes

- Ask one short question at a time and allow voice or text responses.
- Support modes: waiting for assessment/care, receiving medication, in therapy, self-managing, or prefer not to say. Do not require disclosure of a diagnosis or medication name.
- Capture only preferences needed to support a session: spoken prompts on/off, quiet/text mode, default timer lengths, and user-selected support mode.
- Explain microphone permission before prompting the browser. Do not request it until the user chooses voice.
- If permission is denied, browser speech is unsupported, the device is muted, or network access fails, provide an immediate typed fallback without blocking progress.
- Do not make the onboarding a diagnosis questionnaire. Let the user skip sensitive fields and edit preferences later.
- Persist minimal profile preferences to Supabase. Show the saved state and an error with a retry where appropriate.

### B. Daily coaching/body-double loop

The user says or types the task they are avoiding. Stay responds briefly and collaboratively, not with a long lecture.

Supported obstacles (user-selected or gently clarified, never diagnosed by the model):
- `overwhelm`
- `unclear_next_step`
- `perfectionism_or_fear`
- `boredom_or_distraction`
- `low_energy`
- `other`

Evidence-informed skill library (bounded and versioned):
1. Task shrinking: reduce the target to a two-minute or one-step action.
2. Implementation intention: “When [specific cue], I will [specific action].”
3. Reframing: encourage a rough/partial start without asserting a clinical conclusion.
4. Timeboxing: choose 5, 10 or 15 minutes and pause/stop freely.

Optional stretch strategies, only after the core four work: environmental friction reduction, body-double-style start countdown, transition countdown, brain-dump ordering and non-judgmental restart after distraction.

Conversation rules:
- Ask at most one clarifying question before offering a next step, unless the user invites more discussion.
- Keep default spoken turns to one or two short sentences and leave space for the user.
- Do not shame, nag, diagnose the underlying cause, claim to read emotions, or insist a particular intervention will work.
- Confirm the proposed first step. If the user says it is too big, shrink it further immediately.
- A “stuck” control opens a 60-second optional rescue flow, not an emergency classifier.
- Keep a visible transcript only if useful and user-configurable. Avoid saving full transcripts by default.

Timer:
- Use a reliable application-owned clock/state machine, not a model-managed timer.
- Presets 5/10/15 minutes and a custom short duration only if easy; pause, resume, stop and abandon work.
- Show remaining time accessibly. Handle tab visibility, sleep, refresh and reconnect gracefully. Store authoritative start/end timestamps and outcome status.
- Never use guilt-inducing overdue states. The user may stop without explaining.
- At completion, proactively speak a short prompt only if this session is active and the user enabled spoken check-ins. Otherwise show an in-app prompt. Do not keep an always-on/billable voice socket open just to deliver a timer reminder.

Outcome capture:
- `started`
- `partly_started`
- `not_started`
- `paused_or_stopped`
- optionally user-reported focus rating 1–5 and optional note
- record `strategy_id`, `strategy_version`, `timer_duration`, `session_started_at`, `timer_completed_at` and the outcome's own timestamp.
- Differentiate “the user reported starting” from any objective observation. Never infer that a timer completion means the task was completed.

### C. Transparent, modest personalisation

- Calculate each strategy's count of eligible attempts, number of reported starts, and observed start-rate using user-owned session records.
- Do not make claims from one attempt. Use a visible minimum sample such as 3–5 attempts before offering a tentative pattern; label the sample size and window.
- Present language such as: “You reported starting in 3 of your last 4 sessions using smaller first steps.” Do not say “the AI knows your brain” or “this treats your ADHD.”
- Let the user dismiss/reset patterns. Do not hide the denominator or cherry-pick only successful sessions.
- Do not train a new model or invent a medical prediction engine. A transparent rules/statistics model is sufficient and easier to validate.
- Test edge cases: no history, all failed starts, sparse records, strategy renamed/versioned, deleted sessions and different time zones.

### D. Treatment-aware adherence check-in

Optional, user-controlled, designed to take around 30 seconds:
- “Were you able to follow your treatment plan today?”: `yes`, `no`, `unsure`, `prefer_not_to_say`, or `not_applicable`.
- Optional free-text side-effect description, with explicit caution not to include identifiers unnecessarily.
- Self-reported focus rating (1–5) and optional note.
- An option to skip every time.

Safety rules:
- Do not ask for drug/dose by default.
- Never tell the user whether or when to take, skip, start, stop, increase or reduce medication.
- Never calculate dosages, infer adherence from reminders, label symptoms as benign, or tell a person to stop a medicine.
- For medication concerns, tell them to contact their prescriber/pharmacist. For severe or urgent symptoms, use fixed UK emergency guidance and instruct the user to seek appropriate immediate help without diagnosing.
- If voice notes contain treatment details, confirm the summary before saving. Make “edit” and “do not save” obvious.

### E. Clinician-ready one-page PDF

The user controls generation and sharing. Build a genuine PDF from actual saved records, not a static screenshot or mock file.

Report sections:
- date range and report generation time
- user-selected support mode (optional)
- number of coaching attempts and the denominator used
- self-reported task-start rate with definitions
- strategy outcomes with attempts and reported starts
- optional self-reported focus trend with a clear scale
- optional treatment check-in completion and self-report pattern (never call this verified adherence)
- user-reported side-effect notes, only when the user explicitly includes them
- questionnaire values only if a valid instrument, version, usage rights/permissions and scoring procedure have been checked; keep these separate from clinical conclusions
- neutral limitations note: “These are self-reported support logs, not a clinical assessment or proof of treatment effect.”

Add an export preview with a section-by-section inclusion toggle and a final confirmation before generating. Do not automatically send to a clinician or create public links. Keep the PDF local to the user by default; clear temporary object URLs.

### F. Optional assessment measurement

Do not present Stay as diagnosing ADHD. Do not retest the ASRS after seven days and market a score change as proof of symptom change. The ASRS asks about a longer retrospective period, so a one-week repeat is not a credible clinical outcome measure. If including the ASRS at all, verify the official current instrument/version, usage conditions and scoring instructions; let the user choose it, display proper context and use it as a user-held reference, not a diagnostic verdict. For the hackathon's short feedback loop, prefer task-start rate, time-to-start when measured, strategy attempts/successes and optional focus self-ratings.

### G. History and outcomes dashboard

Show real persisted data: recent session title, date, duration, chosen strategy, reported outcome. Offer a simple weekly summary only when enough records exist. Use compact, legible charts only when they help answer a question. Define denominator and time window. No arbitrary streaks, fake percentages, “brain score,” or red failure count.

### H. Calendar and message helper (stretch)

If all core acceptance criteria pass, add a downloadable `.ics` reminder and locally generated message draft. Never connect a calendar automatically, email anyone, send a report, or grant ongoing calendar OAuth without user action. Add clear preview and confirmation.

---

## 5. ASSEMBLYAI + UNIVERSAL-3.6 PRO + GROQ: REAL VOICE IMPLEMENTATION

**Required runtime voice engine:** AssemblyAI Voice Agent API, whose current product documentation describes its underlying speech stack as Universal-3.6 Pro Realtime ASR together with voice focus, turn detection/interruption handling and TTS. Do not implement a separate unrelated speech system and claim that the project uses this stack.

Primary official references:
- Voice Agent API: https://www.assemblyai.com/docs/voice-agents/voice-agent-api
- Browser integration and temporary token: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration
- Connect your own LLM: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/connect-your-own-llm
- Turn detection and interruptions: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions
- Voice configuration: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices
- Session history, recordings and transcripts: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-history
- Billing: https://www.assemblyai.com/docs/billing-and-pricing
- Voice Agent product/pricing: https://www.assemblyai.com/products/voice-agent-api
- AssemblyAI model page: https://www.assemblyai.com/docs/speech-to-text/universal-streaming

### Required pattern

1. The browser asks for mic permission only after an explicit user click.
2. Browser calls a protected Vercel route to obtain a short-lived single-use AssemblyAI token.
3. That server route calls `GET https://agents.assemblyai.com/v1/token` using `ASSEMBLYAI_API_KEY` in server-only environment variables. Use documented short token expiry (e.g. 60–300 seconds) and a sensible maximum session duration.
4. The browser connects to `wss://agents.assemblyai.com/v1/ws` with the temporary token and stored `ASSEMBLYAI_AGENT_ID` via documented `session.update` protocol. Use only the official current event names and message formats.
5. End every session with the documented `session.end` event. Do not assume closing the browser WebSocket fully ends billing. Reconnect within the documented window only when needed and follow the documented session resume protocol.
6. Handle all events with typed state: connecting, ready/listening, input speech, agent thinking/response, agent speaking, interrupted, error, reconnecting, disconnected and ended. Keep state machine authoritative and accessible.
7. Barge-in must stop playing queued outgoing audio immediately when the user starts speaking, using the documented event order. Never concatenate old and new audio after interruption.
8. Avoid raw audio storage. Do not request session recordings/transcripts unless a documented requirement exists and users explicitly consent.
9. On mobile Safari or unsupported browsers, handle sample rates/worklet/audio permissions per current AssemblyAI docs. Provide text input and graceful unsupported-browser UI.
10. Cap connection duration, make cost-aware session state visible and ensure stop/unmount/logout/navigation terminates a session.

### Connect AssemblyAI to Groq

AssemblyAI supports a custom, publicly accessible HTTPS OpenAI-compatible chat-completions endpoint configured through an `llm` entry (`base_url`, `model`, `api_key`). Groq exposes an OpenAI-compatible endpoint at `https://api.groq.com/openai/v1`. Groq officially documents tool-use support for its hosted models. This makes a custom Groq model the preferred integration for this project, subject to an actual compatibility test against AssemblyAI's streaming and tool-call protocol.

References:
- AssemblyAI custom LLM: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/connect-your-own-llm
- Groq model catalogue: https://console.groq.com/docs/models
- Groq tool-use support: https://console.groq.com/docs/tool-use/overview
- Groq API reference: https://console.groq.com/docs/api-reference

Implementation instructions:
- Query Groq's current model list at `https://api.groq.com/openai/v1/models` or use current official docs; choose an actually available model that supports streaming chat completions and tool calls. Do not assume a model alias remains active indefinitely.
- Candidate fast default to test: `openai/gpt-oss-20b`; evaluate `openai/gpt-oss-120b` only if its latency and billing are acceptable. Read the current model list and limits at build time. Keep the model configurable as `GROQ_MODEL`.
- Use the AssemblyAI agent's documented custom LLM config, conceptually: `base_url: https://api.groq.com/openai/v1`, `model: <validated Groq model ID>`, `api_key: <GROQ_API_KEY>`. Use official current API payloads; don't blindly copy this conceptual example if the versioned API contract differs.
- Create/update the Voice Agent with a local/admin server-side setup script. Never put the Groq or AssemblyAI key in frontend JavaScript. AssemblyAI's docs state its stored LLM `api_key` is encrypted and not returned on read; verify the current write contract.
- Keep to one configured custom LLM where AssemblyAI's docs specify only one is supported. Do not implement imaginary multi-provider fallback support inside AssemblyAI if it is not documented. If fallback is needed, use a separately designed and tested application-side path, with a truthful user-visible error/fallback state.
- Run a real smoke test: simple spoken greeting; streamed response; at least one tool-call event; user barge-in; timer prompt; voice stop; error/reconnect; verify costs/latency in dashboard. If Groq custom model cannot satisfy AssemblyAI's expected protocol, investigate the documented cause, test another currently listed tool-capable model, and only then choose the most reliable documented alternative. Do not claim success from compilation alone.
- Keep model prompts short for low turn latency. Stream responses. Bound output tokens and tool retries. Never let the live voice LLM run long reports or large research jobs in the critical conversation loop.

### Tool calls: security-boundary design

Separate **agent suggestions** from **authorised app mutations**. The model is untrusted input.

Safe actions can include selecting from the fixed strategy library, producing a proposed tiny next step, or returning fixed non-sensitive instructional content. Any action that writes user data must go through an authenticated application path with server-verified identity and validation. Never trust `user_id`, account IDs, profile IDs, arbitrary URLs, SQL, table names, or permissions sent by the model.

If AssemblyAI HTTP tools are used, examine the current tool schema and security options. Do not expose an unrestricted admin endpoint to an agent tool. Restrict tool endpoints to the smallest surface, validate the incoming request, bind the action to an authenticated/signed short-lived session capability where the current API supports it, use anti-replay and idempotency for writes, rate-limit, and log only metadata. Prefer browser-side, authenticated Supabase writes for session results after the user has confirmed the outcome. The LLM must not be able to delete data, export a report, share information, or change a treatment record without an explicit user action.

### Voice choice

Choose a warm, calm, clear AssemblyAI-supported voice after listening to the official current voice demos. Do not imply that this voice is ElevenLabs. AssemblyAI powers the live interactive voice. ElevenLabs is a separate, optional API for the pre-recorded launch-demo narration.

---

## 6. GROQ MODEL / API ENVIRONMENT

The application runtime should use Groq through AssemblyAI's custom LLM interface for the realtime voice agent. Use Groq directly only for discrete server-side non-voice tasks when there is a good reason and current limits allow it; avoid duplicate inference of the same coaching plan.

- Base URL: `https://api.groq.com/openai/v1`
- Chat completions endpoint (if directly used server-side): `https://api.groq.com/openai/v1/chat/completions`
- Models are dynamic. Validate `GROQ_MODEL` against current available supported model IDs instead of hardcoding a model that may later be deprecated.
- Require streaming for the voice-agent custom LLM. Test tool-call delta formats and finish reasons with AssemblyAI.
- Apply request timeout, safe retry only for idempotent actions, capped output, structured schema validation, and rate limits.
- Do not put secret-bearing provider requests in the client. Add a short, redacted provider health check.

Use the API gateway currently available to the user, not OpenAI's URL with a Groq key, and never assume unlimited rate limits. Check actual dashboard quotas and provider pricing before recording usage estimates.

### Voice budget and usage protection

AssemblyAI currently documents $50 in introductory credits for new accounts and a published Voice Agent API rate of $4.50 per active session hour. Treat the credit as a finite testing budget, not a free unlimited service. Build a usage-sparing acceptance workflow: test one short scripted session, validate interrupt/tool events, stop the session cleanly, inspect the dashboard, and only then record the launch film. A 5-minute active session is about $0.375 at the published base hourly rate, before any applicable external Groq usage charges. Verify the account dashboard and current pricing directly before relying on the estimate. Do not keep idle sockets open. Add maximum session duration, visible session-end controls, defensive cleanup on navigation/unmount and a manual spend check before repeated testing.

---

## 7. SUPABASE AUTH, DATA MODEL, AND SECURITY

Use the existing Supabase project if configured. If the repository has no backend, choose a Vercel-compatible, maintainable app stack with Supabase Auth and Postgres. Create versioned migrations and a repeatable setup guide. Never mutate a remote database destructively without checking the target project and migration status.

Suggested tables (adapt to the current schema rather than blindly duplicating tables):

### `profiles`
- `id uuid primary key references auth.users(id) on delete cascade`
- `support_mode text` constrained to `waitlisted`, `receiving_medication`, `in_therapy`, `self_managing`, `prefer_not_to_say`
- `voice_enabled boolean default false`
- `spoken_checkins_enabled boolean default false`
- `quiet_mode boolean default false`
- `created_at`, `updated_at` with timezone-aware timestamps

### `coach_sessions`
- `id uuid primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `task_summary text` limited in length
- `barrier text` constrained to allowed values
- `strategy_id text` constrained to versioned fixed strategies
- `strategy_version text`
- `first_step text` limited in length
- `duration_minutes int` check in `(5,10,15)` unless valid custom duration deliberately supported
- `started_at timestamptz`, `ended_at timestamptz`, `outcome_recorded_at timestamptz`
- `outcome text` constrained to valid values
- `focus_rating int null` constrained to 1–5
- optional short user-approved note; no default transcript archive
- `created_at timestamptz`

### `treatment_checkins`
- `id uuid primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `recorded_at timestamptz not null`
- `taken_status text` constrained to approved self-report values
- `side_effect_report text null`, maximum length and opt-in
- `focus_rating int null` constrained 1–5
- no default medicine name or dose columns

### Optional `questionnaire_assessments`
Only create if instrument and rights/usage conditions are verified. Store instrument ID/version, date and user-provided result/scores as appropriate, with no automatic diagnosis field.

### `audit_events`
Minimum metadata only: user ID, action code, success/error code, time. Never log full transcripts, side-effect notes, auth tokens, API keys or report contents.

### Required Row Level Security checks
- Enable RLS on every exposed user-owned table.
- Each select/insert/update/delete policy must check authenticated user ownership (`auth.uid()` against `user_id` or `id`, as appropriate).
- For `profiles`, ensure only the authenticated owner reads or writes permitted preference fields; do not permit editing role/admin fields from the client.
- Explicitly revoke unnecessary grants. Use the anon/public key only with RLS. Never expose `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_*`, HTML, client components or source maps.
- Write tests or SQL verification queries covering account A vs account B, update tampering, delete scoping, unauthenticated access and privileged access.
- Implement protected account deletion using the documented server-side Auth Admin API only after reauthentication or confirmation. Delete owned app rows, then the Auth account, handle partial failure idempotently, and state any system-level backup retention accurately.
- Build a local synthetic-data seed for demos that never uses actual personal health data.

### Privacy by default
- Store minimum necessary structured records.
- Do not record/retain audio by default.
- Keep speech transcripts transient or ask before saving a short summary.
- Before model inference, send only the minimum task context needed; avoid sending names, email or other identifying data.
- Provide a visible explanation of what leaves the browser and what is persisted.
- Users can review/edit task summaries and treatment notes before saving.
- Build data export and deletion controls with truthful feedback.
- Add production privacy-policy text that matches actual behaviour and third-party subprocessors. Clearly mark portions needing legal review.
- This is health-related information and may constitute special-category personal data under UK GDPR. Before onboarding real users, document the Article 6 lawful basis, Article 9 condition, minimisation, retention, processors, data subject rights, security and whether a DPIA is required. Do not claim compliance based merely on adding RLS.

---

## 8. CRISIS AND MEDICAL-SAFETY BEHAVIOUR

Build a fixed, user-accessible “Need urgent help?” route. It must not depend on the LLM's interpretation of speech and must not be described as a reliable self-harm detector or emergency monitoring.

For a UK/England deployment show appropriate current resources, with their exact destination/number checked at build time:
- Immediate danger: 999 or A&E.
- Urgent mental health support in England: NHS 111 with the mental health option, or NHS 111 online where suitable.
- Someone to talk to: Samaritans, 116 123.

Review live official NHS/Samaritans pages before final publication; store resource labels/URLs/phone numbers centrally, not generated ad hoc by the LLM. A keyword or risk signal may open the fixed screen, but it can miss/false-trigger; provide a manual route always. Do not create medical diagnoses, treatment changes, dose advice or promises of intervention.

System instructions for Stay's voice coach:
- Be calm, respectful, concise and non-judgmental.
- Do not diagnose or make clinical claims.
- Never advise medication dosing or changes.
- Never frame missed starts or treatment check-ins as moral failure.
- If asked for medical advice, explain the boundary briefly and direct the user to their prescriber/pharmacist/clinician as relevant.
- If immediate danger is expressed, calmly direct the user to fixed emergency resources. Do not rely on the LLM alone.
- Do not hide the limitations of the product.

---

## 9. INTERACTIVE PRODUCT DEMO AND PUBLIC LANDING PAGE

The live site must show the product, not just describe it.

### Public hero
- Wordmark “stay” and concise proposition.
- One memorable 3D signal object, restrained art direction, high readability and no autoplay audio.
- Primary CTA “Try a short session”; secondary “Explore the demo”.
- A clear short note: “Support for getting started. Not a diagnosis or a substitute for care.”
- Do not make broad medical claims or use fabricated clinical efficacy figures.

### The interactive demo
Create two paths:

**A. Safe sample mode, no login needed:** a scripted, clearly labelled synthetic example showing the flow: user avoids a task → chooses “overwhelmed” → Stay reduces it to one action → short timer begins → sample outcome is recorded → transparent strategy-pattern panel appears → sample clinician report preview. The visitor can click through and alter choices. It must use actual product components, not a video pretending to be interactive. Label every sample datum “Example data”. It must not send health data anywhere.

**B. Live voice mode:** clearly labelled as live AI, asks for microphone permission on click, obtains a short-lived token through the server, connects to AssemblyAI, shows a visible listening/speaking state and a text fallback, and lets the user end the session. Use no real account health record for anonymous demo sessions. Explain external processing before the user starts.

### Interactivity that genuinely differentiates
- The 3D signal object responds to real UI state (not random perpetual animation).
- The user can change an obstacle and see the recommended first step adapt.
- The timer works and can be paused/stopped.
- The strategy pattern illustrates sample denominators and counts honestly.
- The report preview reflects the selected sample data and exports a real sample PDF, clearly labelled synthetic.
- Live demo errors are gracefully handled if keys, network, provider or microphone permissions are missing.

### Trust and proof
- Explain exactly how the loop works.
- Show the methodology for functional measurements.
- State which outcomes are user-reported.
- Show the boundary between product support and clinical care.
- Do not invent testimonials, adoption numbers, trial outcomes, partners, awards or endorsements.
- If using an external interactive demo platform, it complements and never replaces the real application.

### Copy and conversion
Use specific, empathetic copy. Do not use “unlock your potential”, “revolutionary”, “supercharge”, “AI-powered solution”, “cure”, “clinically proven” or fake urgency. Avoid overwhelming visitors with a wall of features. Use the narrative: problem → see it work → how it works → safety/privacy → invitation.

---

## 10. FRONTEND ENGINEERING, 3D, AND ACCESSIBILITY

Keep the existing stack if it is sound. If creating from scratch, prefer a Vercel-compatible TypeScript React stack with server routes, Supabase and Tailwind CSS. Use the current stable documented framework versions; do not blindly downgrade dependencies to match old tutorials.

### Component structure
Build reusable pieces with typed props, clear boundaries and tests:
- `StayMark` / wordmark
- `SignalScene` (lazy-loaded 3D) and accessible fallback
- `VoiceStatePanel`
- `VoiceControls` (start/stop, mute where supported, retry, text fallback)
- `TaskCapture`
- `BarrierPicker`
- `StrategyProposal`
- `FocusTimer`
- `SessionOutcomeDialog` / in-flow outcome controls
- `StrategyPatternSummary`
- `TreatmentCheckinForm`
- `ReportPreview` / `ReportExportButton`
- `CrisisHelpPanel`
- `EmptyState`, `SkeletonState`, `InlineError`, `PermissionHelp`

Avoid a huge single component. Avoid premature abstraction and generic component factories. Use clear boundaries between browser audio, agent state, persistence, reports and UI.

### Design tokens
Store a concise DESIGN.md / design tokens file and map to Tailwind/CSS variables. Centralize fonts, colors, borders, surfaces, radius, spacing, shadows, focus styles and motion. Use semantic tokens, not one-off styling in every screen.

### Accessibility target
Target WCAG 2.2 AA where practical. Test:
- keyboard navigation end-to-end
- semantic landmarks/headings
- visible focus and focus retention across modals/dialogs
- labels and field errors
- contrast and non-colour indicators
- screen reader output for timer and agent state
- touch targets on mobile
- reduced motion and static 3D fallback
- browser zoom at 200%
- disabled, loading and error states
- microphone permission flow and text-only operation
- no audio autoplay

Do not announce every timer second to screen readers; use a reasonable periodic announcement. Provide a clear way to pause/stop speaking. Make agent state understandable visually and through accessible text.

### Responsive QA sizes
Test at minimum 320, 375, 390, 430, 768, 1024, 1280, 1440 and 1920 CSS pixels. Test portrait and landscape on a phone. No horizontal scrolling, overlapping controls, cut-off dialogs, microscopic text or oversized empty areas.

### Performance
- Lazy-load the 3D scene and optional animation/video code.
- Optimise images (AVIF/WebP or suitable format), avoid needless icon packs and huge dependencies.
- Avoid layout shifts; reserve asset dimensions.
- Measure page load and interaction on normal hardware. Do not sacrifice keyboard/mobile experience for a WebGL effect.
- Render a no-WebGL and reduced-motion version; test it deliberately.

---

## 11. VIDEO, NARRATION, AND DEMO PACKAGE

The goal is a short, high-craft, convincing hackathon demo that reveals the actual product. Use **ElevenLabs for the pre-recorded narration** (not for the live AssemblyAI conversation) if the user-provided ElevenLabs account/key is actually available. Do not create or clone a real person's voice without permission. If the user has not selected a voice, choose a permitted stock voice via their account and use a warm, grounded, natural delivery. Avoid salesy overacting.

ElevenLabs docs:
- Text to speech: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- Voices: https://elevenlabs.io/docs/api-reference/voices

Use HyperFrames to turn actual product capture, actual UI elements, timed typography and a narrated story into an editable rendered MP4. HyperFrames supports seekable HTML/CSS/JS animation with deterministic rendering and FFmpeg; confirm prerequisites (Node/FFmpeg) before relying on it.

HyperFrames refs:
- https://github.com/heygen-com/hyperframes
- https://hyperframes.heygen.com/introduction
- https://hyperframes.heygen.com/quickstart
- https://hyperframes.heygen.com/examples

### Produce at least

- `public/demo/stay-demo.mp4` or a clearly documented output directory that Vercel/Git hosting constraints permit; avoid committing a giant video into Git if it needlessly bloats the repo. Store large deliverables in an appropriate public release/storage destination if authenticated.
- `artifacts/stay-demo-1080p.mp4` (final 1920×1080, 30 fps or other verified chosen standard)
- `artifacts/stay-demo-captions.srt` and editable caption/transcript source
- `docs/DEMO_SCRIPT.md` with voiceover, timecodes, shots, source assets, and factual verification
- `artifacts/screenshots/` of desktop, mobile, live coach state, actual outcome, and report preview
- a 4–6 slide pitch deck or PDF if the schedule and available tools permit

### 55–70 second demo story (edit to fit real build)
1. **0–5s hook:** “The hardest part can be starting.” Minimal black/cream type, no stock corporate montage.
2. **5–12s problem:** a synthetic task list; one task remains untouched. Do not shame the user.
3. **12–23s voice interaction:** actual live session or accurately recorded test session; show mic permissions, current state and the user saying the task.
4. **23–33s intervention:** the task is narrowed to one concrete action; display the strategy and a short timer.
5. **33–43s live interaction:** pause/interrupt or timer check-in; show genuine application event and response. Do not fake the live state.
6. **43–52s closing the loop:** user records “started” or a truthful sample result; show actual persistent session history and a denominator-labelled strategy summary.
7. **52–61s clinician bridge:** produce and preview the actual PDF.
8. **61–68s brand close:** “One manageable step. A little more evidence about what helps.” Product URL and hackathon name only when appropriate.

Only show features that have been implemented and browser-verified. If recording a scripted voice path rather than a live model, identify it internally in the script and do not edit it to suggest a false unscripted live interaction. In the final demo, show the product interface and a genuine app-generated report. Add burned-in captions and clean audio levels.

### Video execution workflow
1. Verify `node`, package manager, FFmpeg, fonts and HyperFrames install/skills.
2. Create an isolated `video/` project folder so render dependencies do not pollute the app.
3. Create a short script with scenes/timecodes and the truthful exact narration.
4. Use ElevenLabs TTS only via server/local script with `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` set locally/server-side. Never expose either secret in the app.
5. Record browser screens using actual deployed or local working app. Use realistic synthetic demo data.
6. Render and inspect the MP4 visually and audibly, verify durations, captions, no clipped words, no unreadable text, no placeholder labels, no fabricated claims.
7. If automated rendering cannot complete, provide the full editable project and screenshots and report that MP4 rendering is blocked. Do not fabricate an output.

---

## 12. GTM AND HACKATHON DELIVERY

The hackathon submission form supplied by the founder is:
https://forms.gle/NtYDsi3bgqMDK29jj9

Additional relevant pages:
- AssemblyAI Voice Agent product: https://www.assemblyai.com/products/voice-agent-api
- AssemblyAI voice-agent showcase submission: https://www.assemblyai.com/contact/showcase
- Older September event listing for context only, not proof of current rules: https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon

The current Hackathon #2 details may be announced in a private Discord rather than a public event page. Do not state specific judging weights, deliverables or API quotas as confirmed unless they appear in the current announcement or official source. Ask the existing project context/Discord message only if genuinely necessary; otherwise prepare a submission pack using common requirements and mark unverified fields.

### Submission pack
Prepare the following values in a `docs/SUBMISSION_PACK.md` so the user can paste them into the form:
- Product name: Stay
- 1-line pitch and 100–150 word abstract
- What works today (verified list)
- Tech stack (accurate)
- Live Vercel URL (only after verifying deployment)
- Public GitHub repository URL (only after verified creation/access)
- 60–70 second demo video URL or attachment location (only if actual rendered video exists)
- Architecture and use of AssemblyAI Universal-3.6 Pro Realtime, voice agent orchestration, tool use and interruption handling
- What is novel: task-start → outcome → strategy pattern → clinician-summary loop
- Evidence and limitations; explicitly say product outcomes have not yet been clinically validated
- data privacy/safety notes
- acknowledgements/licences for tools/assets
- unanswered fields/rules to confirm from the latest private announcement

Do not submit forms, publish social posts or create external side effects without the user's explicit final approval. Build and verify the entire package so approval is the only remaining action.

### Repository quality
- Work in the existing repository. Check licence, branch, remotes and dirty files.
- Create a public GitHub repo only if one does not already exist and the current account has access. Do not overwrite or expose a private repository accidentally.
- Add clear README: what Stay does, live link, demo video, how it works, environment variables, local setup, schema/migrations, known limitations, security/privacy, accessibility, and acknowledgements.
- Use reproducible migrations, lint/test/build scripts, a small architecture diagram, issue/roadmap file, `.env.example` without secret values and proper `.gitignore`.
- Run a secrets scanner or inspect staged changes before pushing. Do not put credentials in Git history. If a secret has been committed, treat it as compromised and guide rotation; merely deleting it in a later commit is insufficient.

### Landing-page conversion path
Hero → click-through interactive demo → explanation of the end-to-end loop → what gets recorded/what does not → care boundaries and privacy → try voice / create account. Do not force sign-up for the sample walkthrough. Add good metadata, social preview image, favicons, sitemap/robots if appropriate, readable footer, functioning legal/help links, and a unique non-generic meta description. No cookie banner unless the actual tracking setup requires it; do not add tracking by default.

### Launch copy generation
Prepare, but do not publish automatically:
- 1 concise LinkedIn post and image/cover visual
- 1 concise X post
- 1 short demo description
- 1 README-first technical launch narrative
- 1 product Hunt/showcase blurb if relevant

Content must state what is actually built. No fake endorsements, clinical claims, guaranteed outcomes, “first ever,” fabricated benchmarks, or artificial virality promises.

---

## 13. DEPLOYMENT TO VERCEL

Deploy the actual product to Vercel, not just a local preview, if the required account authorisation and environment are available.

- Use the existing Vercel project/linked deployment when appropriate; first inspect `.vercel/project.json`, linked project information and current deployment configuration without exposing credentials.
- If no deployment is linked and authorization exists, initialize a Vercel project and use the currently documented CLI/workflow. Do not assume an exact team/project slug. If CLI is already authenticated, deploy a preview first, run smoke tests, then deploy production.
- Verify the production URL loads without authentication if the landing page is meant to be public. Verify `/demo`, signup/login, authenticated app route, voice token route, live voice connection, save-session path and PDF download.
- Set Vercel environment variables through authenticated settings/CLI, not source files. Required names likely include `ASSEMBLYAI_API_KEY`, `ASSEMBLYAI_AGENT_ID`, `GROQ_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the current project-specific names), server-side Supabase service credentials only where actually needed, and optional `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID` for the video generation script only.
- Do not place `ASSEMBLYAI_API_KEY`, `GROQ_API_KEY`, `ELEVENLABS_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in any public prefix such as `NEXT_PUBLIC_`.
- If AssemblyAI stores Groq's key in the agent config, do not also expose it in the browser. Keep the configuration script local and redact its responses.
- Add safe headers and a CSP consistent with required Supabase/AssemblyAI/WebSocket connections. Do not add a brittle CSP without checking browser console.
- Add sensible route timeouts, body-size constraints and rate limiting for token/report/config endpoints. The setup/admin agent configuration endpoint must be inaccessible from public production routes.
- Do not publish environment variable values in logs or the final report.
- After deploy, open the exact generated URL with a browser and test on it. A successful CLI exit alone is not end-to-end verification.
- If Vercel access is missing, produce a working `vercel`-ready project, build result, deployment guide and exact remaining action. Clearly say it is not deployed yet.

---

## 14. TESTING AND ACCEPTANCE CRITERIA

Create automated tests for deterministic business logic and E2E browser checks for the main user journey. Use Playwright if appropriate to the existing stack.

### Required acceptance tests

**A. Onboarding**
- New user completes it with voice and separately with text.
- Mic permission denied, unsupported browser, network failure and skipped sensitive question do not block product use.
- Preferences persist on reload.

**B. Coaching loop**
- User can capture a task, select/confirm a barrier, receive a validated strategy plan and edit the proposed first step.
- Model malformed response falls back to safe known strategy.
- Timer correctly starts, pauses, resumes, stops, finishes and recovers from tab sleep/refresh as designed.
- Voice interruption cancels queued speech promptly.
- User can choose every outcome state and return to History to see the exact saved record.
- Model is unable to change the timer outside allowed bounds or inject arbitrary actions.

**C. Groq and AssemblyAI integration**
- Real token route succeeds without exposing a provider key.
- Live browser session connects, hears a test prompt, speaks a concise answer and receives interruptions.
- Groq streaming/model tool call is verified in the actual Voice Agent path; otherwise the issue is documented and corrected or a reliable alternative path is selected.
- Unauthorized/expired token, quota exceeded, rate limit, WebSocket disconnect and model timeout have accessible recovery UI.
- `session.end` runs during stop, navigation, unmount and logout; usage is not left running accidentally.
- Current AssemblyAI session billing and Groq calls are checked during one deliberate smoke test.

**D. Persistence/security**
- User A cannot read/update/delete User B's records.
- Anonymous cannot read any private health log.
- Service-role/API keys are absent from compiled bundles and source maps.
- API calls validate session/auth context and inputs.
- Data deletion is scoped to the account and idempotent.
- Report includes only selected fields; export does not automatically share data.
- No raw voice or full transcript is retained accidentally.

**E. Report**
- Real PDF generated after a genuine test session; text is legible, data/date/time zone is correct, page count is one when feasible, selected fields match preview and no content overflows.
- Sample-mode report is visibly marked synthetic.
- Unknown/empty metric cases render honestly and do not show fake zeros as clinical facts.

**F. Design/accessibility**
- Responsive viewport matrix passes without horizontal overflow.
- Keyboard-only path completes main session.
- Visible focus, semantic labels, screen-reader status, 200% zoom, colour contrast, reduced-motion mode and no-WebGL mode tested.
- Every async state has appropriate loading, empty, partial success and error treatment.
- No CTA is inert. No broken links. No fake social proof.

**G. Production**
- Lint passes; typecheck passes; unit tests pass; integration/E2E checks pass or documented known failure; production build passes.
- Production Vercel site passes the smoke tests, and the public URL is captured in the README/submission pack.
- Demo recording plays with sound/captions and contains no secret keys, console errors, personal data or false claims.

### Metrics dashboard
Measure only what the app actually observes or user-reports:
- session start count
- outcome completion count
- self-reported task-start rate with denominator/time window
- time-to-user-reported-start when measured reliably
- attempts and reported starts per strategy
- check-in submission count (not assumed medication adherence)
- report generation count

Do not claim causal improvement, treatment effectiveness, or clinical significance. Use synthetic or aggregated non-identifying values for judges.

---

## 15. IMPLEMENTATION PLAN AND AUTONOMOUS PHASES

Execute phases without asking the user to approve each routine stage. Reorder tasks when the repository reveals a better sequence, but preserve the dependencies and acceptance bar.

### Phase 1 — Audit and lock decisions
- Inspect repo, git, routes, schema, deployment, secrets availability (names only), test/build scripts and current functioning features.
- Check official AssemblyAI/Groq documentation and actual model catalogue. Record date checked.
- Write `docs/BUILD_AUDIT.md`, `docs/PRODUCT_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DATA_PRIVACY.md`, `DESIGN.md`.
- Produce concise design moodboard/reference inventory from provided URLs; do not copy assets.

### Phase 2 — Design-system and app skeleton
- Define global tokens and responsive type scale.
- Build shared app navigation, reusable functional components, states, forms and the original Stay Signal 3D scene/fallback.
- Implement landing page and real demo route; use actual components, not placeholder screenshots.
- Run browser screenshot review and refine until the hierarchy is unmistakable and calm.

### Phase 3 — Supabase persistence and auth
- Inspect current Supabase setup, create migrations, RLS policies and ownership tests.
- Implement auth flow, profile/preferences, and user-owned session/treatment records.
- Ensure all private data is scoped by user and survives reload.

### Phase 4 — Voice setup and live integration
- Configure stored AssemblyAI agent via a local/server administrative script using safe environment variables.
- Use Universal-3.6 Pro Realtime through the documented AssemblyAI Voice Agent product. Connect Groq as the custom OpenAI-compatible model after current model verification.
- Implement token generation, WebSocket lifecycle, exact documented protocol, state machine, barge-in, error/reconnect handling, mic permissions and text fallback.
- Test live session before building more on top.

### Phase 5 — Coaching loop and outcomes
- Create bounded strategy library, validation schema and concise system prompt.
- Use fixed enum values, validate LLM JSON/tool calls and provide fallback behavior.
- Build timer, outcome capture, history, transparent statistics and sample demo workflow.

### Phase 6 — Treatment and report
- Build treatment check-in with no dosing feature.
- Build one-page user-controlled PDF and data-selection preview.
- Add help/crisis resources, export/delete paths and accurate privacy/legal surfaces.

### Phase 7 — QA, visual polish and performance
- Complete automated and manual acceptance checks.
- Run security/RLS tests, responsive tests, reduced-motion tests, audio tests and browser console check.
- Have a second reviewer/model examine product honesty, architecture, user privacy, voice state reliability and visual polish. Apply only verified useful fixes.

### Phase 8 — Deployment and repo
- Run lint/typecheck/tests/build.
- Set authorized Vercel environment values and deploy preview, smoke-test, then production.
- Create/use GitHub repo, remove accidental secrets, write README and confirm CI/build steps.
- Capture final live URL and deployment metadata (not credentials).

### Phase 9 — Demo production
- Install HyperFrames core skills as documented.
- Record real browser state and build a 55–70-second launch film using verified UI and ElevenLabs narration where credentials exist.
- Render MP4, inspect final file, generate captions/subtitle, screenshots and a demo script.
- Produce slide deck/PDF if possible without compromising the deployment/product.

### Phase 10 — Submission readiness
- Complete `docs/SUBMISSION_PACK.md`, README, architecture overview, privacy notes, known limitations, direct demo link and video artifact.
- Verify every URL.
- List unverified event rules separately. Do not claim submission complete unless a receipt exists. Final human approval is required before posting publicly or clicking submit.

---

## 16. RECOMMENDED REPO ARTIFACTS

Produce where relevant to the actual codebase:

- `README.md`
- `AGENTS.md` with concise persistent coding rules
- `DESIGN.md` or equivalent design token contract
- `docs/BUILD_AUDIT.md`
- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_PRIVACY.md`
- `docs/SAFETY.md`
- `docs/TEST_PLAN.md`
- `docs/DEMO_SCRIPT.md`
- `docs/SUBMISSION_PACK.md`
- `docs/DEPLOYMENT.md`
- `.env.example` containing names/placeholders only
- migration files and documented local seed of synthetic data
- tested voice-agent setup script (admin/local only)
- `public/` brand assets, OpenGraph image, custom favicon and static 3D fallback
- `video/` or `artifacts/` HyperFrames project with caption/narration assets, kept outside app bundle unless intentionally served
- automated unit/E2E tests

Do not add unnecessary paperwork if the corresponding implementation does not exist. Documentation must report reality, including outstanding gaps.

---

## 17. ENVIRONMENT VARIABLES AND SECRET HANDLING

Detect actual names used by the repository and standardize them only if safe. `.env.example` may contain placeholders but not real values.

Potential names:

```bash
# Supabase public client configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Server-only. Never prefix with NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=
ASSEMBLYAI_API_KEY=
ASSEMBLYAI_AGENT_ID=
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

# Optional: only needed for the offline/local launch-video narration script
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# Existing Vercel/GitHub auth should use supported CLI or connector auth, not secrets in files
```

If the project uses a different framework/env naming style, adapt it. The `ASSEMBLYAI_API_KEY` and `GROQ_API_KEY` values are server-only. The Groq secret may be stored encrypted in AssemblyAI's custom LLM configuration after setup, as documented, and may not be needed by public app routes. Keep it out of client bundles. The ElevenLabs secret belongs only in local/server-side video-generation scripts and must not be deployed unnecessarily.

Never request the user to paste secret values into a chat transcript. Use existing authenticated environment/secret manager. Do not print the environment with `env`, `printenv`, `set`, `vercel env pull` output, or equivalent. Verify secret existence by testing a boolean or name-only inventory.

---

## 18. FIRST RUN, NEXT ACTIONS, AND COMPLETION REPORT

Start now. Do not respond with only a plan.

1. Audit the repository and available integrations.
2. Inspect the official AssemblyAI Voice Agent/Universal-3.6 Pro docs and choose the documented integration path.
3. Validate current Groq tool-call model availability and live streaming compatibility.
4. Implement the smallest end-to-end slice first: synthetic/demo input, a real validated coaching plan, real timer, user-confirmed outcome, persistent session, real generated PDF.
5. Integrate the real AssemblyAI/Groq voice path without exposing secrets.
6. Refine visual system and original 3D signal.
7. Verify, deploy, produce the demo asset and complete the submission pack.

### Final response must report

- exact verified production URL, or explicit deployment blocker
- verified GitHub repository URL, or explicit permission/auth blocker
- actual demo-video path/URL, or explicit render blocker and available editable assets
- test/build/typecheck/lint results
- actual live AssemblyAI/Groq connection status
- which features are fully working, partial, simulated sample-mode only, or not done
- whether the PDF uses real test records or synthetic demo records
- data-protection/safety limitations needing review before real-patient use
- remaining event details that must be confirmed from the private hackathon channel
- next single highest-value action

Be exact. Distinguish implemented, verified, deployed and externally submitted. There is no credit for pretending.

---

## 19. OFFICIAL / PRIMARY REFERENCE LINKS

Use the live official documentation as the source of truth for API contracts and pricing. If a link redirects or is renamed, find the current official equivalent and record it.

### AssemblyAI
- Voice Agent API: https://www.assemblyai.com/docs/voice-agents/voice-agent-api
- Browser integration/temporary token: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration
- Custom LLM: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/connect-your-own-llm
- Turn detection and interruptions: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/turn-detection-and-interruptions
- Voices: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices
- Session history/recordings/transcripts: https://www.assemblyai.com/docs/voice-agents/voice-agent-api/session-history
- Pricing: https://www.assemblyai.com/docs/billing-and-pricing
- Product page: https://www.assemblyai.com/products/voice-agent-api
- Showcase submission: https://www.assemblyai.com/contact/showcase

### Groq
- Models/current IDs and model endpoint: https://console.groq.com/docs/models
- Tool use overview: https://console.groq.com/docs/tool-use/overview
- Chat completions API: https://console.groq.com/docs/api-reference
- Base endpoint: https://api.groq.com/openai/v1

### UX / visual references
- MotionSites: https://motionsites.ai/
- MotionSites 3D: https://motionsites.ai/3d-websites
- MotionSites Academy: https://motionsites.ai/academy
- Refero voice-app query: https://refero.design/?q=voice%20app
- Refero Styles voice query: https://styles.refero.design/?q=voice+app
- Refero Perplexity style: https://styles.refero.design/style/e9fff87a-63ce-4c19-840f-98233db62f58
- Refero Hims style: https://styles.refero.design/style/0a489bce-4f93-4b38-b612-d87b1d00999e
- Refero Clean SaaS guide: https://styles.refero.design/design-styles/clean-saas

### Agent skills / interactive demo / video
- Caveman: https://github.com/JuliusBrussee/caveman
- Ponytail: https://github.com/dietrichgebert/ponytail
- Design Engineering: https://github.com/AgentsORG/design-engineering
- Design Visual Frontend: https://github.com/Xialiang98/design-visual-frontend
- HyperFrames: https://github.com/heygen-com/hyperframes
- HyperFrames docs: https://hyperframes.heygen.com/introduction
- Supademo embeds: https://supademo.com/features/embed
- ElevenLabs TTS: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
- ElevenLabs voices: https://elevenlabs.io/docs/api-reference/voices

### Deploy / backend / hackathon
- Vercel deployments: https://vercel.com/docs/deployments
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth: https://supabase.com/docs/guides/auth
- Hackathon submission form supplied by founder: https://forms.gle/NtYDsi3bgqMDK29jj9
- Older separate September event (context only, not the current official event rules): https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon

---

## 20. FINAL STANDARD

Deliver a working product that is calm enough to be usable when someone is overwhelmed, rich enough to be memorable in a judging demo, honest enough to earn trust, and technically sound enough to survive outside the demo script.

The product has to demonstrate the promise in under 30 seconds and complete a true persisted loop in the live app. The 3D scene, launch film, model routing, Supabase data model, and marketing page must all serve that central experience. Do not sacrifice security, accessibility, stability or truthfulness for a decorative flourish.

**Begin repository inspection and execution now.**

---

# Appendix A — Master UI/UX Quality Directive Provided by the Founder

The following is appended verbatim from the founder-provided design directive. Treat it as part of the product's design acceptance criteria unless a specific point conflicts with a more concrete product-safety or engineering requirement above.

# MASTER UI/UX QUALITY DIRECTIVE
## Remove the "Vibecoded AI Website" Look

You are acting as a senior product designer, design-system engineer, frontend architect, UX researcher, accessibility specialist, conversion designer, and product engineer.

Your job is NOT to make the application look like another generic AI-generated SaaS landing page.

Your job is to inspect the entire repository, understand the actual product, understand its target users, understand its workflows, and redesign/refactor the experience so that it looks intentionally designed by a strong real-world product team.

Do not wait for me for routine decisions.

Inspect:
- existing pages
- routes
- components
- layouts
- CSS
- Tailwind configuration
- typography
- spacing
- responsiveness
- product workflows
- dashboards
- onboarding
- authentication
- loading states
- error states
- empty states
- forms
- modals
- navigation
- mobile UI
- landing pages
- pricing
- demos
- documentation
- legal pages
- accessibility
- animations
- iconography
- data visualizations
- real product functionality

Then improve the product systematically.

---

# THE 30 ANTI-VIBECODE RULES

Do not default to any of the following patterns.

## 1. Harsh gradients

Do not cover the website in obvious blue-purple, pink-purple, cyan-purple, rainbow, or AI-looking gradients.

Prefer:
- restrained surfaces
- material-inspired colors
- subtle tonal variation
- photography
- product imagery
- texture
- typography
- whitespace
- composition

A gradient may only exist if there is a deliberate brand reason for it.

---

## 2. Lucide icons everywhere

Do not make the entire application look like a Lucide icon showcase.

Avoid repeating the same generic icons used by thousands of generated SaaS templates.

Use:
- custom SVGs
- product-specific symbols
- brand iconography
- native OS metaphors where appropriate
- text labels when an icon adds no value

Icons must communicate meaning, not decorate empty space.

---

## 3. Pure white background everywhere

Avoid an endless #FFFFFF canvas.

Build surface hierarchy.

For example:
- base background
- elevated surface
- recessed surface
- content surface
- modal surface
- navigation surface

Use subtle tonal differences rather than shadows everywhere.

---

## 4. Rainbow coloring

Do not assign random colors to every icon, feature, category, or heading.

Create an intentional color system.

Define:
- primary
- neutral
- success
- warning
- danger
- information
- optional product/domain-specific accent colors

Color should communicate hierarchy or state.

---

## 5. Drop shadows everywhere

Do not use large floating Tailwind-style shadows on every card.

Prefer:
- borders
- tonal separation
- spacing
- elevation only where physically/logically justified

Use shadows sparingly.

---

## 6. Three feature cards in a row

Do not automatically create:

[feature] [feature] [feature]

for every section.

Use layouts that reflect the information.

Consider:
- editorial layouts
- product walkthroughs
- asymmetric composition
- real screenshots
- workflows
- timelines
- comparison views
- interactive demonstrations
- full-width product sections

---

## 7. Emojis as product design

Avoid emojis as substitutes for real product iconography.

Do not make sections like:

🚀 Fast
🔒 Secure
✨ Powerful

unless the brand intentionally uses emoji as part of its identity.

---

## 8. Liquid glass

Do not automatically use glassmorphism, translucent cards, backdrop blur, floating glass navigation, or Apple's glass aesthetic.

Transparency should only exist when the product hierarchy benefits from it.

---

## 9. Em dashes everywhere

Avoid AI-like copywriting habits.

Especially avoid excessive em dashes in:
- headings
- marketing copy
- descriptions
- CTAs
- documentation

Write naturally.

Vary sentence structure.

---

## 10. Inter / Geist / Space Grotesk by default

Do not automatically choose the standard "AI startup" fonts.

Research typography appropriate for this product.

Build a proper hierarchy:
- display
- heading
- body
- UI
- monospace where technically justified

Prioritize readability and brand identity.

Do not change fonts merely for novelty.

---

## 11. Colored left stripes

Do not decorate cards, alerts, quotes, feature boxes, or panels with arbitrary colored vertical left borders.

Use established semantic components instead.

---

## 12. Fake testimonials

Never invent:
- users
- companies
- quotes
- avatars
- revenue numbers
- customer counts
- ratings
- logos
- endorsements

If real testimonials do not exist, show:
- product evidence
- benchmarks
- examples
- demos
- case-study placeholders clearly labelled as examples

Authenticity is mandatory.

---

## 13. Bento grids

Do not automatically build a bento grid because it looks fashionable.

If a grid is used, information architecture must justify it.

The design should work without visual gimmicks.

---

## 14. Fake terminal windows

Do not add a terminal/code block purely to make the product look technical.

A terminal should appear only when:
- the product actually has a CLI
- commands are genuinely useful
- developers need the example

Use real commands and real outputs.

---

## 15. "It's not X, it's Y"

Avoid clichéd AI marketing copy such as:

"It's not a tool. It's your AI cofounder."

"It's not automation. It's intelligence."

"This isn't X. It's Y."

Describe the product concretely.

Show what it does instead of manufacturing profundity.

---

## 16. Checkmark bullet spam

Do not make every list:

✓ Fast  
✓ Secure  
✓ Powerful  
✓ Easy  

Use:
- proper typography
- numbered processes
- normal lists
- comparison structures
- diagrams
- visual demonstrations

depending on the information.

---

## 17. Three pricing tiers by default

Do not automatically create:

Free | Pro | Enterprise

Pricing architecture should reflect the real business model.

Possible models include:
- free
- usage based
- one paid plan
- individual/team
- credits
- enterprise
- open source + hosted
- custom pricing

Only show real plans.

---

## 18. No real product demos

This is critical.

Do not build a landing page that merely CLAIMS the product works.

SHOW THE PRODUCT.

Add appropriate:
- real screenshots
- interactive playground
- sample workflow
- before/after
- working demo
- video/demo placeholder if recording is required
- sample project
- real output
- realistic data

The visitor should understand the product within seconds.

---

## 19. Soft rounded corners everywhere

Do not use huge `rounded-2xl`, `rounded-3xl`, or pill shapes on everything.

Create a deliberate radius scale.

Example:

xs
sm
md
lg
pill

Use each according to component semantics.

Some components may legitimately have square or near-square corners.

---

## 20. Purple + black AI aesthetic

Do not automatically make the product:

black background
+
purple gradients
+
glowing text
+
purple CTA

Choose colors based on the product's identity and audience.

---

## 21. Missing skeleton loaders

Every asynchronous area should have a designed loading state.

Where appropriate implement:
- skeletons
- progressive loading
- optimistic UI
- loading indicators
- disabled submitting states

Avoid blank screens and arbitrary spinners.

Also prevent layout shift.

---

## 22. Radial orbs

Do not scatter blurred gradient circles/orbs in the background.

No random:
- purple orb
- blue orb
- pink orb
- blurred blob

Use composition instead of decoration.

---

## 23. Dot grids

Do not automatically put dotted/grid backgrounds behind hero sections.

Technical-looking decoration must serve an actual purpose.

---

## 24. Sparkle icons

Avoid generic ✨ / sparkle icons used to indicate "AI".

AI capabilities should be communicated through function and interaction.

Create meaningful product-specific visual language.

---

## 25. Animated arrows

Do not use decorative bouncing or looping arrows telling users where to look.

Visual hierarchy should naturally guide attention.

Motion should:
- explain state
- maintain spatial context
- acknowledge interaction
- demonstrate functionality

not distract.

---

## 26. No Terms of Service

If this is a deployable public product, include an appropriate Terms page structure.

Do not fabricate legal guarantees.

If actual legal review is required, clearly mark areas requiring professional review.

Navigation/footer should expose legal documentation when appropriate.

---

## 27. No Privacy Policy

Any product dealing with:
- accounts
- personal information
- analytics
- uploads
- cookies
- payments
- AI inference
- user-generated content

needs privacy documentation.

Reflect what the product ACTUALLY collects.

Never claim:
"we don't store data"
unless the implementation genuinely proves this.

---

## 28. Hover animation spam

Do not make every card:
- translate upward
- scale
- glow
- rotate
- change gradient
- animate its border

on hover.

Use hover primarily to communicate interactivity.

Buttons, links, menus, controls, selectable items, and actionable cards should have clear states.

Decorative motion should be restrained.

Support `prefers-reduced-motion`.

---

## 29. Neon colors

Avoid glowing cyberpunk colors unless they are genuinely central to the product identity.

Prioritize readability and contrast.

---

## 30. Generic pastel palettes

Avoid automatically choosing washed-out:
- lavender
- baby blue
- peach
- mint
- pink

because they look "modern."

Develop a palette based on:
- audience
- domain
- product personality
- accessibility
- brand positioning

---

# THIS DOES NOT MEAN "REMOVE EVERYTHING"

Do not mechanically delete a component merely because it appears in this list.

The real principle is:

INTENTIONALITY > TEMPLATE PATTERNS.

If one of these patterns genuinely improves usability or belongs to the product's brand language, it may remain.

But justify it through product requirements, not because it is the easiest generated design pattern.

---

# PRODUCT-FIRST DESIGN

Before redesigning anything, determine:

1. Who is the primary user?
2. What problem are they solving?
3. What is the main action?
4. What information must be visible immediately?
5. What requires progressive disclosure?
6. What builds trust?
7. What can be demonstrated rather than described?
8. What does the user need to accomplish within their first 30 seconds?
9. What differentiates this product?
10. What should NOT exist?

Design around these answers.

---

# CREATE A REAL DESIGN SYSTEM

Build or clean up design tokens for:

## Typography
- display
- h1
- h2
- h3
- body
- body-small
- label
- caption
- code

## Spacing
Use a consistent spacing scale.

## Radius
Create a restrained radius system.

## Borders
Define:
- default
- subtle
- strong
- focus
- error

## Surfaces
Create:
- canvas
- surface-1
- surface-2
- elevated
- overlay

## Semantic colors
Create:
- text-primary
- text-secondary
- text-muted
- success
- warning
- danger
- info

## Interaction states
Every interactive element needs:
- default
- hover
- active
- focus
- disabled
- loading

---

# SHOW REAL PRODUCT EVIDENCE

Replace marketing claims with evidence wherever possible.

Instead of:

"Lightning fast"

show:
"Median generation time: 1.8s"

if this is actually measured.

Instead of:

"Enterprise-grade security"

show actual implemented controls.

Instead of:

"Powerful AI"

show the output.

Instead of:

"Automates your workflow"

show the workflow.

Never fabricate metrics.

---

# LANDING PAGE PRINCIPLE

The landing page should explain:

WHAT IS THIS?

WHO IS IT FOR?

WHAT DOES IT ACTUALLY DO?

WHY IS IT DIFFERENT?

CAN I SEE IT WORK?

HOW DO I START?

The visitor should not need to decode abstract marketing language.

---

# PRODUCT DEMONSTRATION

Create the strongest possible real product demonstration using existing application functionality.

Possible structure:

INPUT
↓
PROCESS
↓
REAL PRODUCT WORKFLOW
↓
OUTPUT
↓
RESULT

Use actual application components wherever practical rather than fake screenshots.

---

# COPYWRITING

Remove generic AI startup language such as:

"Supercharge your workflow"

"Unlock the power of AI"

"Revolutionize your productivity"

"Seamlessly transform"

"Next-generation"

"AI-powered solution"

"Your intelligent copilot"

"Built for the future"

unless concrete context genuinely requires the phrase.

Prefer specific sentences.

Bad:

> Transform how you work with intelligent automation.

Better:

> Upload a contract, identify conflicting clauses, and generate a referenced review without sending the document to a third-party model.

Specificity wins.

---

# CONTENT AUTHENTICITY

Do not fabricate content to make the UI look complete.

That includes:
- users
- reviews
- statistics
- companies
- logos
- awards
- quotes
- benchmarks
- legal compliance
- certifications
- security claims
- uptime
- customer counts

Use real repository/project information.

If unavailable, use explicitly labelled demo/sample content.

---

# ACCESSIBILITY

Target WCAG 2.2 AA where practical.

Check:
- keyboard navigation
- focus states
- semantic HTML
- contrast
- labels
- ARIA usage
- screen readers
- touch targets
- reduced motion
- error messaging
- form accessibility
- heading hierarchy

Never remove visible focus indication.

---

# RESPONSIVE QUALITY

Validate at least:

320px
375px
390px
430px
768px
1024px
1280px
1440px
1920px

No:
- horizontal overflow
- broken grids
- microscopic text
- giant empty areas
- overlapping controls
- clipped modals
- unusable mobile navigation

Mobile should feel intentionally designed, not merely compressed desktop UI.

---

# PERFORMANCE

Avoid redesign choices that damage performance.

Audit:
- oversized dependencies
- unnecessary animation libraries
- unused icon libraries
- huge images
- unnecessary client components
- hydration cost
- duplicate dependencies
- expensive effects
- layout shifts

Use lazy loading and code splitting where appropriate.

---

# LOADING / EMPTY / ERROR STATES

Every important product workflow needs:

LOADING
EMPTY
SUCCESS
PARTIAL
ERROR
OFFLINE / FAILURE

states where relevant.

Do not leave users staring at blank containers.

---

# FORMS

Forms should have:

- proper labels
- helpful validation
- inline errors
- submitting state
- success feedback
- correct autofill attributes
- accessible focus behavior

Do not use placeholders as the only label.

---

# REALITY CHECK

At the end, ask:

Could someone look at this product for five seconds and immediately say:

"This was generated from a generic AI SaaS template"?

If yes, redesign it again.

Could someone identify the actual product and its purpose without reading 1,000 words?

If no, simplify it.

Could a skeptical user see genuine evidence the product works?

If no, demonstrate more and claim less.

---

# ENGINEERING RULE

Do NOT destroy working functionality while redesigning.

Preserve:
- APIs
- authentication
- business logic
- data flows
- state management
- routes
- database integration
- integrations
- existing useful features

Refactor safely.

Run tests/build/lint after material changes.

Fix regressions before continuing.

---

# AUTONOMOUS WORKFLOW

Proceed through:

PHASE 1
Repository + product audit

PHASE 2
Identify generic/vibecoded patterns

PHASE 3
Define product-specific visual direction

PHASE 4
Create/refactor design system

PHASE 5
Redesign highest-impact screens

PHASE 6
Improve product demonstration

PHASE 7
Improve loading/error/empty states

PHASE 8
Responsive pass

PHASE 9
Accessibility pass

PHASE 10
Performance pass

PHASE 11
Copywriting/authenticity pass

PHASE 12
Legal/trust surface audit

PHASE 13
Build/test/lint

PHASE 14
Final visual consistency audit

Continue resolving obvious issues autonomously rather than stopping after each small modification.

---

# FINAL ACCEPTANCE STANDARD

The result should feel:

intentional
specific
credible
product-led
mature
fast
accessible
coherent
distinctive
restrained
production-ready

It should NOT feel like:

a Tailwind demo
a shadcn demo
a Framer template
a generic AI startup
a Lovable/Bolt-generated landing page
a Dribbble concept with no functioning product
a collection of trendy components

The UI should look as though the design emerged from the PRODUCT rather than the product being inserted into a template.

Do a final repo-wide review and remove remaining signs of unnecessary AI-template design while keeping genuinely useful functionality.

---

# END OF MASTER EXECUTION PROMPT
