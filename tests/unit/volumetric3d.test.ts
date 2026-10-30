import { describe, expect, it } from 'vitest';
import {
  generate3DRocket,
  generate3DStar,
  generate3DHeart,
  getVolumetric3DShape,
} from '@/lib/orb/volumetric3d';

describe('3D Volumetric Shape Generation', () => {
  it('generate3DRocket generates a fully 3D volumetric spacecraft with wings and flame', () => {
    const N = 3200;
    const rocket = generate3DRocket(N);
    expect(rocket.id).toBe('rocket');
    expect(rocket.points.length).toBe(N * 3);
    expect(rocket.cols.length).toBe(N * 3);

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < N; i++) {
      const x = rocket.points[i * 3];
      const y = rocket.points[i * 3 + 1];
      const z = rocket.points[i * 3 + 2];

      expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(true);

      const r = rocket.cols[i * 3];
      const g = rocket.cols[i * 3 + 1];
      const b = rocket.cols[i * 3 + 2];
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1.05);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1.05);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1.05);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }

    // Rocket extends in full 3D:
    // Y reaches from exhaust flame tip (~ -1.15) up to nosecone tip (~ 0.92)
    expect(maxY).toBeGreaterThan(0.85);
    expect(minY).toBeLessThan(-0.80);

    // X and Z must have radial symmetry (fins on all 4 axes, not a flat 2D slice)
    expect(maxX).toBeGreaterThan(0.40);
    expect(minX).toBeLessThan(-0.40);
    expect(maxZ).toBeGreaterThan(0.35); // True 3D depth, NOT flat!
    expect(minZ).toBeLessThan(-0.35);
  });

  it('generate3DStar produces 3D star with dimensional depth', () => {
    const N = 2000;
    const star = generate3DStar(N);
    expect(star.id).toBe('star');
    expect(star.points.length).toBe(N * 3);

    let maxZ = 0;
    for (let i = 0; i < N; i++) {
      maxZ = Math.max(maxZ, Math.abs(star.points[i * 3 + 2]));
    }
    expect(maxZ).toBeGreaterThan(0.30);
  });

  it('generate3DHeart produces 3D heart with volumetric lobes', () => {
    const N = 2000;
    const heart = generate3DHeart(N);
    expect(heart.id).toBe('heart');
    expect(heart.points.length).toBe(N * 3);

    let maxZ = 0;
    for (let i = 0; i < N; i++) {
      maxZ = Math.max(maxZ, Math.abs(heart.points[i * 3 + 2]));
    }
    expect(maxZ).toBeGreaterThan(0.30);
  });

  it('getVolumetric3DShape matches queries cleanly', () => {
    expect(getVolumetric3DShape('rocket', 1000)?.id).toBe('rocket');
    expect(getVolumetric3DShape('spaceship', 1000)?.id).toBe('rocket');
    expect(getVolumetric3DShape('star', 1000)?.id).toBe('star');
    expect(getVolumetric3DShape('heart', 1000)?.id).toBe('heart');
    expect(getVolumetric3DShape('nonexistent_random_thing', 1000)).toBeNull();
  });
});
