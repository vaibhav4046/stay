import { describe, it, expect } from 'vitest';
import { BEZEL, DEPTH, FOLD, barrelFacets, edgeFacets, sizeOf } from '@/components/landing/foldGeometry';

describe('foldable geometry', () => {
  it('opens to one display of about 4:3 with the same thin bezel on every outer side and none at the spine', () => {
    const { a, b } = FOLD.wide;
    const ratio = (a.sw + b.sw) / a.sh;
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(1.45);
    expect(a.sx).toBe(BEZEL); // outer left
    expect(a.w - a.sx - a.sw).toBe(0); // none at the spine
    expect(b.sx).toBe(0);
    expect(b.w - b.sx - b.sw).toBe(BEZEL);
    expect(a.sy).toBe(BEZEL);
    expect(a.h - a.sy - a.sh).toBe(BEZEL);
    expect(sizeOf('wide').w).toBe(a.w + b.w); // the halves meet: no gap
    expect(sizeOf('tall').h).toBe(FOLD.tall.a.h + FOLD.tall.b.h);
  });

  it('the edge strips run round the whole outline with no gap (every strip end has a partner)', () => {
    for (const o of ['wide', 'tall'] as const) {
      for (const role of ['a', 'b'] as const) {
        const f = edgeFacets(FOLD[o][role]);
        const points = f.flatMap((s) => {
          const t = ((s.angle + 90) * Math.PI) / 180; // along the outline
          const dx = (Math.cos(t) * s.len) / 2;
          const dy = (Math.sin(t) * s.len) / 2;
          return [[s.x - dx, s.y - dy], [s.x + dx, s.y + dy]];
        });
        points.forEach((p, i) => {
          const near = points.some((q, j) => j !== i && Math.hypot(p[0] - q[0], p[1] - q[1]) < 1.5);
          expect(near, `${o} ${role} strip end ${i}`).toBe(true);
        });
        expect(f.every((s) => s.shade >= 0 && s.shade <= 1)).toBe(true);
      }
    }
  });

  it('the hinge barrel has strips that face forward and one warm catch-light', () => {
    const b = barrelFacets();
    expect(b).toHaveLength(7);
    expect(Math.max(...b.map((s) => Math.abs(s.angle)))).toBeLessThan(90);
    expect(b.some((s) => s.spec)).toBe(true);
    expect(DEPTH).toBeGreaterThan(0);
  });
});
