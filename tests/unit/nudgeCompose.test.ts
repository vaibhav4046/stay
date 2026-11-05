import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { isCalm } from '@/lib/coach/dailyGreeting';
import { buildNudgeContext } from '@/lib/push/context';

/** The same file the service worker loads. */
const { composeNudge, clean } = createRequire(import.meta.url)('../../public/sw-compose.js') as {
  composeNudge: (slot: string, ctx: { name?: string; open?: string } | null, fallback: string, day?: number) => string;
  clean: (t: string, max: number) => string;
};

const GENERAL = 'Morning. One small thing is enough to start.';

describe('check-in sentence written on the device', () => {
  it('uses what is on the list, and the name, when it has them', () => {
    const text = composeNudge('morning', { name: 'Asha', open: 'email the landlord' }, GENERAL, 0);
    expect(text).toContain('Asha');
    expect(text).toContain('email the landlord');
  });

  it('falls back to the server’s general line when there is nothing personal', () => {
    expect(composeNudge('morning', null, GENERAL)).toBe(GENERAL);
    expect(composeNudge('morning', {}, GENERAL)).toBe(GENERAL);
    expect(composeNudge('morning', { name: 'Asha' }, GENERAL)).toBe(GENERAL);
    expect(composeNudge('afternoon', { open: 'x' }, GENERAL)).toBe(GENERAL);
  });

  it('leaves the name out cleanly when there is none', () => {
    for (let day = 0; day < 3; day++) expect(composeNudge('evening', { open: 'call mum' }, GENERAL, day)).not.toMatch(/, \./);
  });

  it('is calm for every wording, slot, day and kind of name: no guilt, no counting, no shouting', () => {
    for (const slot of ['morning', 'evening']) {
      for (let day = 0; day < 6; day++) {
        for (const name of ['', 'Asha', 'Dr. O’Neil']) {
          const text = composeNudge(slot, { name, open: 'file the tax return' }, GENERAL, day);
          expect(isCalm(text), text).toBe(true);
          expect(text).not.toMatch(/!|overdue|still not|haven't|failed/i);
          expect(text.length).toBeLessThanOrEqual(200);
        }
      }
    }
  });

  it('varies from day to day', () => {
    const lines = new Set([0, 1, 2].map((d) => composeNudge('morning', { open: 'x' }, GENERAL, d)));
    expect(lines.size).toBe(3);
  });

  it('cannot be bent by what the list says: quotes, line breaks and length are cleaned', () => {
    expect(clean('buy "milk"\nand eggs', 60)).toBe('buy milk and eggs');
    const text = composeNudge('evening', { open: `${'a'.repeat(200)}"\n<script>`, name: 'B'.repeat(100) }, GENERAL, 1);
    expect(text.length).toBeLessThanOrEqual(220);
    expect(text).not.toContain('\n');
    expect(text.match(/"/g)?.length).toBe(2); // only the pair Stay put around the item
  });
});

describe('what the app tells the service worker', () => {
  const item = (text: string, createdAt: string, done = false) => ({ text, done, createdAt });

  it('is the newest item still open, plus the name', () => {
    const ctx = buildNudgeContext([item('old', '2026-11-01T09:00:00Z'), item('new', '2026-11-04T09:00:00Z'), item('done one', '2026-11-05T09:00:00Z', true)], 'Asha');
    expect(ctx).toEqual({ name: 'Asha', open: 'new' });
  });

  it('is empty when there is nothing open and no name', () => {
    expect(buildNudgeContext([item('done', '2026-11-04T09:00:00Z', true)], null)).toEqual({});
    expect(buildNudgeContext([item('   ', '2026-11-04T09:00:00Z')], null)).toEqual({});
  });
});
