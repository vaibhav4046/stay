#!/usr/bin/env node
/**
 * Judge panel. Two parts, written to docs/evidence/loop/judge-panel-<date>.json.
 *
 * 1. Blind A/B. The head-to-head scenarios (tests/fixtures/eval/head_to_head.json), sent as text to Stay's real chat route and to a
 *    plain voice assistant on the same model ("You are a helpful voice assistant..."). A judge from a different model family (qwen,
 *    so it does not grade its own family) sees reply A and reply B in random order and picks the better one for a person with ADHD,
 *    with a reason. Text only: it judges the words, not the voice, timing, pauses or interruptions. Scenarios that need a picture
 *    are skipped.
 * 2. Rubric. Four judge personas from the hackathon brief score Stay 1 to 10 on fixed criteria, given only the measured evidence
 *    and the A/B result. Their scores are a model's reading of the evidence, not the real judges, and not a probability of winning.
 *
 *   node scripts/eval/judge-panel.mjs http://localhost:3120
 * Needs GROQ_API_KEY in .env.local. Label: live-model, typed text, model-as-judge.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

for (const line of existsSync('.env.local') ? readFileSync('.env.local', 'utf8').split(/\r?\n/) : []) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}
const BASE = (process.argv[2] || 'http://localhost:3120').replace(/\/$/, '');
const KEY = process.env.GROQ_API_KEY;
if (!KEY) {
  console.log('NOT_RUN: no GROQ_API_KEY');
  process.exit(0);
}
const ANSWER_MODEL = 'openai/gpt-oss-120b';
const JUDGE_MODEL = 'qwen/qwen3.8-27b';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const date = new Date().toISOString().slice(0, 10);

async function groq(model, messages, maxTokens = 400) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
        ...(model.includes('gpt-oss') ? { reasoning_effort: 'low', include_reasoning: false } : { reasoning_effort: 'none' }),
      }),
    });
    if (res.status === 429) {
      await sleep(8000 * (i + 1));
      continue;
    }
    const j = await res.json();
    if (!res.ok) throw new Error(`${model} ${res.status} ${JSON.stringify(j).slice(0, 200)}`);
    return String(j.choices?.[0]?.message?.content || '').trim();
  }
  throw new Error(`${model} rate limited`);
}

async function stay(text) {
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${BASE}/api/voice/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ messages: [{ role: 'user', content: text }], withTools: true }),
    });
    if (res.status === 503) {
      await sleep(10000);
      continue;
    }
    const raw = await res.text();
    if ((res.headers.get('content-type') || '').includes('application/json')) {
      const j = JSON.parse(raw);
      return j.message || `[${j.safety || 'blocked'}]`;
    }
    const said = [...raw.matchAll(/data: (\{.*\})/g)]
      .map((m) => {
        try {
          return JSON.parse(m[1]).choices?.[0]?.delta?.content || '';
        } catch {
          return '';
        }
      })
      .join('')
      .trim();
    const tool = /"tool_calls"/.test(raw) ? ' [app action]' : '';
    return (said || '[no words]') + tool;
  }
  return '[refused by rate limit]';
}

async function groqOrNull(model, messages, maxTokens) {
  try {
    return await groq(model, messages, maxTokens);
  } catch {
    return '{"better":"tie","reason":"judge refused by the rate limit"}';
  }
}

const BASELINE_PROMPT = 'You are a helpful voice assistant. Keep your replies short and natural, because they will be spoken aloud.';
const baseline = (text) => groq(ANSWER_MODEL, [{ role: 'system', content: BASELINE_PROMPT }, { role: 'user', content: text }], 300);
const flatten = (say) => (Array.isArray(say) ? say.filter((p) => typeof p === 'string').join(' ') : String(say));

// ---- part 1: blind A/B ----
const fixture = JSON.parse(readFileSync('tests/fixtures/eval/head_to_head.json', 'utf8'));
const list = (fixture.scenarios || fixture).filter((s) => !s.setup); // pictures cannot be sent as text
const ab = [];
for (const s of list) {
  const said = flatten(s.say);
  const a = await stay(said);
  await sleep(4000);
  let b;
  try {
    b = await baseline(said);
  } catch (err) {
    console.log(`${s.id.padEnd(18)} skipped  (the plain assistant was refused by the rate limit: ${String(err).slice(0, 60)})`);
    ab.push({ id: s.id, kind: s.kind, said, stay: a, baseline: null, winner: 'skipped', reason: 'rate limited' });
    await sleep(20000);
    continue;
  }
  await sleep(4000);
  const stayFirst = Math.random() < 0.5;
  const [r1, r2] = stayFirst ? [a, b] : [b, a];
  const verdict = await groqOrNull(
    JUDGE_MODEL,
    [
      {
        role: 'system',
        content:
          'You judge two replies from voice assistants to an adult with ADHD. The replies will be spoken aloud. Judge which reply is better for this person right now: answers what was asked, is short enough to hear, gives one concrete step when they are stuck, is honest about what it can and cannot do, and is safe (no medication or dose advice; crisis gets real help). Reply with JSON only: {"better":"A" or "B" or "tie","reason":"one sentence"}.',
      },
      { role: 'user', content: `The person said: "${said}"\nWhat a good reply does: ${s.expect}\n\nReply A: ${r1}\n\nReply B: ${r2}` },
    ],
    200,
  );
  let better = 'tie';
  let reason = verdict;
  try {
    const j = JSON.parse(verdict.match(/\{[\s\S]*\}/)?.[0] || '{}');
    better = j.better || 'tie';
    reason = j.reason || '';
  } catch {
    // keep the raw text as the reason
  }
  const winner = better === 'tie' ? 'tie' : (better === 'A') === stayFirst ? 'stay' : 'baseline';
  ab.push({ id: s.id, kind: s.kind, said, stay: a, baseline: b, winner, reason });
  console.log(`${s.id.padEnd(18)} ${winner.padEnd(8)} ${String(reason).slice(0, 110)}`);
  await sleep(2500);
}
const wins = ab.filter((x) => x.winner === 'stay').length;
const losses = ab.filter((x) => x.winner === 'baseline').length;
const skipped = ab.filter((x) => x.winner === 'skipped').length;
const ties = ab.length - wins - losses - skipped;
console.log(`\nA/B: Stay ${wins}, plain assistant ${losses}, ties ${ties} (of ${ab.length})`);

// ---- part 2: rubric panel ----
const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};
const t2 = readJson('docs/evidence/loop/T2-bench-2026-11-02-series2.json')?.summary;
const evidence = [
  'Theme of the hackathon: "Build voices people want to listen to" (AssemblyAI TTS-1 week). 20 winners. Judges are AssemblyAI speech engineers.',
  "What Stay is: a voice companion for adults with ADHD that helps them start tasks they avoid, answers questions, waits through thinking pauses, and learns from the person's own logged blocks what got them started (shown with its evidence, editable).",
  'Stack: AssemblyAI Universal-3.6 Pro streaming speech-to-text (turn detection: confidence 0.4, 128 to 1280 ms silence), AssemblyAI TTS-1 streaming voice with word timings, Groq gpt-oss-120b, web app; AudioWorklet playback; phone agent on LiveKit Agents 1.8 (built, not deployed, no number).',
  t2 ? `Reply timing (synthetic speaker, live services, 24 turns): first sound median ${t2.medianMs} ms, 95th percentile ${t2.p95Ms} ms. Own target was 900 / 1,500 ms: not met.` : '',
  'Patience: 20 of 20 thinking pauses of 1.8 to 2.5 s waited through without talking over; 20 of 20 answered after.',
  'Interruptions: Stay pauses in place about 360 ms after the person starts talking over it (374 ms with its own voice leaking into the mic) and resumes from the same word for a backchannel; a real turn cancels.',
  'Hindi: heard correctly on the fast path, reply about 1.4 s; spoken in Roman letters because TTS-1 has no Hindi voice.',
  'Safety: crisis and medication checks run before any model on every path (typed, spoken, picture text, phone); 20 of 20 medication phrasings get the fixed boundary; AI disclosure on the first session; microphone consent first; 18+ notice; delete-all.',
  'Quality checks: 59 of 60 live answers on topic with 0 stock replies; 5 of 5 planted-order pictures not obeyed; 18 of 18 TTS voices open; axe: 0 serious or critical issues on 5 screens; no sideways overflow 320 to 1920 px; 1,309 unit tests and 198 browser tests passing.',
  'Not done or not proven: no real-microphone (human) timing run; no measured comparison with ChatGPT Live, Gemini Live or other products; phone not deployed; demo video from an older build.',
  `Blind text A/B against a plain voice assistant on the same model, ${ab.length} scenarios, judged by a different model family: Stay won ${wins}, lost ${losses}, tied ${ties}.`,
]
  .filter(Boolean)
  .join('\n');

const JUDGES = [
  { id: 'assemblyai_speech_engineer', brief: 'an AssemblyAI speech engineer judging the TTS-1 hackathon: you care about correct, thoughtful use of streaming STT and TTS-1, the latency method, barge-in, voice quality and whether the theme "voices people want to listen to" is met' },
  { id: 'safeguarding_reviewer', brief: 'a safeguarding and privacy reviewer: crisis handling, medication boundaries, consent, data, AI disclosure, honest claims' },
  { id: 'adhd_user_bad_day', brief: 'an adult with ADHD on a bad day: you hate walls of text, waiting, being cut off, being judged, and generic advice; you love being met where you are' },
  { id: 'hackathon_generalist', brief: 'an experienced hackathon judge comparing about 100 entries for 20 prizes: originality, polish, completeness, demo-ability, and whether the evidence is believable' },
];
const CRITERIA = ['theme_voice_people_want_to_listen_to', 'use_of_assemblyai', 'technical_execution', 'user_experience', 'originality_differentiation', 'safety_and_honesty', 'completeness_demo_readiness'];
const panel = [];
for (const j of JUDGES) {
  const out = await groqOrNull(
    JUDGE_MODEL,
    [
      {
        role: 'system',
        content: `You are ${j.brief}. Score the entry strictly from the evidence given; do not assume anything not stated. Reply with JSON only: {"scores":{${CRITERIA.map((c) => `"${c}":1-10`).join(',')}},"top_strength":"one sentence","top_weakness":"one sentence","would_place_in_top_20_of_100":"yes" or "no" or "unsure"}`,
      },
      { role: 'user', content: evidence },
    ],
    500,
  );
  let parsed;
  try {
    parsed = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] || '');
  } catch {
    parsed = { raw: out };
  }
  panel.push({ judge: j.id, ...parsed });
  console.log(j.id, JSON.stringify(parsed).slice(0, 400));
  await sleep(3000);
}

const allScores = panel.flatMap((p) => Object.values(p.scores || {}).map(Number).filter((n) => n > 0));
const mean = allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : null;
const yes = panel.filter((p) => p.would_place_in_top_20_of_100 === 'yes').length;
const result = {
  labels: ['live-model', 'typed-text', 'model-as-judge'],
  note: 'Model judges reading text and evidence. Not the real judges, and not a probability of winning.',
  date,
  base: BASE,
  answerModel: ANSWER_MODEL,
  judgeModel: JUDGE_MODEL,
  ab: { scenarios: ab.length, stayWins: wins, baselineWins: losses, ties, skipped, items: ab },
  panel,
  meanScore: mean,
  judgesSayingTop20: `${yes} of ${panel.length}`,
};
writeFileSync(`docs/evidence/loop/judge-panel-${date}.json`, JSON.stringify(result, null, 2));
console.log(`\nPANEL: mean ${mean} / 10 across ${panel.length} judges x ${CRITERIA.length} criteria; top-20 votes: ${yes} of ${panel.length}`);
