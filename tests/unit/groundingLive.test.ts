import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import questions from '../fixtures/eval/questions.json';
import { checkGrounded, GENERIC_PHRASES, hasThreeBeats } from '@/lib/conversation/grounding';
import { classifyIntent } from '@/lib/conversation/intent';

/**
 * T0.1 live: the 60 prompts against a running Stay with a real model. Labels (H8): live-model, typed text (no microphone).
 *
 *   STAY_EVAL_URL=http://localhost:3120 npx vitest run tests/unit/groundingLive.test.ts
 *
 * Target: at least 57 of 60 grounded, zero canned replies. Every failure is written to the evidence file, none hidden.
 * Paced under the route's limit of 30 requests a minute per session.
 */
const URL = process.env.STAY_EVAL_URL?.replace(/\/$/, '');
const MIN_GROUNDED = Number(process.env.STAY_EVAL_MIN ?? 57);
const GAP_MS = 2300;

interface Item {
  id: string; kind: string; ask: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  expectIntent: string[]; anyOf?: string[]; threeBeats?: boolean;
}

async function ask(item: Item): Promise<{ status: number; text: string; safety?: string }> {
  const messages = [...(item.history ?? []), { role: 'user', content: item.ask }];
  const res = await fetch(`${URL}/api/voice/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: URL as string },
    body: JSON.stringify({ messages }),
  });
  const raw = await res.text();
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    const j = JSON.parse(raw) as { safety?: string; message?: string };
    return { status: res.status, text: j.message ?? '', safety: j.safety };
  }
  const text = [...raw.matchAll(/data: (\{.*\})/g)].map((m) => JSON.parse(m[1]).choices?.[0]?.delta?.content || '').join('');
  return { status: res.status, text };
}

describe.skipIf(!URL)('T0.1 live grounding (live-model)', () => {
  it(`at least ${MIN_GROUNDED} of 60 are grounded, with zero canned replies`, async () => {
    const results: Array<Record<string, unknown>> = [];
    for (const item of questions as Item[]) {
      const started = Date.now();
      let r = await ask(item);
      // the model provider's own rate limit is not a wrong answer: wait and ask again (Stay already told the person plainly), up to three times
      for (let tries = 0; tries < 3 && r.status === 503; tries++) {
        await new Promise((ok) => setTimeout(ok, 20_000));
        r = await ask(item);
      }
      const intent = classifyIntent(item.ask, { hasVisualSource: false, hasHistory: Boolean(item.history) });
      const g = checkGrounded({
        question: item.ask,
        history: item.history?.map((m) => m.content),
        hasVisualSource: false,
        response: { text: r.text, intent, groundedEvidence: [] },
      });
      const failures: string[] = [...g.failures];
      if (r.status !== 200) failures.push(`http_${r.status}`);
      if (item.anyOf) {
        const hasFact = item.anyOf.some((w) => r.text.toLowerCase().includes(w.toLowerCase()));
        if (!hasFact) failures.push('missing_expected_fact');
        // a short correct answer ("Paris.") shares no words with its question; the expected fact is the better test of "on topic"
        else if (failures.includes('ignores_subject')) failures.splice(failures.indexOf('ignores_subject'), 1);
      }
      if (item.threeBeats && !hasThreeBeats(r.text)) failures.push('not_three_beats');
      if (GENERIC_PHRASES.some((re) => re.test(r.text))) failures.push('canned');
      results.push({ id: item.id, kind: item.kind, ask: item.ask, reply: r.text, ms: Date.now() - started, failures });
      await new Promise((ok) => setTimeout(ok, GAP_MS));
    }
    const grounded = results.filter((x) => (x.failures as string[]).length === 0).length;
    const canned = results.filter((x) => (x.failures as string[]).includes('canned')).length;
    const out = resolve(__dirname, `../../docs/evidence/loop/T0.1-live-${new Date().toISOString().slice(0, 10)}.json`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      JSON.stringify({ gate: 'T0.1', labels: ['live-model', 'typed-text'], url: URL, at: new Date().toISOString(), grounded, total: results.length, canned, results }, null, 2),
    );
    console.log(`T0.1 live: ${grounded}/${results.length} grounded, ${canned} canned. Evidence: ${out}`);
    expect(canned).toBe(0);
    expect(grounded).toBeGreaterThanOrEqual(MIN_GROUNDED);
  }, 600_000);
});
