import { describe, expect, it } from 'vitest';
import { chimeNotes } from '@/lib/sound/chime';

describe('call chimes', () => {
  it('connecting goes up, ending goes down, and ending lingers a little longer', () => {
    const up = chimeNotes('connect');
    const down = chimeNotes('end');
    expect(up[1].freq).toBeGreaterThan(up[0].freq);
    expect(down[1].freq).toBeLessThan(down[0].freq);
    expect(down[1].length).toBeGreaterThan(up[1].length);
  });

  it('is short: under half a second of sound', () => {
    for (const kind of ['connect', 'end'] as const) {
      const end = Math.max(...chimeNotes(kind).map((n) => n.at + n.length));
      expect(end, kind).toBeLessThan(0.6);
    }
  });
});
