import { describe, expect, it } from 'vitest';
import { FACE, ROLE, buildHumanFigure } from '@/lib/orb/human';

const roleOf = (rig: Float32Array, i: number) => Math.floor(rig[i * 4]);
const headOf = (rig: Float32Array, i: number) => (rig[i * 4] - Math.floor(rig[i * 4]) - 0.01) / 0.98;

describe('procedural therapist figure', () => {
  const N = 5200;
  const f = buildHumanFigure(N);

  it('is exactly N finite dots with matching colour and rig arrays', () => {
    expect(f.pts.length).toBe(N * 3);
    expect(f.cols.length).toBe(N * 3);
    expect(f.rig.length).toBe(N * 4);
    for (const arr of [f.pts, f.cols, f.rig]) for (let i = 0; i < arr.length; i++) expect(Number.isFinite(arr[i])).toBe(true);
    for (let i = 0; i < f.cols.length; i++) {
      expect(f.cols[i]).toBeGreaterThanOrEqual(0);
      expect(f.cols[i]).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic and also builds the phone-sized cloud', () => {
    const again = buildHumanFigure(N);
    expect(Array.from(again.pts.slice(0, 300))).toEqual(Array.from(f.pts.slice(0, 300)));
    const small = buildHumanFigure(3200);
    expect(small.pts.length).toBe(3200 * 3);
  });

  it('fits the orb: bust inside about +-1 across and from hair to chest, with depth', () => {
    let minX = 9, maxX = -9, minY = 9, maxY = -9, minZ = 9, maxZ = -9;
    for (let i = 0; i < N; i++) {
      minX = Math.min(minX, f.pts[i * 3]); maxX = Math.max(maxX, f.pts[i * 3]);
      minY = Math.min(minY, f.pts[i * 3 + 1]); maxY = Math.max(maxY, f.pts[i * 3 + 1]);
      minZ = Math.min(minZ, f.pts[i * 3 + 2]); maxZ = Math.max(maxZ, f.pts[i * 3 + 2]);
    }
    expect(minX).toBeGreaterThan(-1);
    expect(maxX).toBeLessThan(1);
    expect(maxY).toBeGreaterThan(0.85);
    expect(maxY).toBeLessThan(1);
    expect(minY).toBeLessThan(-0.85);
    expect(minY).toBeGreaterThan(-1);
    expect(maxZ - minZ).toBeGreaterThan(0.4);
    expect(maxZ).toBeLessThan(0.6);
  });

  it('is left/right balanced in mass (a symmetric, gender-neutral presence)', () => {
    let left = 0, right = 0;
    for (let i = 0; i < N; i++) (f.pts[i * 3] < 0 ? left++ : right++);
    expect(Math.abs(left - right) / N).toBeLessThan(0.06);
  });

  it('every part of the face is present, in the right place', () => {
    const where = (role: number) => {
      const xs: number[] = [], ys: number[] = [];
      for (let i = 0; i < N; i++) if (roleOf(f.rig, i) === role) { xs.push(f.pts[i * 3]); ys.push(f.pts[i * 3 + 1]); }
      return { n: xs.length, cy: ys.reduce((a, b) => a + b, 0) / (xs.length || 1), xs };
    };
    const eyes = where(ROLE.eye);
    expect(eyes.n).toBeGreaterThan(N * 0.05);
    expect(Math.abs(eyes.cy - FACE.eyeY)).toBeLessThan(0.03);
    expect(eyes.xs.filter((x) => x < 0).length).toBeGreaterThan(eyes.n * 0.4);
    expect(where(ROLE.brow).cy).toBeGreaterThan(FACE.eyeY + 0.04);
    const inner = where(ROLE.mouthInner);
    expect(inner.n).toBeGreaterThan(40);
    expect(Math.abs(inner.cy - FACE.mouthY)).toBeLessThan(0.03);
    expect(where(ROLE.torso).cy).toBeLessThan(-0.5);
    expect(where(ROLE.upperLip).n).toBeGreaterThan(60);
    expect(where(ROLE.lowerLip).n).toBeGreaterThan(60);
  });

  it('the rig encodes valid roles and head weights (torso still, head moves, neck ramps)', () => {
    let headFull = 0, torsoStill = 0;
    for (let i = 0; i < N; i++) {
      const role = roleOf(f.rig, i);
      expect(role).toBeGreaterThanOrEqual(0);
      expect(role).toBeLessThanOrEqual(8);
      const h = headOf(f.rig, i);
      expect(h).toBeGreaterThanOrEqual(-1e-4);
      expect(h).toBeLessThanOrEqual(1 + 1e-4);
      expect(f.rig[i * 4]).toBeGreaterThan(0.005); // never 0: the shader tells a figure dot from a plain shape by this
      if (h > 0.99) headFull++;
      if (role === ROLE.torso && f.pts[i * 3 + 1] < -0.6) {
        torsoStill++;
        expect(h).toBeLessThan(0.05);
      }
    }
    expect(headFull).toBeGreaterThan(N * 0.4);
    expect(torsoStill).toBeGreaterThan(N * 0.07);
  });

  it('mouth rig weights are bounded so a fully open mouth cannot tear the face', () => {
    for (let i = 0; i < N; i++) {
      const role = roleOf(f.rig, i);
      if (role >= ROLE.upperLip && role <= ROLE.mouthInner) {
        expect(Math.abs(f.rig[i * 4 + 1])).toBeLessThanOrEqual(1.0001);
        expect(Math.abs(f.rig[i * 4 + 3])).toBeLessThanOrEqual(1.0001);
      }
    }
  });
});
