/**
 * Shape programs: a tiny drawing language (circles, ellipses, rects, polygons, strokes, rings, superformula blobs)
 * evaluated as a signed-distance field and sampled into a 3D point cloud. The same evaluator runs the built-in
 * library, LLM-authored shapes and the procedural fallback, so there is exactly one code path.
 *
 * Units: x right, y up, nominal range [-1, 1]. Output is auto-fitted to a 0.92 half-extent.
 */
import { z } from 'zod';

type V2 = [number, number];
const num = z.number().finite();
const pt = z.tuple([num, num]);

export const PartSchema = z.discriminatedUnion('k', [
  z.object({ k: z.literal('circle'), c: pt, r: num.min(0.01).max(1.6), sub: z.boolean().optional() }),
  z.object({ k: z.literal('ellipse'), c: pt, rx: num.min(0.01).max(1.6), ry: num.min(0.01).max(1.6), rot: num.optional(), sub: z.boolean().optional() }),
  z.object({ k: z.literal('rect'), c: pt, w: num.min(0.01).max(3.2), h: num.min(0.01).max(3.2), rot: num.optional(), round: num.min(0).max(1).optional(), sub: z.boolean().optional() }),
  z.object({ k: z.literal('poly'), pts: z.array(pt).min(3).max(24), sub: z.boolean().optional() }),
  z.object({ k: z.literal('line'), pts: z.array(pt).min(2).max(24), w: num.min(0.01).max(0.8), sub: z.boolean().optional() }),
  z.object({ k: z.literal('ring'), c: pt, r: num.min(0.02).max(1.6), w: num.min(0.01).max(0.8), sub: z.boolean().optional() }),
  z.object({
    k: z.literal('blob'), c: pt, r: num.min(0.05).max(1.6),
    m: num.min(1).max(16), n1: num.min(0.1).max(8), n2: num.min(0.1).max(12), n3: num.min(0.1).max(12),
    sub: z.boolean().optional(),
  }),
]);
export type Part = z.infer<typeof PartSchema>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const ShapeProgramSchema = z.object({
  parts: z.array(PartSchema).min(1).max(28),
  colors: z.tuple([hex, hex]).optional(),
});
export type ShapeProgram = z.infer<typeof ShapeProgramSchema>;

// ---------- signed distance primitives ----------
const len = (x: number, y: number) => Math.hypot(x, y);
const DEG = Math.PI / 180;

function toLocal(p: V2, c: V2, rotDeg = 0): V2 {
  const x = p[0] - c[0];
  const y = p[1] - c[1];
  if (!rotDeg) return [x, y];
  const a = -rotDeg * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return [x * ca - y * sa, x * sa + y * ca];
}

function sdSegment(px: number, py: number, a: V2, b: V2): number {
  const pax = px - a[0];
  const pay = py - a[1];
  const bax = b[0] - a[0];
  const bay = b[1] - a[1];
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1)));
  return len(pax - bax * h, pay - bay * h);
}

function sdPolygon(px: number, py: number, v: V2[]): number {
  let d = (px - v[0][0]) ** 2 + (py - v[0][1]) ** 2;
  let s = 1;
  for (let i = 0, j = v.length - 1; i < v.length; j = i, i++) {
    const ex = v[j][0] - v[i][0];
    const ey = v[j][1] - v[i][1];
    const wx = px - v[i][0];
    const wy = py - v[i][1];
    const t = Math.min(1, Math.max(0, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
    const bx = wx - ex * t;
    const by = wy - ey * t;
    d = Math.min(d, bx * bx + by * by);
    const c1 = py >= v[i][1];
    const c2 = py < v[j][1];
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

function superR(theta: number, m: number, n1: number, n2: number, n3: number): number {
  const t = (m * theta) / 4;
  const a = Math.abs(Math.cos(t)) ** n2;
  const b = Math.abs(Math.sin(t)) ** n3;
  const r = (a + b) ** (-1 / n1);
  return Number.isFinite(r) ? Math.min(r, 4) : 1;
}

export function sdPart(x: number, y: number, part: Part): number {
  switch (part.k) {
    case 'circle':
      return len(x - part.c[0], y - part.c[1]) - part.r;
    case 'ellipse': {
      const q = toLocal([x, y], part.c, part.rot);
      return (len(q[0] / part.rx, q[1] / part.ry) - 1) * Math.min(part.rx, part.ry);
    }
    case 'rect': {
      const q = toLocal([x, y], part.c, part.rot);
      const hw = part.w / 2;
      const hh = part.h / 2;
      const r = Math.min(hw, hh) * (part.round ?? 0);
      const dx = Math.abs(q[0]) - (hw - r);
      const dy = Math.abs(q[1]) - (hh - r);
      return len(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
    }
    case 'poly':
      return sdPolygon(x, y, part.pts as V2[]);
    case 'line': {
      let d = Infinity;
      for (let i = 0; i < part.pts.length - 1; i++) d = Math.min(d, sdSegment(x, y, part.pts[i] as V2, part.pts[i + 1] as V2));
      return d - part.w / 2;
    }
    case 'ring':
      return Math.abs(len(x - part.c[0], y - part.c[1]) - part.r) - part.w / 2;
    case 'blob': {
      const dx = x - part.c[0];
      const dy = y - part.c[1];
      const R = superR(Math.atan2(dy, dx), part.m, part.n1, part.n2, part.n3);
      // normalise so the largest radius is ~part.r
      return len(dx, dy) - R * part.r * 0.62;
    }
  }
}

export function sdProgram(x: number, y: number, parts: Part[]): number {
  let d = Infinity;
  for (const part of parts) {
    const pd = sdPart(x, y, part);
    d = part.sub ? Math.max(d, -pd) : Math.min(d, pd);
  }
  return d;
}

// ---------- deterministic PRNG + hashing ----------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates on xyz triples, so any prefix of the cloud is an even sample (small orbs draw fewer dots). */
function shuffleTriples(a: Float32Array, rnd: () => number): Float32Array {
  const n = a.length / 3;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    for (let c = 0; c < 3; c++) {
      const t = a[i * 3 + c];
      a[i * 3 + c] = a[j * 3 + c];
      a[j * 3 + c] = t;
    }
  }
  return a;
}

// ---------- sampling ----------
const GRID = 72;
const RANGE = 1.7;

/** Fills a program with points: ~72% interior (soft density), ~28% crisp contour. Returns xyz triples or null if degenerate. */
export function sampleProgram(program: ShapeProgram, n: number, seed = 1): Float32Array | null {
  const parts = program.parts;
  // coarse grid probe for bbox + area
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, inside = 0;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x = -RANGE + ((gx + 0.5) / GRID) * 2 * RANGE;
      const y = -RANGE + ((gy + 0.5) / GRID) * 2 * RANGE;
      if (sdProgram(x, y, parts) < 0) {
        inside++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (inside < 10 || inside > GRID * GRID * 0.9) return null;
  const cell = (2 * RANGE) / GRID;
  minX -= cell; maxX += cell; minY -= cell; maxY += cell;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2;
  const scale = 0.92 / half;

  const rnd = mulberry32(seed);
  const out = new Float32Array(n * 3);
  const edgeTarget = Math.floor(n * 0.28);
  const edgeBand = 0.018 / scale; // contour thickness in program units
  let k = 0;

  const push = (x: number, y: number, d: number) => {
    const depth = Math.sqrt(Math.min(1, Math.max(0, -d / 0.24)));
    out[k * 3] = (x - cx) * scale;
    out[k * 3 + 1] = (y - cy) * scale;
    out[k * 3 + 2] = (rnd() * 2 - 1) * 0.2 * depth;
    k++;
  };

  // contour points
  let guard = 0;
  while (k < edgeTarget && guard++ < n * 400) {
    const x = minX + rnd() * (maxX - minX);
    const y = minY + rnd() * (maxY - minY);
    const d = sdProgram(x, y, parts);
    if (Math.abs(d) < edgeBand) push(x, y, Math.min(d, 0));
  }
  // interior points
  guard = 0;
  while (k < n && guard++ < n * 400) {
    const x = minX + rnd() * (maxX - minX);
    const y = minY + rnd() * (maxY - minY);
    const d = sdProgram(x, y, parts);
    if (d < 0) push(x, y, d);
  }
  if (k < n * 0.9) return null;
  // top up any shortfall by repeating existing points with tiny jitter
  for (let i = k; i < n; i++) {
    const s = Math.floor(rnd() * k);
    out[i * 3] = out[s * 3] + (rnd() - 0.5) * 0.01;
    out[i * 3 + 1] = out[s * 3 + 1] + (rnd() - 0.5) * 0.01;
    out[i * 3 + 2] = out[s * 3 + 2];
  }
  return shuffleTriples(out, rnd);
}

/** Resting orb: a luminous shell of points with a faint inner core. */
export function spherePoints(n: number, seed = 7): Float32Array {
  const rnd = mulberry32(seed);
  const out = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const shell = Math.floor(n * 0.86);
  for (let i = 0; i < n; i++) {
    if (i < shell) {
      const y = 1 - (i / (shell - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const R = 0.86 + rnd() * 0.05;
      out[i * 3] = Math.cos(th) * r * R;
      out[i * 3 + 1] = y * R;
      out[i * 3 + 2] = Math.sin(th) * r * R;
    } else {
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      const R = 0.55 * Math.cbrt(rnd());
      out[i * 3] = Math.cos(th) * r * R;
      out[i * 3 + 1] = u * R;
      out[i * 3 + 2] = Math.sin(th) * r * R;
    }
  }
  return shuffleTriples(out, rnd);
}

/**
 * Procedural fallback: any string deterministically becomes a distinct, pleasant superformula form
 * (optionally with a satellite and a ring). Works offline and for words nobody anticipated.
 */
export function proceduralProgram(key: string): ShapeProgram {
  const h = hashString(key.toLowerCase());
  const r = mulberry32(h);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  // symmetric rosettes (n2 = n3): petals, stars, snowflakes. Never lopsided blobs.
  const m = pick([5, 6, 7, 8, 9, 10, 12]);
  const n = 1.2 + r() * 3.4;
  const parts: Part[] = [{ k: 'blob', c: [0, 0], r: 1.4, m, n1: 0.9 + r() * 2.2, n2: n, n3: n }];
  if (r() > 0.4) parts.push({ k: 'circle', c: [0, 0], r: 0.16 + r() * 0.16, sub: true });
  if (r() > 0.55) parts.push({ k: 'ring', c: [0, 0], r: 0.38 + r() * 0.12, w: 0.06 });
  return { parts };
}

function toHsl(hexStr: string): [number, number, number] {
  const r = parseInt(hexStr.slice(1, 3), 16) / 255, g = parseInt(hexStr.slice(3, 5), 16) / 255, b = parseInt(hexStr.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function fromHsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}
/** Keep model-chosen colours readable on a pale page: never white, never near-black, keep real hues vivid. */
export function fixColor(hexStr: string): string {
  const [h, s, l] = toHsl(hexStr);
  if (s < 0.12) return fromHsl(h, s, Math.min(0.58, Math.max(0.3, l)));
  return fromHsl(h, Math.max(0.5, s), Math.min(0.64, Math.max(0.4, l)));
}

/** Clamp an untrusted program: bounded coordinates, bounded part count. Returns null when it cannot be used. */
export function validateProgram(raw: unknown): ShapeProgram | null {
  const parsed = ShapeProgramSchema.safeParse(raw);
  if (!parsed.success) return null;
  const clampXY = (p: [number, number]): [number, number] => [Math.max(-1.6, Math.min(1.6, p[0])), Math.max(-1.6, Math.min(1.6, p[1]))];
  const parts = parsed.data.parts.map((p): Part => {
    switch (p.k) {
      case 'circle': case 'ellipse': case 'rect': case 'ring': case 'blob':
        return { ...p, c: clampXY(p.c) };
      case 'poly': case 'line':
        return { ...p, pts: p.pts.map(clampXY) } as Part;
    }
  });
  const colors = parsed.data.colors ? ([fixColor(parsed.data.colors[0]), fixColor(parsed.data.colors[1])] as [string, string]) : undefined;
  const program: ShapeProgram = { parts, colors };
  return sampleProgram(program, 600, 3) ? program : null;
}
