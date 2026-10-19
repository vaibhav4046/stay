import { describe, expect, it } from 'vitest';
import { fallbackTriage, normalizeTriage, parseTriageReply, splitDump, type TriageItem } from '@/lib/coach/triage';

describe('splitDump', () => {
  it('splits lines, bullets, semicolons and joiners; trims and de-duplicates', () => {
    expect(splitDump('email the landlord\n- pay council tax\n* call mum; bins')).toEqual(['email the landlord', 'pay council tax', 'call mum', 'bins']);
    expect(splitDump('I need to reply to Sam and then book the dentist, also the report')).toEqual(['reply to Sam', 'book the dentist', 'the report']);
    expect(splitDump('taxes\nTaxes\ntaxes.')).toEqual(['taxes']);
  });
  it('caps at 12 items and shortens very long ones', () => {
    expect(splitDump(Array.from({ length: 20 }, (_, i) => `task number ${i}`).join('\n'))).toHaveLength(12);
    expect(splitDump('x'.repeat(200))[0].length).toBeLessThanOrEqual(80);
  });
  it('returns nothing for empty or tiny input', () => expect(splitDump('  \n ')).toEqual([]));
});

describe('normalizeTriage', () => {
  const mk = (bucket: TriageItem['bucket'], i: number): TriageItem => ({ text: `t${i}`, bucket });
  it('keeps exactly one now, at most four today, the rest later, now first', () => {
    const out = normalizeTriage([mk('now', 1), mk('now', 2), ...[3, 4, 5, 6, 7].map((i) => mk('today', i)), mk('later', 8)]);
    expect(out.filter((i) => i.bucket === 'now')).toHaveLength(1);
    expect(out.filter((i) => i.bucket === 'today')).toHaveLength(4);
    expect(out[0].bucket).toBe('now');
    expect(out.filter((i) => i.bucket === 'later').length).toBe(3);
  });
  it('promotes something to now when the model gave none', () => {
    expect(normalizeTriage([mk('today', 1), mk('later', 2)]).some((i) => i.bucket === 'now')).toBe(true);
  });
});

describe('fallbackTriage', () => {
  it('picks a quick action as the one to start, and keeps someday items for later', () => {
    const r = fallbackTriage('clean the garage someday, email the landlord, finish the report');
    const now = r.items.find((i) => i.bucket === 'now');
    expect(now?.text).toMatch(/email the landlord/i);
    expect(r.items.find((i) => /garage/i.test(i.text))?.bucket).toBe('later');
    expect(r.items.filter((i) => i.bucket === 'now')).toHaveLength(1);
  });
  it('handles a single item and nonsense', () => {
    expect(fallbackTriage('taxes').items).toEqual([{ text: 'taxes', bucket: 'now', minutes: 5 }]);
    expect(fallbackTriage('...').items).toHaveLength(1);
  });
});

describe('parseTriageReply', () => {
  it('accepts clean and fenced JSON, normalises it, and rejects junk', () => {
    const good = '```json\n{"summary":"Okay.","items":[{"text":"email landlord","bucket":"now","firstStep":"open mail","minutes":5},{"text":"taxes","bucket":"now"}]}\n```';
    const r = parseTriageReply(good);
    expect(r?.items.filter((i) => i.bucket === 'now')).toHaveLength(1);
    expect(parseTriageReply('sorry I cannot')).toBeNull();
    expect(parseTriageReply('{"items":[]}')).toBeNull();
    expect(parseTriageReply('{"items":[{"text":"x","bucket":"someday"}]}')).toBeNull();
  });
});
