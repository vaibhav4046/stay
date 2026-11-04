# Stay: design for scale, availability and fault tolerance

What is true today, with the evidence, and what is not. The nine principles below are the ones asked for in this work (scalability, performance, availability, reliability, fault tolerance, consistency, security, maintainability, observability and cost). If your nine differ, the evidence below still applies; swap the headings.

**What is not claimed.** "One billion users" and "99% availability" are not claimed. Each voice turn uses a speech-to-text session, a model call and a voice session from third parties, and their quotas and uptime set the ceiling, not this code. What follows is what this code does about that, measured.

## The numbers that matter
| Fact | Value | Where it comes from |
|---|---|---|
| Tokens per spoken turn | about 1,100 to 1,800 (prompt about 350 to 420, tool definition about 450, history, at most 110 out) | `tests/unit` prompt budgets; live usage |
| Groq free tier, per model, per key | 8,000 tokens a minute and 200,000 a day, about 100 to 180 turns a day | Groq's own 429 text: "Limit 200000, Used 199020" |
| AssemblyAI voice sessions | 5 new sessions a minute per account | provider limit; the reconnect storm hit it |
| One Node process, stand-in model | 200 concurrent paced users: 100% ok, p50 641 ms, p95 1.76 s. 500: 99.8% ok, p95 2.5 s. 800: 96% ok, errors start. About 250 requests a second | `docs/evidence/load/`, `scripts/load/chat-load.mjs` (generator on the same machine, so a floor) |
| Turns answered by the real model | 52% (18 min run), 79% (60 min run), 63% (40 min run) | `docs/evidence/loop/soak-run5/6/7`: the rest hit the daily cap and got the plain "too many requests" line |
| Arithmetic | a billion people at 10 turns a day is 10 billion turns, about 15 trillion model tokens, a day | needs provider contracts and money, not code |

## 1. Scalability
- **Stateless routes**: no server session, no server database. Everything a person has (memory, list, history) is on their device (`src/lib/coach/*`), so state grows with devices, not with servers.
- **Horizontal**: the routes run as serverless functions; one process measured at about 250 requests a second, more instances add more.
- **Not scalable by code alone**: model and voice quotas. Mitigations in place: key pool (`GROQ_API_KEYS`), every key on every model, a second provider (`STAY_FALLBACK_LLM_*`), bring-your-own key (people can pay for their own capacity).
- **Gap**: the per-address limiter is in memory per instance (bounded at 2,000 entries, `src/lib/llm/provider.ts`); at real scale it needs a shared store.

## 2. Performance and latency
- First sound after the person stops speaking: median 1.0 to 1.3 s, 95th about 2.7 s (real model, `soak-run6/7`; the project's own 900 ms target is not met). The model's first byte is about 100 to 275 ms of it; the rest is the speech-to-text end-of-turn decision and the voice's first audio.
- Levers already used: a reply prepared on a finished-looking partial transcript and released when the turn is confirmed (`fastSocket.ts`), the first sentence streamed to the voice, quick fixed confirmations for simple actions (no second model call), tools offered only when the words ask for them.
- **Gap**: tuning the end-of-turn settings further needs a human-speech test.

## 3. Availability
- Layers, in the order a turn falls through them (`src/lib/llm/stream.ts`): each key on the main model, then each key on each spare model (three Groq model buckets), a short wait if one refills within 3 s, then the optional second provider, then the plain failure line.
- Found by the 40-minute run and fixed: the spare models were only tried on the first key, so with two keys 37% of turns were refused while the second key's spare buckets were untouched (`streamFallback.test.ts`, "with two keys"). Not yet re-measured: it needs a day with quota or a second provider key.
- `GET /api/health` answers from the server alone (no provider call, no key shown) for an uptime monitor.
- **Honest status**: the plumbing never left a turn silent or stuck in the pipeline runs (137, 85 and 189 turns); the model's availability is bounded by quota. 99% needs a second provider key or a paid tier; the code is ready for it.

## 4. Reliability
- 1,430+ unit tests, 208 browser tests, claims lint, four CI checks on every merge, long synthetic-voice soaks (`scripts/voice-e2e/soak.mjs`) that found each defect listed in `docs/loop/LEDGER.md`.
- Actions that change something run only when the person's words ask for them (`actionGates.ts`), and a spoken confirmation is checked against what the tool really did (`toolSelfCheck.ts`).

## 5. Fault tolerance
- **Model**: key pool, three model buckets, retry on a model error, second provider, honest failure line (`streamFallback.test.ts`: 429, 400, two keys, second provider, private-address refusal).
- **Voice link**: if the voice connection drops, the words still show, the turn ends and the voice reconnects for the whole call, one reconnect at a time (`fastSocket.test.ts`, `modelOutage.spec.ts`). Before the fix: twelve silent turns, then 219 reconnects in 40 minutes.
- **Reply hygiene**: a model's think block, quotation marks, brackets and stock lines never reach the screen (`replyHygiene.ts`, `thinkFilter.ts`).
- **Gap**: no chaos testing against the real providers; no multi-region.

## 6. Consistency
- **Behaviour**: the parts that decide what Stay may do are deterministic and tested (gates, guards, hygiene, spoken-step wording). The model's wording is not deterministic, and 100% consistency of generated language is not achievable or claimed; the soaks measure it instead (median reply 14 to 16 words; flags per run in `PERFECT_GATE.md`).
- **Data**: single-device and local-first, so there is no cross-device sync and nothing to reconcile. Export (Obsidian zip, JSON) is the portability path.

## 7. Security
- No account, no server-side storage of what a person says; keys only in the environment (never in git; the tree is scanned); a person's own model endpoint is refused if it points at a private address (`provider.ts`); crisis wording is handled before any model; per-address limit on the shared key.
- **Gap**: the limiter above; no formal penetration test.

## 8. Maintainability
- Small modules with one job (`actionGates`, `replyHygiene`, `thinkFilter`, `spokenSteps`, `proactive`), tests beside every behaviour, a ledger of every defect with its cause and its test, a reviewer guide (`REVIEWERS.md`), and test tooling that spends no tokens (`stub-llm.mjs`, `soak --offline`, `STAY_TEST_LLM_BASE`).

## 9. Observability and cost
- `/api/health`; `Server-Timing` per model attempt; a failure log line with the status of each model tried (no secrets); the soak harness's event trace. Cost per turn is known (above), so a budget can be set.
- **Gap**: no metrics store, no alerts. Point an uptime monitor at `/api/health` and watch the failure log for `model_failed`.

## What it would take to go further (not done)
1. A paid model tier or a second provider key (`STAY_FALLBACK_LLM_BASE`, `_KEY`, `_MODEL`): the single change that moves availability most.
2. A shared rate limiter (Redis or Vercel KV) in place of the per-instance map.
3. A paid voice plan for more than 5 new sessions a minute.
4. Real-provider load tests under contract; an external uptime monitor and alerts.
