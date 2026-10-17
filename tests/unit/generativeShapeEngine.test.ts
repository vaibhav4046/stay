import { describe, expect, it } from 'vitest';
import {
  hashToBillionSpace,
  synthesizeGenerativeShape,
  buildProceduralBillionShape,
  evaluateGenerativeSuperformulaPoint,
  SEMANTIC_SHAPE_ARCHETYPES,
} from '@/lib/voice/generativeShapeEngine';

describe('1-Billion-Shape AI Generative Morphology Engine', () => {
  it('deterministically hashes concepts into the [1 .. 1,000,000,000] catalog space', () => {
    const id1 = hashToBillionSpace('rocket');
    const id2 = hashToBillionSpace('rocket');
    const id3 = hashToBillionSpace('dragon');

    expect(id1).toBe(id2);
    expect(id1).toBeGreaterThanOrEqual(1);
    expect(id1).toBeLessThanOrEqual(1_000_000_000);
    expect(id3).toBeGreaterThanOrEqual(1);
    expect(id3).toBeLessThanOrEqual(1_000_000_000);
    expect(id1).not.toBe(id3);
  });

  it('synthesizes recognizable semantic shape archetypes with Gielis Superformula & SVG elements', () => {
    const rocket = synthesizeGenerativeShape('turn into a rocket ship');
    expect(rocket).not.toBeNull();
    expect(rocket?.conceptKey).toBe('rocket');
    expect(rocket?.catalogId).toBeGreaterThanOrEqual(1);
    expect(rocket?.superformula.m).toBeGreaterThan(0);
    expect(rocket?.svgElements.length).toBeGreaterThan(0);
    expect(rocket?.formulaSignature).toContain('Gielis');

    const heart = synthesizeGenerativeShape('morph into a heart');
    expect(heart).not.toBeNull();
    expect(heart?.conceptKey).toBe('heart');

    const dragon = synthesizeGenerativeShape('become a dragon');
    expect(dragon).not.toBeNull();
    expect(dragon?.conceptKey).toBe('dragon');

    const butterfly = synthesizeGenerativeShape('butterfly shape');
    expect(butterfly).not.toBeNull();
    expect(butterfly?.conceptKey).toBe('butterfly');
  });

  it('contains over 20 rich bespoke semantic shape archetypes', () => {
    expect(SEMANTIC_SHAPE_ARCHETYPES.length).toBeGreaterThanOrEqual(20);
    const keys = SEMANTIC_SHAPE_ARCHETYPES.map((a) => a.key);
    expect(keys).toContain('rocket');
    expect(keys).toContain('heart');
    expect(keys).toContain('butterfly');
    expect(keys).toContain('dna');
    expect(keys).toContain('brain');
    expect(keys).toContain('crown');
  });

  it('procedurally generates deterministic shapes for any arbitrary seed from 1 to 1 billion', () => {
    const shape42 = buildProceduralBillionShape(42);
    expect(shape42.catalogId).toBe(42);
    expect(shape42.label).toContain('#42');
    expect(shape42.superformula.m).toBeGreaterThan(0);
    expect(shape42.svgElements.length).toBeGreaterThanOrEqual(1);

    const arbitraryConcept = buildProceduralBillionShape('quantum entanglement', 'Quantum Entanglement');
    expect(arbitraryConcept.catalogId).toBeGreaterThanOrEqual(1);
    expect(arbitraryConcept.catalogId).toBeLessThanOrEqual(1_000_000_000);
    expect(arbitraryConcept.label).toContain('Quantum Entanglement');
  });

  it('computes bounded, finite Cartesian points across the full 2*pi spectrum with spring physics', () => {
    const spec = buildProceduralBillionShape('test-shape');
    const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI];

    for (const theta of angles) {
      const [x, y] = evaluateGenerativeSuperformulaPoint(spec, theta, 1.25, 0.4, 1.0);
      expect(Number.isFinite(x)).toBe(true);
      expect(Number.isFinite(y)).toBe(true);
      expect(Number.isNaN(x)).toBe(false);
      expect(Number.isNaN(y)).toBe(false);
      // Scaled points should be well within canvas bounds (radius approx 20..140)
      const r = Math.sqrt(x * x + y * y);
      expect(r).toBeGreaterThan(5);
      expect(r).toBeLessThan(200);
    }
  });
});
