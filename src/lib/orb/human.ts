/**
 * The therapist: a calm, warm, gender-neutral bust (hair, head, neck, shoulders) drawn entirely as dots.
 *
 * It is built with the same drawing language as every other shape (signed-distance parts from sdf.ts for the
 * regions, a blue-noise-style sampler so the stipple looks even), plus two things a flat shape does not need:
 *  - per-dot colour, lit from the upper left so the face has volume, and
 *  - a per-dot "rig": which part of the face the dot belongs to and how strongly the live animation (mouth,
 *    blink, brow, breath, head) moves it. The vertex shader reads the rig; nothing about the figure is baked.
 *
 * Units match the rest of the orb: x right, y up, the bust spans about [-0.95, 0.95].
 */
import { mulberry32, sdProgram, type Part } from './sdf';

export const FIGURE_KEY = 'human';
export const FIGURE_PALETTE: [string, string] = ['#E9A57F', '#0E7F7A'];
/** Where the shader should start the staggered pour (the middle of the face). */
export const FIGURE_WAVE_CENTRE: [number, number] = [0, 0.3];

/** Layout constants shared with the vertex shader, so mouth and eyes move about their true centres. */
export const FACE = {
  mouthY: 0.09,
  mouthHalfW: 0.115,
  /** Lip gap at full open. */
  mouthOpenH: 0.12,
  eyeY: 0.42,
  eyeX: 0.165,
  eyeHalfW: 0.07,
  browY: 0.505,
  neckPivotY: -0.2,
} as const;

export const ROLE = {
  rigid: 0,
  upperLip: 1,
  lowerLip: 2,
  mouthInner: 3,
  eye: 4,
  brow: 5,
  torso: 6,
  detail: 7,
  hair: 8,
} as const;

export interface FigureCloud {
  /** xyz triples. */
  pts: Float32Array;
  /** rgb triples (0..1). */
  cols: Float32Array;
  /** vec4 per dot: (role + 0.01 + headWeight * 0.98, a, b, c); see the role table in OrbParticles' shader. */
  rig: Float32Array;
}

type V3 = [number, number, number];

// ------------------------------------------------------------------ colour

const hexRgb = (h: string): V3 => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const mix3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const C = {
  skinLit: hexRgb('#EBA47D'),
  skinShade: hexRgb('#B0603F'),
  skinEdge: hexRgb('#7E412F'),
  hairLit: hexRgb('#4F3527'),
  hairShade: hexRgb('#241915'),
  hairEdge: hexRgb('#1F1512'),
  clothLit: hexRgb('#16A39C'),
  clothShade: hexRgb('#075A57'),
  clothEdge: hexRgb('#053F3D'),
  eye: hexRgb('#2A201D'),
  lid: hexRgb('#6A4535'),
  brow: hexRgb('#4A3226'),
  lipUpper: hexRgb('#BC5A58'),
  lipLower: hexRgb('#D07570'),
  mouthInner: hexRgb('#6A2330'),
  nose: hexRgb('#C47F5E'),
  blush: hexRgb('#E8908A'),
  neckShadow: hexRgb('#8F5340'),
};

// ------------------------------------------------------------------ regions (the shared SDF drawing language)

const E = (x: number, y: number, rx: number, ry: number, rot = 0, sub?: boolean): Part => ({ k: 'ellipse', c: [x, y], rx, ry, rot, sub });
const P = (pts: Array<[number, number]>, sub?: boolean): Part => ({ k: 'poly', pts, sub });
const Ci = (x: number, y: number, r: number): Part => ({ k: 'circle', c: [x, y], r });
const mirrorX = (pts: Array<[number, number]>): Array<[number, number]> => pts.map(([x, y]) => [-x, y]);

const HEAD: Part[] = [E(0, 0.5, 0.385, 0.41), E(0, 0.28, 0.33, 0.345)];
const CURTAIN_L: Array<[number, number]> = [[-0.47, 0.56], [-0.455, 0.15], [-0.425, -0.03], [-0.31, -0.03], [-0.3, 0.18], [-0.31, 0.52]];
const HAIR: Part[] = [
  E(0, 0.52, 0.455, 0.425),
  P(CURTAIN_L),
  P(mirrorX(CURTAIN_L)),
  E(0, 0.3, 0.292, 0.44, 0, true), // the face opening
  E(-0.1, 0.77, 0.26, 0.095, -14), // a soft side-swept fringe over the forehead
];
const NECK: Part[] = [{ k: 'rect', c: [0, -0.18], w: 0.27, h: 0.31 }];
const SHOULDER_POLY: Array<[number, number]> = [[-0.12, -0.33], [-0.36, -0.42], [-0.62, -0.5], [-0.78, -0.64], [-0.82, -0.95], [0.82, -0.95], [0.78, -0.64], [0.62, -0.5], [0.36, -0.42], [0.12, -0.33]];
const TORSO: Part[] = [P(SHOULDER_POLY), Ci(-0.66, -0.66, 0.17), Ci(0.66, -0.66, 0.17), { k: 'rect', c: [0, -1.1], w: 3, h: 0.3, sub: true }, P([[-0.19, -0.3], [0.19, -0.3], [0, -0.66]], true)];
const CHEST_V: Part[] = [P([[-0.16, -0.34], [0.16, -0.34], [0, -0.645]])];

const sd = (parts: Part[]) => (x: number, y: number) => sdProgram(x, y, parts);
const sdHead = sd(HEAD);
const sdHair = sd(HAIR);
const sdNeck = sd(NECK);
const sdTorso = sd(TORSO);
const sdChest = sd(CHEST_V);

// ------------------------------------------------------------------ depth + shading

const ellipsoid = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, rz: number) => {
  const u = (x - cx) / rx;
  const v = (y - cy) / ry;
  const w = 1 - u * u - v * v;
  return w > 0 ? rz * Math.sqrt(w) : 0;
};
const zFace = (x: number, y: number) => ellipsoid(x, y, 0, 0.36, 0.4, 0.56, 0.32);
const zHair = (x: number, y: number) => ellipsoid(x, y, 0, 0.4, 0.47, 0.58, 0.36);
const zNeck = (x: number, _y: number) => ellipsoid(x, 0, 0, 0, 0.15, 4, 0.09);
const zTorso = (x: number, y: number) => ellipsoid(x, y, 0, -0.9, 0.9, 0.55, 0.22);

const LIGHT: V3 = (() => {
  const l: V3 = [-0.45, 0.55, 0.7];
  const n = Math.hypot(...l);
  return [l[0] / n, l[1] / n, l[2] / n];
})();
/** Lambert from the finite-difference normal of a depth function. */
function lambert(z: (x: number, y: number) => number, x: number, y: number): number {
  const e = 0.012;
  const dzdx = (z(x + e, y) - z(x - e, y)) / (2 * e);
  const dzdy = (z(x, y + e) - z(x, y - e)) / (2 * e);
  const nl = Math.hypot(dzdx, dzdy, 1);
  return clamp01((-dzdx * LIGHT[0] - dzdy * LIGHT[1] + LIGHT[2]) / nl);
}

// ------------------------------------------------------------------ sampling

interface Dot {
  x: number;
  y: number;
  z: number;
  col: V3;
  role: number;
  a: number;
  b: number;
  c: number;
  head: number;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Best-candidate sampling: for each new dot draw a few candidates in the region and keep the one furthest from
 * the dots already placed in this layer. Gives an even, stippled spacing instead of random clumps.
 */
function sampleLayer(rnd: () => number, accept: (x: number, y: number) => boolean, box: Box, count: number, tries = 7): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (count <= 0) return out;
  const area = (box.x1 - box.x0) * (box.y1 - box.y0);
  const cell = Math.max(0.01, Math.sqrt(area / count) * 0.9);
  const grid = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 4096 + cy;
  const nearest = (x: number, y: number): number => {
    const cx = Math.floor(x / cell);
    const cy = Math.floor(y / cell);
    let best = Infinity;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const bucket = grid.get(key(cx + dx, cy + dy));
        if (!bucket) continue;
        for (const i of bucket) {
          const d = (out[i][0] - x) ** 2 + (out[i][1] - y) ** 2;
          if (d < best) best = d;
        }
      }
    }
    return best;
  };
  let guard = 0;
  while (out.length < count && guard++ < count * 400) {
    let bx = 0;
    let by = 0;
    let bd = -1;
    let found = 0;
    let inner = 0;
    while (found < tries && inner++ < tries * 60) {
      const x = box.x0 + rnd() * (box.x1 - box.x0);
      const y = box.y0 + rnd() * (box.y1 - box.y0);
      if (!accept(x, y)) continue;
      found++;
      const d = nearest(x, y);
      if (d > bd) {
        bd = d;
        bx = x;
        by = y;
      }
    }
    if (bd < 0) continue;
    const idx = out.length;
    out.push([bx, by]);
    const k = key(Math.floor(bx / cell), Math.floor(by / cell));
    const bucket = grid.get(k);
    if (bucket) bucket.push(idx);
    else grid.set(k, [idx]);
  }
  return out;
}

/** n points along a parametric stroke with a little perpendicular jitter (width) and even spacing in u. */
function sampleStroke(rnd: () => number, curve: (u: number) => [number, number], n: number, width: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    const u = (i + 0.3 + rnd() * 0.4) / n;
    const [x, y] = curve(u);
    const [x2, y2] = curve(Math.min(1, u + 0.01));
    const [x1, y1] = curve(Math.max(0, u - 0.01));
    const tx = x2 - x1;
    const ty = y2 - y1;
    const tl = Math.hypot(tx, ty) || 1;
    const off = (rnd() - 0.5) * width;
    out.push([x - (ty / tl) * off, y + (tx / tl) * off, u]);
  }
  return out;
}

// ------------------------------------------------------------------ the figure

const WEIGHTS = {
  faceFill: 0.21,
  faceEdge: 0.04,
  hairFill: 0.27,
  hairEdge: 0.06,
  hairBack: 0.05,
  neck: 0.035,
  torsoFill: 0.12,
  torsoEdge: 0.035,
  chest: 0.015,
  collar: 0.02,
  eye: 0.072, // both eyes
  brow: 0.032, // both brows
  nose: 0.028,
  upperLip: 0.026,
  lowerLip: 0.032,
  mouthInner: 0.026,
  blush: 0.012, // both cheeks
  shadow: 0.012,
};

/** Largest-remainder allocation so the layer counts always sum to exactly n. */
function allocate(n: number): Record<keyof typeof WEIGHTS, number> {
  const keys = Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>;
  const total = keys.reduce((s, k) => s + WEIGHTS[k], 0);
  const raw = keys.map((k) => (WEIGHTS[k] / total) * n);
  const base = raw.map(Math.floor);
  let left = n - base.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((p, q) => q[0] - p[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    base[i]++;
    left--;
  }
  const res = {} as Record<keyof typeof WEIGHTS, number>;
  keys.forEach((k, i) => (res[k] = base[i]));
  return res;
}

export function buildHumanFigure(n: number, seed = 11): FigureCloud {
  const rnd = mulberry32(seed);
  const cnt = allocate(n);
  const dots: Dot[] = [];
  const jitter = (c: V3, amt = 0.05): V3 => {
    const k = 1 + (rnd() - 0.5) * 2 * amt;
    return [clamp01(c[0] * k), clamp01(c[1] * k), clamp01(c[2] * k)];
  };
  const add = (d: Dot) => dots.push(d);
  const headWeightAt = (y: number) => clamp01((y + 0.34) / 0.3) ** 1.2; // 1 at the chin, 0 at the shoulders
  const { mouthY: M, mouthHalfW: MW, eyeY: EY, eyeX: EX, eyeHalfW: EW } = FACE;

  // ---- face skin: the head region minus the hair, stippled; jaw and upper lip follow the mouth
  const faceIn = (x: number, y: number) => sdHead(x, y) < 0 && sdHair(x, y) > 0;
  const faceEdgeD = (x: number, y: number) => Math.max(sdHead(x, y), -sdHair(x, y));
  const headBox: Box = { x0: -0.4, x1: 0.4, y0: -0.08, y1: 0.92 };
  const jawRig = (x: number, y: number): { role: number; a: number } => {
    const wy = smooth(M + 0.02, M - 0.07, y);
    const wx = 1 - smooth(0.17, 0.33, Math.abs(x));
    const jaw = wy * wx;
    if (jaw > 0.02) return { role: ROLE.lowerLip, a: jaw };
    const up = smooth(M + 0.1, M + 0.025, y) * (1 - smooth(0.1, 0.2, Math.abs(x))) * smooth(M - 0.01, M + 0.03, y);
    if (up > 0.02) return { role: ROLE.upperLip, a: up };
    return { role: ROLE.rigid, a: 0 };
  };
  const skinDot = (x: number, y: number, edge: boolean) => {
    const s = lambert(zFace, x, y);
    let col = mix3(C.skinShade, C.skinLit, smooth(0.35, 0.95, s));
    if (edge) col = mix3(col, C.skinEdge, 0.55);
    const jr = jawRig(x, y);
        add({ x, y, z: zFace(x, y) + (rnd() - 0.5) * 0.015, col: jitter(col, 0.04), role: jr.role, a: jr.a, b: 0, c: 0, head: 1 });
  };
  for (const [x, y] of sampleLayer(rnd, faceIn, headBox, cnt.faceFill)) skinDot(x, y, false);
  for (const [x, y] of sampleLayer(rnd, (px, py) => faceIn(px, py) && faceEdgeD(px, py) > -0.014, headBox, cnt.faceEdge)) skinDot(x, y, true);

  // ---- blush: a few pink dots on the cheeks make the face read as warm
  for (const sx of [-1, 1]) {
    const pts = sampleLayer(rnd, (x, y) => faceIn(x, y) && Math.hypot(x - sx * 0.2, (y - 0.23) * 1.3) < 0.085, { x0: sx * 0.2 - 0.09, x1: sx * 0.2 + 0.09, y0: 0.13, y1: 0.33 }, Math.round(cnt.blush / 2));
    for (const [x, y] of pts) add({ x, y, z: zFace(x, y) + 0.01, col: jitter(C.blush, 0.05), role: ROLE.rigid, a: 0, b: 0, c: 0, head: 1 });
  }

  // ---- under-chin shadow on the top of the neck gives the head separation from the body
  for (const [x, y] of sampleLayer(rnd, (px, py) => sdNeck(px, py) < 0 && py > -0.2 && py < 0.0, { x0: -0.12, x1: 0.12, y0: -0.2, y1: 0 }, cnt.shadow)) {
    add({ x, y, z: zNeck(x, y) + 0.01, col: jitter(C.neckShadow, 0.05), role: ROLE.rigid, a: 0, b: 0, c: 0, head: headWeightAt(y) });
  }

  // ---- hair: dense fill, a crisp edge, and a back shell so a turn of the head shows volume
  const hairIn = (x: number, y: number) => sdHair(x, y) < 0;
  const hairBox: Box = { x0: -0.48, x1: 0.48, y0: -0.04, y1: 0.96 };
  const hairDot = (x: number, y: number, edge: boolean, back: boolean) => {
    const s = lambert(zHair, x, y);
    let col = mix3(C.hairShade, C.hairLit, smooth(0.3, 1, s) * (0.55 + rnd() * 0.45));
    if (edge) col = mix3(col, C.hairEdge, 0.5);
    const zf = zHair(x, y);
    const z = back ? -zf * 0.85 - 0.04 - rnd() * 0.05 : zf * 0.98 + 0.02 + rnd() * 0.03;
    add({ x, y, z, col: jitter(col, 0.06), role: ROLE.hair, a: 0, b: 0, c: 0, head: 1 });
  };
  for (const [x, y] of sampleLayer(rnd, hairIn, hairBox, cnt.hairFill)) hairDot(x, y, false, false);
  for (const [x, y] of sampleLayer(rnd, (px, py) => sdHair(px, py) < 0 && sdHair(px, py) > -0.016, hairBox, cnt.hairEdge)) hairDot(x, y, true, false);
  for (const [x, y] of sampleLayer(rnd, hairIn, hairBox, cnt.hairBack)) hairDot(x, y, false, true);

  // ---- neck
  for (const [x, y] of sampleLayer(rnd, (px, py) => sdNeck(px, py) < 0 && py < 0.0 && !(sdTorso(px, py) < 0), { x0: -0.14, x1: 0.14, y0: -0.34, y1: 0.0 }, cnt.neck)) {
    const s = lambert((px, py) => zNeck(px, py), x, y);
    add({ x, y, z: zNeck(x, y), col: jitter(mix3(C.skinShade, C.skinLit, smooth(0.3, 0.95, s) * 0.8), 0.04), role: ROLE.rigid, a: 0, b: 0, c: 0, head: headWeightAt(y) });
  }

  // ---- torso: a soft teal top with a V neckline
  const torsoIn = (x: number, y: number) => sdTorso(x, y) < 0;
  const torsoBox: Box = { x0: -0.85, x1: 0.85, y0: -0.97, y1: -0.3 };
  const clothDot = (x: number, y: number, edge: boolean) => {
    const s = lambert(zTorso, x, y);
    let col = mix3(C.clothShade, C.clothLit, smooth(0.45, 0.95, s));
    if (edge) col = mix3(col, C.clothEdge, 0.6);
    add({ x, y, z: zTorso(x, y) + (rnd() - 0.5) * 0.02, col: jitter(col, 0.05), role: ROLE.torso, a: 1, b: 0, c: 0, head: 0 });
  };
  for (const [x, y] of sampleLayer(rnd, torsoIn, torsoBox, cnt.torsoFill)) clothDot(x, y, false);
  for (const [x, y] of sampleLayer(rnd, (px, py) => sdTorso(px, py) < 0 && sdTorso(px, py) > -0.016 && py > -0.925, torsoBox, cnt.torsoEdge)) clothDot(x, y, true);
  for (const [x, y] of sampleLayer(rnd, (px, py) => sdChest(px, py) < 0, { x0: -0.17, x1: 0.17, y0: -0.67, y1: -0.33 }, cnt.chest)) {
    add({ x, y, z: zTorso(x, y) - 0.01, col: jitter(mix3(C.skinShade, C.skinLit, 0.55), 0.04), role: ROLE.torso, a: 1, b: 0, c: 0, head: headWeightAt(y) });
  }
  // collar: two strokes from the neck to the V apex
  for (const sx of [-1, 1]) {
    for (const [x, y] of sampleStroke(rnd, (u) => [sx * (0.165 - 0.165 * u), -0.335 - 0.31 * u], Math.round(cnt.collar / 2), 0.014)) {
      add({ x, y, z: zTorso(x, y) + 0.01, col: jitter(C.clothEdge, 0.05), role: ROLE.torso, a: 1, b: 0, c: 0, head: 0 });
    }
  }

  // ---- eyes
  const zEye = (x: number, y: number) => zFace(x, y) + 0.015;
  const eyeN = Math.round(cnt.eye / 2);
  const browN = Math.round(cnt.brow / 2);
  for (const sx of [-1, 1]) {
    const cx = sx * EX;
    const upperY = (u: number) => EY + 0.034 * Math.pow(1 - u * u, 0.9);
    const lowerY = (u: number) => EY - 0.021 * Math.pow(1 - u * u, 0.9);
    const eyeDot = (x: number, y: number, col: V3, size = 1) => add({ x, y, z: zEye(x, y), col: jitter(col, 0.05), role: ROLE.eye, a: y - EY, b: size, c: 0, head: 1 });
    const outline = Math.round(eyeN * 0.4);
    for (const [x, y] of sampleStroke(rnd, (t) => { const u = t * 2 - 1; return [cx + u * EW, upperY(u)]; }, outline, 0.01)) eyeDot(x, y, C.eye);
    for (const [x, y] of sampleStroke(rnd, (t) => { const u = t * 2 - 1; return [cx + u * EW, lowerY(u)]; }, Math.round(outline * 0.55), 0.008)) eyeDot(x, y, C.lid);
    // lid crease above the eye
    for (const [x, y] of sampleStroke(rnd, (t) => { const u = t * 2 - 1; return [cx + u * EW * 0.9, upperY(u) + 0.017]; }, Math.round(eyeN * 0.18), 0.008)) eyeDot(x, y, C.lid);
    // iris: a filled dark disc
    const irisN = eyeN - outline - Math.round(outline * 0.55) - Math.round(eyeN * 0.18);
    for (const [x, y] of sampleLayer(rnd, (px, py) => Math.hypot(px - cx, py - (EY + 0.004)) < 0.026, { x0: cx - 0.027, x1: cx + 0.027, y0: EY - 0.023, y1: EY + 0.031 }, irisN, 4)) eyeDot(x, y, C.eye);
  }

  // ---- brows: soft arcs, inner ends a touch higher (kind, attentive)
  for (const sx of [-1, 1]) {
    const brow = (u: number): [number, number] => [sx * (0.07 + 0.18 * u), FACE.browY + 0.024 * Math.sin(Math.PI * (0.08 + 0.84 * u)) - 0.012 * u];
    for (const [x, y, u] of sampleStroke(rnd, brow, browN, 0.022)) {
      const taper = 1 - 0.5 * u;
      add({ x, y, z: zFace(x, y) + 0.012, col: jitter(C.brow, 0.06), role: ROLE.brow, a: taper, b: 0, c: 0, head: 1 });
    }
  }

  // ---- nose: a bridge shadow on the shaded side, the underside curve and two nostril dots
  const noseZ = (x: number, y: number) => zFace(x, y) + 0.085 * Math.exp(-(((y - 0.2) / 0.07) ** 2)) * Math.exp(-((x / 0.08) ** 2));
  const noseDot = (x: number, y: number, col: V3) => add({ x, y, z: noseZ(x, y), col: jitter(col, 0.05), role: ROLE.detail, a: 0, b: 0, c: 0, head: 1 });
  const nBridge = Math.round(cnt.nose * 0.38);
  for (const [x, y] of sampleStroke(rnd, (u) => [0.028 + 0.006 * u, 0.4 - 0.19 * u], nBridge, 0.01)) noseDot(x, y, C.nose);
  const nBase = Math.round(cnt.nose * 0.46);
  for (const [x, y] of sampleStroke(rnd, (u) => { const t = u * 2 - 1; return [t * 0.062, 0.205 - 0.022 * (1 - t * t) + 0.012 * t * t]; }, nBase, 0.01)) noseDot(x, y, C.nose);
  const nNos = cnt.nose - nBridge - nBase;
  for (let i = 0; i < nNos; i++) noseDot((i % 2 ? 1 : -1) * (0.04 + rnd() * 0.01), 0.192 + rnd() * 0.01, C.eye);

  // ---- mouth: upper lip (two lines), lower lip (two lines), and an interior that only shows when it opens
  const smile = (u: number) => 0.018 * u * u;
  const taper = (u: number) => Math.pow(Math.max(0, 1 - u * u), 0.6);
  const lipCurve = (kind: 'top' | 'upper' | 'lower' | 'bottom') => (t: number): [number, number] => {
    const u = t * 2 - 1;
    const au = Math.abs(u);
    const base = M + smile(u);
    switch (kind) {
      case 'top': return [u * MW, base + 0.03 * Math.pow(1 - Math.pow(au, 1.3), 1) - 0.006 * Math.exp(-((u / 0.18) ** 2))];
      case 'upper': return [u * MW, base + 0.011 * (1 - Math.pow(au, 1.6))];
      case 'lower': return [u * MW, base - 0.011 * (1 - Math.pow(au, 1.6))];
      case 'bottom': return [u * MW, base - 0.036 * (1 - Math.pow(au, 1.8))];
    }
  };
  const lipDots = (curve: (t: number) => [number, number], count: number, col: V3, role: number) => {
    for (const [x, y, t] of sampleStroke(rnd, curve, count, 0.01)) {
      const u = t * 2 - 1;
      add({ x, y, z: zFace(x, y) + 0.03 * (1 - u * u), col: jitter(col, 0.05), role, a: taper(u), b: 0, c: u, head: 1 });
    }
  };
  lipDots(lipCurve('top'), Math.round(cnt.upperLip * 0.45), C.lipUpper, ROLE.upperLip);
  lipDots(lipCurve('upper'), cnt.upperLip - Math.round(cnt.upperLip * 0.45), C.lipUpper, ROLE.upperLip);
  lipDots(lipCurve('lower'), Math.round(cnt.lowerLip * 0.5), C.lipLower, ROLE.lowerLip);
  lipDots(lipCurve('bottom'), cnt.lowerLip - Math.round(cnt.lowerLip * 0.5), C.lipLower, ROLE.lowerLip);
  for (let i = 0; i < cnt.mouthInner; i++) {
    const u = (rnd() * 2 - 1) * 0.9;
    const t = rnd() * 2 - 1;
    const tp = taper(u);
    add({ x: u * MW, y: M + smile(u), z: zFace(u * MW, M) - 0.01, col: jitter(C.mouthInner, 0.08), role: ROLE.mouthInner, a: t * tp, b: tp, c: u, head: 1 });
  }

  // ---- finish: shuffled (so any prefix is an even sample: small screens draw fewer dots), then trimmed or topped up to exactly n
  for (let i = dots.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [dots[i], dots[j]] = [dots[j], dots[i]];
  }
  while (dots.length > n) dots.pop();
  while (dots.length < n) dots.push({ ...dots[Math.floor(rnd() * dots.length)] });
  const pts = new Float32Array(n * 3);
  const cols = new Float32Array(n * 3);
  const rig = new Float32Array(n * 4);
  dots.forEach((d, i) => {
    pts[i * 3] = d.x;
    pts[i * 3 + 1] = d.y;
    pts[i * 3 + 2] = d.z;
    cols[i * 3] = d.col[0];
    cols[i * 3 + 1] = d.col[1];
    cols[i * 3 + 2] = d.col[2];
    rig[i * 4] = d.role + 0.01 + clamp01(d.head) * 0.98; // never 0 for a figure dot, so the shader can tell it from a plain shape
    rig[i * 4 + 1] = d.a;
    rig[i * 4 + 2] = d.b;
    rig[i * 4 + 3] = d.c;
  });
  return { pts, cols, rig };
}
