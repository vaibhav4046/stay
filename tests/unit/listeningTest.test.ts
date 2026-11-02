import { describe, expect, it } from 'vitest';
import { LISTEN_QUESTION, LISTEN_TEXT, addRating, buildRound, exportJson, newResult, shuffle, summarise } from '@/lib/voice/lab/listening';

const VOICES = [
  { source: 'v1', name: 'One' },
  { source: 'v2', name: 'Two' },
  { source: 'v3', name: 'Three' },
  { source: 'browser', name: 'Browser' },
];

describe('T1.6 listening test logic', () => {
  it('the reply is about fifteen seconds of speech and the question is the agreed one', () => {
    const words = LISTEN_TEXT.split(/\s+/).length;
    expect(words).toBeGreaterThanOrEqual(40); // about 2.5 words a second at a calm pace
    expect(words).toBeLessThanOrEqual(55);
    expect(LISTEN_QUESTION).toBe("I'd happily listen to this for ten minutes");
  });

  it('shuffles without losing or repeating a voice, and the random source can be fixed', () => {
    const a = shuffle(VOICES.map((v) => v.source), () => 0.99);
    expect([...a].sort()).toEqual(['browser', 'v1', 'v2', 'v3']);
    const seq = [0.1, 0.5, 0.9];
    let i = 0;
    expect(shuffle([1, 2, 3, 4], () => seq[i++ % 3])).toEqual(shuffle([1, 2, 3, 4], (() => { let k = 0; return () => seq[k++ % 3]; })()));
  });

  it('over many rounds every voice appears first about equally often, so order does not decide the result', () => {
    const firsts: Record<string, number> = {};
    for (let n = 0; n < 4000; n++) {
      const first = buildRound(VOICES)[0].source;
      firsts[first] = (firsts[first] ?? 0) + 1;
    }
    for (const v of VOICES) expect(firsts[v.source]).toBeGreaterThan(800); // 1000 expected
  });

  it('labels the round A to D and hides which voice is which', () => {
    const r = buildRound(VOICES);
    expect(r.map((x) => x.label)).toEqual(['Voice A', 'Voice B', 'Voice C', 'Voice D']);
  });

  it('takes ratings of 1 to 5 once per voice, and nothing else', () => {
    const round = buildRound(VOICES);
    let res = newResult('Sam', round, new Date('2026-11-02T10:00:00Z'));
    res = addRating(res, round[0], 4);
    expect(res.ratings).toHaveLength(1);
    expect(() => addRating(res, round[0], 5)).toThrow(/already rated/);
    expect(() => addRating(res, round[1], 0)).toThrow(/1 to 5/);
    expect(() => addRating(res, round[1], 6)).toThrow(/1 to 5/);
    expect(() => addRating(res, round[1], 3.5)).toThrow(/1 to 5/);
  });

  it('does not change the result it was given (a new one comes back)', () => {
    const round = buildRound(VOICES);
    const before = newResult('', round);
    const after = addRating(before, round[0], 3);
    expect(before.ratings).toHaveLength(0);
    expect(after.ratings).toHaveLength(1);
    expect(before.listener).toBe('anonymous');
  });

  it('summarises the mean per voice over all listeners and exports the raw ratings too', () => {
    const mk = (who: string, stars: number[]) => {
      const round = VOICES.map((v, i) => ({ label: `Voice ${'ABCD'[i]}`, ...v }));
      let r = newResult(who, round);
      round.forEach((item, i) => { r = addRating(r, item, stars[i]); });
      return r;
    };
    const all = [mk('a', [5, 4, 3, 2]), mk('b', [3, 4, 5, 2])];
    expect(summarise(all)).toEqual([
      { source: 'v1', name: 'One', n: 2, mean: 4 },
      { source: 'v2', name: 'Two', n: 2, mean: 4 },
      { source: 'v3', name: 'Three', n: 2, mean: 4 },
      { source: 'browser', name: 'Browser', n: 2, mean: 2 },
    ]);
    const out = JSON.parse(exportJson(all, { gitSha: 'abc1234', at: '2026-11-02T12:00:00Z' }));
    expect(out.listeners).toBe(2);
    expect(out.results[0].ratings).toHaveLength(4);
    expect(out.question).toBe(LISTEN_QUESTION);
    expect(out.gitSha).toBe('abc1234');
  });
});
