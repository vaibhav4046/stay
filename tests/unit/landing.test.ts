import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { computeOverallMetrics, computeStrategyStats } from '@/lib/coach/patterns';
import { SAMPLE_DAYS, SAMPLE_NOW, SAMPLE_SESSIONS, bandOf, dayOf } from '@/components/landing/sampleWeek';
import { CHAPTERS } from '@/components/landing/DemoPlayer';
import { TRANSCRIPT } from '@/components/landing/transcript';
import { dotGlyph } from '@/components/landing/personaDots';
import { PERSONAS } from '@/lib/voice/personas';
import { LANGS_NO, LANGS_OK, SPAN_CARDS } from '@/components/landing/resultsData';
import { weekTally } from '@/lib/coach/weekTally';

const vtt = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'demo', 'stay-demo.vtt'), 'utf8');
const cues = [...vtt.matchAll(/(\d\d):(\d\d):(\d\d\.\d{3}) --> [^\n]*\n([^\n]+)/g)].map((m) => ({
  start: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]),
  text: m[4].trim(),
}));

describe('landing: sample week', () => {
  it('is deterministic, flagged as sample, and inside the 28 days', () => {
    expect(SAMPLE_SESSIONS.length).toBeGreaterThan(40);
    expect(SAMPLE_SESSIONS.every((s) => s.isSample === true && s.userId === 'sample')).toBe(true);
    expect(SAMPLE_SESSIONS.every((s) => dayOf(s) >= 0 && dayOf(s) < SAMPLE_DAYS)).toBe(true);
    expect(SAMPLE_SESSIONS.every((s) => bandOf(s) >= 0)).toBe(true);
  });

  it('has an uneven shape, not a perfect one', () => {
    const m = computeOverallMetrics(SAMPLE_SESSIONS);
    expect(m.overallStartRatePercent).toBeGreaterThan(40);
    expect(m.overallStartRatePercent).toBeLessThan(90);
    expect(m.notStartedCount + m.pausedCount).toBeGreaterThan(5);
    const empty = Array.from({ length: SAMPLE_DAYS }, (_, d) => SAMPLE_SESSIONS.filter((s) => dayOf(s) === d).length).filter((n) => n === 0);
    expect(empty.length).toBeGreaterThan(0); // quiet days exist
  });

  it('strategy denominators add up to the total', () => {
    const stats = computeStrategyStats(SAMPLE_SESSIONS);
    expect(stats.reduce((n, s) => n + s.attempts, 0)).toBe(computeOverallMetrics(SAMPLE_SESSIONS).totalCompletedSessions);
    for (const s of stats) expect(s.denominatorLabel).toMatch(/of \d+ started|No sessions/);
  });

  it('the final-week tally only counts the last seven days', () => {
    const t = weekTally(SAMPLE_SESSIONS, SAMPLE_NOW);
    expect(t.blocks).toBe(SAMPLE_SESSIONS.filter((s) => dayOf(s) >= SAMPLE_DAYS - 7).length);
  });
});

describe('landing: demo video', () => {
  it('chapters start exactly where a caption starts', () => {
    for (const c of CHAPTERS) expect(cues.some((q) => Math.abs(q.start - c.t) < 0.001), c.label).toBe(true);
  });

  it('the transcript is the caption file', () => {
    expect(TRANSCRIPT).toHaveLength(cues.length);
    TRANSCRIPT.forEach((t, i) => expect(t.text).toBe(cues[i].text));
  });
});

describe('landing: persona dots and results data', () => {
  it('every persona shape can be drawn as dots', () => {
    for (const p of PERSONAS) {
      const g = dotGlyph(p.shape, 80);
      expect(g, p.shape).not.toBeNull();
      expect(g!.a.startsWith('M')).toBe(true);
    }
  });

  it('the language list matches the verification doc', () => {
    const doc = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'STAY_VERIFICATION_2026-10-18.md'), 'utf8');
    expect(LANGS_OK).toHaveLength(23);
    expect(LANGS_NO).toHaveLength(8);
    for (const [code, , cer] of LANGS_OK) expect(doc, code).toContain(`${code} ${cer}%`);
  });

  it('every bar fits its axis, and Stay is shown as the slowest typical reply', () => {
    for (const card of SPAN_CARDS) for (const r of card.rows) expect(r.max).toBeLessThanOrEqual(card.scale);
    const reply = SPAN_CARDS.find((c) => c.id === 'reply')!;
    const med = Object.fromEntries(reply.rows.map((r) => [r.who, r.median]));
    expect(med.stay).toBeGreaterThan(med.chatgpt!);
    expect(med.stay).toBeGreaterThan(med.gemini!);
  });
});
