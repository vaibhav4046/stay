/**
 * The shape of the hero's foldable, in design pixels (CSS scales them with --u, see fold.css). Pure numbers, so it can be tested.
 * A book-style fold: ONE continuous inner display, cut for the story into two halves (a, b) that meet at the spine, with the same thin
 * bezel on every outer side and none at the spine, large outer corners, and a barrel hinge along the spine.
 * Wide is the book orientation (spine vertical); tall is the stacked orientation used on a phone (spine horizontal).
 * Each half is a slab: a flat front, a back, and a ring of thin strips (facets) standing on its outline, so the edge is a real extrusion
 * with rounded corners, not a drawn line.
 */
export type Orient = 'wide' | 'tall';
export type Role = 'a' | 'b';
type Radii = [number, number, number, number]; // top-left, top-right, bottom-right, bottom-left
export type Half = { w: number; h: number; sx: number; sy: number; sw: number; sh: number; r: Radii; rs: Radii };

export const DEPTH = 12; // thickness of a half
export const SPINE = DEPTH / 2 - 0.5; // radius of the hinge barrel: a hair inside the faces, so it never fights them
export const BEZEL = 8; // the same on every outer side: ultra thin
export const R_OUT = 36; // the large outer corner
export const R_IN = 2; // the corners that meet at the spine: nearly square, the display runs on across it
const R_SCREEN = R_OUT - BEZEL; // the display's corner follows the frame's

/** `from`: which sides of the half have a bezel (the side at the spine has none). */
const slab = (sw: number, sh: number, bezel: { t: number; r: number; b: number; l: number }, r: Radii): Half => ({
  w: bezel.l + sw + bezel.r,
  h: bezel.t + sh + bezel.b,
  sx: bezel.l,
  sy: bezel.t,
  sw,
  sh,
  r,
  rs: r.map((v) => (v > R_IN ? R_SCREEN : 0)) as Radii,
});

const B = BEZEL;
export const FOLD: Record<Orient, { a: Half; b: Half }> = {
  wide: {
    a: slab(316, 420, { t: B, r: 0, b: B, l: B }, [R_OUT, R_IN, R_IN, R_OUT]),
    b: slab(316, 420, { t: B, r: B, b: B, l: 0 }, [R_IN, R_OUT, R_OUT, R_IN]),
  },
  tall: {
    a: slab(326, 360, { t: B, r: B, b: 0, l: B }, [R_OUT, R_OUT, R_IN, R_IN]),
    b: slab(326, 360, { t: 0, r: B, b: B, l: B }, [R_IN, R_IN, R_OUT, R_OUT]),
  },
};

/** Total size of the device in each orientation (the halves meet, there is no gap). */
export const sizeOf = (o: Orient) => {
  const { a, b } = FOLD[o];
  return o === 'wide' ? { w: a.w + b.w, h: a.h } : { w: a.w, h: a.h + b.h };
};

export type Facet = { x: number; y: number; angle: number; len: number; shade: number };

const LIGHT = 315; // light from the upper right (the edges you can see at rest are the top and the right): the direction (degrees, y down) a strip faces to be fully lit
const shade = (angle: number) => 0.5 + 0.5 * Math.cos(((angle - LIGHT) * Math.PI) / 180);

/**
 * The outline of a half as flat strips standing on it. x, y: the middle of the strip on the outline; angle: the direction it faces
 * (0 = right, 90 = down); len: its length along the outline. A rounded corner is a few strips along the arc.
 */
export function edgeFacets({ w, h, r }: Pick<Half, 'w' | 'h' | 'r'>): Facet[] {
  const [tl, tr, br, bl] = r;
  const out: Facet[] = [];
  const side = (x: number, y: number, angle: number, len: number) => {
    if (len > 0.5) out.push({ x, y, angle, len, shade: shade(angle) });
  };
  side((tl + w - tr) / 2, 0, 270, w - tl - tr);
  side(w, (tr + h - br) / 2, 0, h - tr - br);
  side((bl + w - br) / 2, h, 90, w - bl - br);
  side(0, (tl + h - bl) / 2, 180, h - tl - bl);
  const corner = (cx: number, cy: number, radius: number, from: number) => {
    if (radius < 0.5) return;
    const n = Math.max(1, Math.round(radius / 5.5));
    const step = 90 / n;
    for (let k = 0; k < n; k++) {
      const a = from + (k + 0.5) * step;
      const rad = (a * Math.PI) / 180;
      side(cx + radius * Math.cos(rad), cy + radius * Math.sin(rad), a, 2 * radius * Math.sin((step * Math.PI) / 360) + 0.6);
    }
  };
  corner(tl, tl, tl, 180);
  corner(w - tr, tr, tr, 270);
  corner(w - br, h - br, br, 0);
  corner(bl, h - bl, bl, 90);
  return out;
}

export type Barrel = { angle: number; width: number; shade: number; spec: boolean };

const BARREL_STEP = 24;
const BARREL_LIGHT = -35; // the barrel is lit from the upper left, a little in front

/** The hinge barrel along the spine: strips around the axis, the ones that can face the viewer (a half turn, a little more). */
export function barrelFacets(): Barrel[] {
  const width = 2 * SPINE * Math.sin((BARREL_STEP * Math.PI) / 360) + 0.5;
  return [-3, -2, -1, 0, 1, 2, 3].map((k) => {
    const angle = k * BARREL_STEP;
    return { angle, width, shade: 0.5 + 0.5 * Math.cos(((angle - BARREL_LIGHT) * Math.PI) / 180), spec: Math.abs(angle - BARREL_LIGHT) < BARREL_STEP / 2 + 1 };
  });
}
