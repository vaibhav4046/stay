/**
 * Point clouds for the orb. A cloud is positions + per-dot colours, so an emoji's own colours survive as dots
 * (a zebra gathers as black and white dots). The glyph is only a *source* of positions: nothing but dots is ever drawn.
 */
import { mulberry32 } from './sdf';

export interface PointCloud {
  pts: Float32Array;
  cols: Float32Array;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
}

/** Vertical two-colour gradient (top = a, bottom = b) with a touch of per-dot variation. */
export function colorize(pts: Float32Array, palette: [string, string], seed = 3): Float32Array {
  const a = hexToRgb(palette[0]);
  const b = hexToRgb(palette[1]);
  const n = pts.length / 3;
  const out = new Float32Array(n * 3);
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, (pts[i * 3 + 1] + 1) / 2 + (rnd() - 0.5) * 0.18));
    for (let c = 0; c < 3; c++) out[i * 3 + c] = b[c] + (a[c] - b[c]) * t;
  }
  return out;
}

/** Keep glyph colours readable on a pale page: never blown-out white, never dead black. */
function readable(r: number, g: number, b: number): [number, number, number] {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  if (luma > 0.82) {
    const k = 0.82 / luma;
    return [r * k, g * k * 0.99, Math.min(1, b * k * 1.02)];
  }
  if (luma < 0.14) return [r * 0.5 + 0.1, g * 0.5 + 0.1, b * 0.5 + 0.12];
  return [r, g, b];
}

const SIZE = 192;
const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif';

/** Rasterises an emoji off-screen and returns n dots (28% crisp contour, rest interior) in its own colours. */
export function emojiCloud(emoji: string, n: number, seed = 1): PointCloud | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.font = `${Math.round(SIZE * 0.78)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, SIZE / 2, SIZE / 2 + SIZE * 0.05);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const inside = new Uint8Array(SIZE * SIZE);
  let minX = SIZE, maxX = 0, minY = SIZE, maxY = 0, area = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (data[(y * SIZE + x) * 4 + 3] > 140) {
        inside[y * SIZE + x] = 1;
        area++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (area < 500) return null; // glyph missing from the font (tofu) or blank

  // chamfer distance to the outside, for the lens-like thickness
  const dist = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < dist.length; i++) dist[i] = inside[i] ? 1e4 : 0;
  for (let y = 1; y < SIZE; y++) {
    for (let x = 1; x < SIZE - 1; x++) {
      const i = y * SIZE + x;
      if (dist[i]) dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - SIZE] + 1, dist[i - SIZE - 1] + 1.41, dist[i - SIZE + 1] + 1.41);
    }
  }
  for (let y = SIZE - 2; y >= 0; y--) {
    for (let x = SIZE - 2; x >= 1; x--) {
      const i = y * SIZE + x;
      if (dist[i]) dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + SIZE] + 1, dist[i + SIZE + 1] + 1.41, dist[i + SIZE - 1] + 1.41);
    }
  }

  const edge: number[] = [];
  const inner: number[] = [];
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    (dist[i] <= 1.5 ? edge : inner).push(i);
  }
  if (inner.length < 50) return null;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY) / 2 || 1;
  const scale = 0.92 / half;
  const rnd = mulberry32(seed);
  const pts = new Float32Array(n * 3);
  const cols = new Float32Array(n * 3);
  const edgeCount = edge.length ? Math.floor(n * 0.28) : 0;
  for (let k = 0; k < n; k++) {
    const pool = k < edgeCount ? edge : inner;
    const i = pool[Math.floor(rnd() * pool.length)];
    const px = (i % SIZE) + rnd() - 0.5;
    const py = Math.floor(i / SIZE) + rnd() - 0.5;
    const depth = Math.sqrt(Math.min(1, dist[i] / (half * 0.35)));
    pts[k * 3] = (px - cx) * scale;
    pts[k * 3 + 1] = -(py - cy) * scale;
    pts[k * 3 + 2] = (rnd() * 2 - 1) * 0.18 * depth;
    const [r, g, b] = readable(data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255);
    cols[k * 3] = r;
    cols[k * 3 + 1] = g;
    cols[k * 3 + 2] = b;
  }
  // shuffle so any prefix is an even sample (small orbs draw fewer dots)
  for (let k = n - 1; k > 0; k--) {
    const j = Math.floor(rnd() * (k + 1));
    for (let c = 0; c < 3; c++) {
      let t = pts[k * 3 + c];
      pts[k * 3 + c] = pts[j * 3 + c];
      pts[j * 3 + c] = t;
      t = cols[k * 3 + c];
      cols[k * 3 + c] = cols[j * 3 + c];
      cols[j * 3 + c] = t;
    }
  }
  return { pts, cols };
}

/** True for a single emoji (one pictographic grapheme), so model output can be trusted before it is drawn. */
export function isSingleEmoji(s: string): boolean {
  const t = (s || '').trim();
  if (!t || t.length > 16) return false;
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t));
    if (seg.length !== 1) return false;
  }
  return /\p{Extended_Pictographic}/u.test(t);
}
