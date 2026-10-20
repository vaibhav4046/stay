/* Procedural Stay app icons: a Fibonacci-lattice dot sphere (the Stay orb), rasterised with plain arrays and encoded by hand.
 * No image libraries, no external assets: PNG (zlib), ICO and ICNS (both just wrap PNG frames). */
import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';

const tokens = JSON.parse(readFileSync(new URL('./tokens.json', import.meta.url), 'utf8'));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lerp = (a, b, t) => a + (b - a) * t;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/**
 * @param {number} size output edge in px
 * @param {{bg?: string|null, radius?: number, corner?: number, mono?: number[]|null, from?: string, to?: string, tilt?: number}} o
 *   bg: fill colour (null = transparent); radius: orb radius as a fraction of size; corner: rounded-corner fraction of size
 *   (0 = square, used for maskable and full-bleed); mono: [r,g,b] draws every dot in one colour (tray template).
 * @returns {{width:number,height:number,data:Uint8Array}} straight-alpha RGBA
 */
export function renderOrb(size, o = {}) {
  const { bg = tokens.color.canvas, radius = 0.36, corner = 0.2, mono = null, tilt = 0.38 } = o;
  const from = hex(o.from || tokens.orb.from);
  const to = hex(o.to || tokens.orb.to);
  const px = new Float32Array(size * size * 4); // premultiplied

  if (bg) {
    const [r, g, b] = hex(bg);
    const cr = corner * size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let a = 1;
        if (cr > 0) {
          const dx = Math.max(cr - (x + 0.5), 0, x + 0.5 - (size - cr));
          const dy = Math.max(cr - (y + 0.5), 0, y + 0.5 - (size - cr));
          a = Math.min(1, Math.max(0, cr + 0.5 - Math.hypot(dx, dy)));
        }
        const i = (y * size + x) * 4;
        px[i] = (r / 255) * a;
        px[i + 1] = (g / 255) * a;
        px[i + 2] = (b / 255) * a;
        px[i + 3] = a;
      }
    }
  }

  const R = radius * size;
  const cx = size / 2;
  const cy = size / 2;
  const n = Math.round(Math.min(3400, Math.max(90, 3400 * (size / 512) ** 1.7)));
  const spacing = Math.sqrt((Math.PI * R * R) / (n / 2));
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const dots = [];
  for (let i = 0; i < n; i++) {
    const y0 = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y0 * y0);
    const phi = i * GOLDEN;
    const x0 = Math.cos(phi) * rr;
    const z0 = Math.sin(phi) * rr;
    const y = y0 * ct - z0 * st; // tip the pole toward the viewer
    const z = y0 * st + z0 * ct;
    if (z > 0) dots.push({ x: x0, y, z });
  }
  dots.sort((a, b) => a.z - b.z); // far to near
  for (const d of dots) {
    const sx = cx + d.x * R;
    const sy = cy - d.y * R;
    const rad = Math.max(0.55, spacing * 0.4 * (0.4 + 0.6 * d.z));
    const alpha = 0.5 + 0.5 * d.z;
    const t = (1 - d.y) / 2; // teal on top, blue below
    const c = mono ? mono : [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
    const x0 = Math.max(0, Math.floor(sx - rad - 1));
    const x1 = Math.min(size - 1, Math.ceil(sx + rad + 1));
    const y0 = Math.max(0, Math.floor(sy - rad - 1));
    const y1 = Math.min(size - 1, Math.ceil(sy + rad + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const cov = Math.min(1, Math.max(0, rad + 0.5 - Math.hypot(x + 0.5 - sx, y + 0.5 - sy))) * alpha;
        if (cov <= 0) continue;
        const i = (y * size + x) * 4;
        const inv = 1 - cov;
        px[i] = (c[0] / 255) * cov + px[i] * inv;
        px[i + 1] = (c[1] / 255) * cov + px[i + 1] * inv;
        px[i + 2] = (c[2] / 255) * cov + px[i + 2] * inv;
        px[i + 3] = cov + px[i + 3] * inv;
      }
    }
  }

  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const a = px[i * 4 + 3];
    data[i * 4 + 3] = Math.round(a * 255);
    if (a > 0) for (let k = 0; k < 3; k++) data[i * 4 + k] = Math.round(Math.min(1, px[i * 4 + k] / a) * 255);
  }
  return { width: size, height: size, data };
}

/** Rescales an RGBA image by a rational box filter (used to place the orb on a larger transparent canvas). */
export function padTo(img, size, scale) {
  const out = new Uint8Array(size * size * 4);
  const inner = Math.round(size * scale);
  const off = Math.floor((size - inner) / 2);
  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      const sx = Math.min(img.width - 1, Math.floor((x * img.width) / inner));
      const sy = Math.min(img.height - 1, Math.floor((y * img.height) / inner));
      const si = (sy * img.width + sx) * 4;
      const di = ((y + off) * size + x + off) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = img.data[si + 3];
    }
  }
  return { width: size, height: size, data: out };
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

export function encodePNG({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Windows .ico holding PNG frames (supported since Vista). 256 is stored as 0 in the directory. */
export function encodeICO(frames) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(frames.length, 4);
  const dir = Buffer.alloc(16 * frames.length);
  let offset = 6 + dir.length;
  frames.forEach((f, i) => {
    const b = i * 16;
    dir[b] = f.size >= 256 ? 0 : f.size;
    dir[b + 1] = f.size >= 256 ? 0 : f.size;
    dir.writeUInt16LE(1, b + 4);
    dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(f.png.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += f.png.length;
  });
  return Buffer.concat([head, dir, ...frames.map((f) => f.png)]);
}

/** macOS .icns with PNG payloads (ic07 128, ic08 256, ic09 512, ic10 1024). */
export function encodeICNS(frames) {
  const type = { 128: 'ic07', 256: 'ic08', 512: 'ic09', 1024: 'ic10' };
  const parts = frames
    .filter((f) => type[f.size])
    .map((f) => {
      const h = Buffer.alloc(8);
      h.write(type[f.size], 0, 'ascii');
      h.writeUInt32BE(f.png.length + 8, 4);
      return Buffer.concat([h, f.png]);
    });
  const total = 8 + parts.reduce((n, p) => n + p.length, 0);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(total, 4);
  return Buffer.concat([head, ...parts]);
}
