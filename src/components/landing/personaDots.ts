import { LIBRARY, libraryProgram } from '@/lib/orb/library';
import { hashString, sampleProgram } from '@/lib/orb/sdf';

export interface DotGlyph {
  a: string;
  b: string;
  colors: [string, string];
}

/**
 * A built-in orb shape as a static dot drawing (two SVG paths of round dots), sampled with the same code the live orb uses.
 * Runs on the server at render time, so a persona card costs no script and no canvas.
 */
export function dotGlyph(shapeId: string, count = 150): DotGlyph | null {
  const entry = LIBRARY.find((e) => e.id === shapeId);
  const program = libraryProgram(shapeId);
  if (!entry || !program) return null;
  const pts = sampleProgram(program, count, hashString(shapeId) | 1);
  if (!pts) return null;
  const a: string[] = [];
  const b: string[] = [];
  for (let i = 0; i < count; i++) {
    const x = (50 + pts[i * 3] * 44).toFixed(1);
    const y = (50 - pts[i * 3 + 1] * 44).toFixed(1);
    (i % 2 === 0 ? a : b).push(`M${x} ${y}h0`);
  }
  return { a: a.join(''), b: b.join(''), colors: entry.palette };
}
