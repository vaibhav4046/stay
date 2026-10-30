/**
 * True 3D Volumetric Point Cloud Generators for Stay's Neural Orb.
 *
 * Unlike 2D SDF silhouettes projected into a thin pancake, these shapes
 * generate true 3D volumetric coordinates (x, y, z) and rich per-dot RGB
 * color palettes. As the WebGL camera yaws and rotates, the shapes maintain
 * stunning depth, realistic proportions, and dimensional aerodynamics.
 */
import { mulberry32 } from './sdf';

export interface Volumetric3DShape {
  id: string;
  points: Float32Array; // xyz triples (length = 3 * n)
  cols: Float32Array;   // rgb triples (length = 3 * n)
  palette: [string, string];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

/**
 * 3D Volumetric Rocket Spacecraft
 *
 * True 3D geometry:
 * - 3D ogive aerodynamic nosecone
 * - Cylindrical main fuselage with rally stripes
 * - Observation canopy / porthole
 * - 4 swept delta stabilizer fins placed at 90-degree radial angles around the hull
 * - Engine nozzle bell
 * - Incandescent high-energy thrust plume with dynamic flame particles
 */
export function generate3DRocket(n: number, seed = 42): Volumetric3DShape {
  const rnd = mulberry32(seed);
  const pts = new Float32Array(n * 3);
  const cols = new Float32Array(n * 3);

  // Dot budget allocation
  const noseCount = Math.floor(n * 0.18);
  const bodyCount = Math.floor(n * 0.32);
  const canopyCount = Math.floor(n * 0.05);
  const finsCount = Math.floor(n * 0.20);
  const nozzleCount = Math.floor(n * 0.05);
  const flameCount = n - (noseCount + bodyCount + canopyCount + finsCount + nozzleCount);

  let idx = 0;

  const pushPoint = (
    x: number,
    y: number,
    z: number,
    r: number,
    g: number,
    b: number
  ) => {
    if (idx >= n) return;
    pts[idx * 3] = x;
    pts[idx * 3 + 1] = y;
    pts[idx * 3 + 2] = z;
    cols[idx * 3] = r;
    cols[idx * 3 + 1] = g;
    cols[idx * 3 + 2] = b;
    idx++;
  };

  // 1. Nosecone (y: 0.40 -> 0.92)
  for (let i = 0; i < noseCount; i++) {
    const v = rnd(); // 0 (bottom) -> 1 (tip)
    const y = 0.40 + v * 0.52;
    const maxR = 0.26 * (1 - Math.pow(v, 1.3));
    const r = maxR * (0.8 + 0.2 * Math.sqrt(rnd()));
    const theta = rnd() * Math.PI * 2;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);

    // Tip is emergency crimson, lower nose is sleek pearl white
    if (v > 0.75) {
      pushPoint(x, y, z, 0.94, 0.24, 0.24); // #EF4444 crimson tip
    } else {
      pushPoint(x, y, z, 0.97, 0.98, 1.0); // Titanium pearl white
    }
  }

  // 2. Fuselage Cylinder (y: -0.32 -> 0.40)
  for (let i = 0; i < bodyCount; i++) {
    const y = -0.32 + rnd() * 0.72;
    const theta = rnd() * Math.PI * 2;
    // 85% surface shell, 15% inner volume
    const r = 0.26 * (rnd() > 0.15 ? (0.92 + 0.08 * rnd()) : Math.sqrt(rnd()));
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);

    // Vertical racing stripes at theta ~ 0 and theta ~ PI
    const stripeDist = Math.min(
      Math.abs(Math.cos(theta) - 1),
      Math.abs(Math.cos(theta) + 1)
    );
    if (stripeDist < 0.15 && y > -0.25 && y < 0.35) {
      pushPoint(x, y, z, 0.15, 0.39, 0.92); // #2563EB Racing blue
    } else if (Math.abs(y - 0.05) < 0.035) {
      pushPoint(x, y, z, 0.94, 0.24, 0.24); // #EF4444 Accent ring
    } else {
      pushPoint(x, y, z, 0.94, 0.96, 0.98); // Clean hull white
    }
  }

  // 3. Observation Porthole / Canopy (y: 0.18 -> 0.30, z: front)
  for (let i = 0; i < canopyCount; i++) {
    const angle = (rnd() - 0.5) * 0.8; // front quadrant
    const ringY = 0.24 + (rnd() - 0.5) * 0.10;
    const r = 0.265 + rnd() * 0.02;
    const x = r * Math.sin(angle);
    const z = r * Math.cos(angle);
    pushPoint(x, ringY, z, 0.22, 0.74, 0.97); // #38BDF8 Cyan cockpit glass
  }

  // 4. 4 Radial Stabilizer Fins (at 0, 90, 180, 270 degrees in X-Z space)
  for (let i = 0; i < finsCount; i++) {
    const finIndex = Math.floor(rnd() * 4);
    const baseAngle = (finIndex * Math.PI) / 2;
    const finProgress = rnd(); // 0 (top root) -> 1 (bottom tip)
    const y = 0.05 - finProgress * 0.45; // 0.05 down to -0.40
    // Swept delta shape
    const finSpan = 0.26 + finProgress * 0.42; // extends up to 0.68 radius
    const radialDist = 0.26 + rnd() * (finSpan - 0.26);
    const finThickness = (rnd() - 0.5) * 0.035;

    // Rotate into 3D radial fin angle
    const cosA = Math.cos(baseAngle);
    const sinA = Math.sin(baseAngle);
    const x = radialDist * cosA - finThickness * sinA;
    const z = radialDist * sinA + finThickness * cosA;

    // Wingtips get crimson edge
    if (radialDist > 0.52 || y < -0.32) {
      pushPoint(x, y, z, 0.88, 0.11, 0.28); // #E11D48
    } else {
      pushPoint(x, y, z, 0.11, 0.31, 0.85); // #1D4ED8 Aerospace blue
    }
  }

  // 5. Engine Nozzle Bell (y: -0.44 -> -0.32)
  for (let i = 0; i < nozzleCount; i++) {
    const v = rnd(); // 0 (top throat) -> 1 (skirt)
    const y = -0.32 - v * 0.12;
    // Throat chokes to 0.18, skirt flares to 0.24
    const r = (0.18 + v * 0.06) * (0.9 + 0.1 * rnd());
    const theta = rnd() * Math.PI * 2;
    const x = r * Math.cos(theta);
    const z = r * Math.sin(theta);
    pushPoint(x, y, z, 0.28, 0.33, 0.41); // Titanium nozzle bell
  }

  // 6. Volumetric Thrust Flame & Sparks (y: -0.44 down to -1.15)
  for (let i = 0; i < flameCount; i++) {
    const v = Math.pow(rnd(), 1.1); // bias towards engine nozzle
    const y = -0.44 - v * 0.71;
    // Conical turbulent plume
    const maxR = (0.22 * (1 - v * 0.65) + 0.06 * Math.sin(v * 12)) * (0.8 + 0.4 * rnd());
    const theta = rnd() * Math.PI * 2;
    const r = maxR * Math.sqrt(rnd());
    const jitter = (rnd() - 0.5) * 0.04;
    const x = r * Math.cos(theta) + jitter;
    const z = r * Math.sin(theta) + jitter;

    // Incandescent color gradient:
    // Core (near nozzle and center): brilliant white-yellow
    // Mid: orange-red
    // Tip: violet spark
    if (v < 0.28 && r < 0.12) {
      pushPoint(x, y, z, 1.0, 1.0, 0.95); // White-hot core
    } else if (v < 0.55) {
      pushPoint(x, y, z, 0.98, 0.72, 0.12); // #F59E0B Solar amber
    } else if (v < 0.85) {
      pushPoint(x, y, z, 0.94, 0.27, 0.18); // #F97316 Radiant flame
    } else {
      pushPoint(x, y, z, 0.88, 0.12, 0.45); // Plasma magenta spark
    }
  }

  // Fisher-Yates shuffle triples
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    for (let c = 0; c < 3; c++) {
      const tp = pts[i * 3 + c];
      pts[i * 3 + c] = pts[j * 3 + c];
      pts[j * 3 + c] = tp;
      const tc = cols[i * 3 + c];
      cols[i * 3 + c] = cols[j * 3 + c];
      cols[j * 3 + c] = tc;
    }
  }

  return {
    id: 'rocket',
    points: pts,
    cols,
    palette: ['#60A5FA', '#F43F5E'],
  };
}

/**
 * 3D Volumetric Stellated Star
 * Rich multifaceted 3D faceted geometry with golden radiance.
 */
export function generate3DStar(n: number, seed = 7): Volumetric3DShape {
  const rnd = mulberry32(seed);
  const pts = new Float32Array(n * 3);
  const cols = new Float32Array(n * 3);

  for (let i = 0; i < n; i++) {
    const pointIdx = Math.floor(rnd() * 5);
    const starAngle = (pointIdx * 2 * Math.PI) / 5 - Math.PI / 2;
    const nextAngle = starAngle + (2 * Math.PI) / 5;

    const u = rnd();
    const v = rnd();
    // Radial distance from center to star tip
    const r = 0.35 + 0.60 * Math.pow(u, 0.8);
    const theta = starAngle + (rnd() - 0.5) * 0.55;

    // 3D volumetric faceted depth: thick at center (z up to 0.45), tapering to zero at tips
    const maxZ = 0.48 * (1 - (r - 0.35) / 0.60);
    const z = (rnd() * 2 - 1) * Math.max(0.04, maxZ);
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);

    pts[i * 3] = x;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = z;

    // Glowing core to golden tips
    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist < 0.28) {
      cols[i * 3] = 1.0;
      cols[i * 3 + 1] = 0.95;
      cols[i * 3 + 2] = 0.70;
    } else {
      cols[i * 3] = 1.0;
      cols[i * 3 + 1] = 0.65 - dist * 0.15;
      cols[i * 3 + 2] = 0.05;
    }
  }

  return {
    id: 'star',
    points: pts,
    cols,
    palette: ['#FFD23F', '#FF8A00'],
  };
}

/**
 * 3D Volumetric Sculpted Heart
 * True 3D cardioid manifold with plump lobes and deep red-rose gradient.
 */
export function generate3DHeart(n: number, seed = 13): Volumetric3DShape {
  const rnd = mulberry32(seed);
  const pts = new Float32Array(n * 3);
  const cols = new Float32Array(n * 3);

  let k = 0;
  let guard = 0;

  while (k < n && guard++ < n * 50) {
    // Rejection sample 3D heart equation:
    // (x^2 + 9/4 y^2 + z^2 - 1)^3 - x^2 z^3 - 9/80 y^2 z^3 <= 0
    // In our coordinate space: Y is up, X is lateral, Z is depth.
    const x = (rnd() * 2 - 1) * 1.25;
    const y = (rnd() * 2 - 1) * 1.15 + 0.1;
    const z = (rnd() * 2 - 1) * 0.75;

    // Scale so heart fits nicely in 0.9 radius
    const sx = x * 1.1;
    const sy = y * 1.1;
    const sz = z * 1.6;

    const term1 = sx * sx + 2.25 * sz * sz + sy * sy - 1;
    const f = term1 * term1 * term1 - sx * sx * sy * sy * sy - 0.11 * sz * sz * sy * sy * sy;

    if (f <= 0) {
      pts[k * 3] = x * 0.72;
      pts[k * 3 + 1] = y * 0.72;
      pts[k * 3 + 2] = z * 0.72;

      // Color: rich velvety crimson with soft rose highlights
      const depthVal = Math.abs(z);
      cols[k * 3] = 0.95 + 0.05 * rnd();
      cols[k * 3 + 1] = 0.15 + 0.25 * (1 - depthVal);
      cols[k * 3 + 2] = 0.35 + 0.25 * (1 - depthVal);
      k++;
    }
  }

  // Top up any shortfall
  for (let i = k; i < n; i++) {
    const s = Math.floor(rnd() * Math.max(1, k));
    pts[i * 3] = pts[s * 3] + (rnd() - 0.5) * 0.02;
    pts[i * 3 + 1] = pts[s * 3 + 1] + (rnd() - 0.5) * 0.02;
    pts[i * 3 + 2] = pts[s * 3 + 2] + (rnd() - 0.5) * 0.02;
    cols[i * 3] = cols[s * 3];
    cols[i * 3 + 1] = cols[s * 3 + 1];
    cols[i * 3 + 2] = cols[s * 3 + 2];
  }

  return {
    id: 'heart',
    points: pts,
    cols,
    palette: ['#FF6B95', '#E11D48'],
  };
}

/** Check if an id has a dedicated true-3D volumetric generator */
export function getVolumetric3DShape(id: string, n: number): Volumetric3DShape | null {
  const norm = id.toLowerCase().trim();
  if (norm === 'rocket' || norm === 'space' || norm === 'launch' || norm === 'spaceship') {
    return generate3DRocket(n);
  }
  if (norm === 'star' || norm === 'stars' || norm === 'shine') {
    return generate3DStar(n);
  }
  if (norm === 'heart' || norm === 'love') {
    return generate3DHeart(n);
  }
  return null;
}
