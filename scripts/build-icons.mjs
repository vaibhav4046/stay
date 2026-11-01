#!/usr/bin/env node
/**
 * Draws the Stay mark (the resting orb: a sphere of dots, light at the top, deep blue at the bottom) and renders every
 * icon the site needs as PNG, plus favicon.ico (PNGs inside) and the transparent SVG used in the header.
 *   node scripts/build-icons.mjs
 * Output: public/brand/stay-mark.svg, public/icons/*.png, public/favicon.ico
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const LIGHT = [217, 238, 255]; // #D9EEFF glow ring
const BLUE = [57, 124, 232]; // #397CE8 blue core
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Fibonacci sphere of dots, shaded by depth and by height. `n` dots; `scale` multiplies the dot radius. */
function sphereDots(cx, cy, R, n, scale) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const th = i * golden;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r; // -1 back, 1 front
    const shade = 0.3 + 0.7 * ((z + 1) / 2);
    const tHeight = (1 - y) / 2; // 0 at the top, 1 at the bottom
    const color = mix(LIGHT, BLUE, Math.pow(tHeight, 0.85));
    out.push({ z, x: cx + x * R, y: cy - y * R, rad: (R / 28) * scale * (0.55 + 0.6 * shade), color, op: 0.3 + 0.7 * shade });
  }
  return out.sort((a, b) => a.z - b.z).map((d) => `<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="${d.rad.toFixed(2)}" fill="${hex(d.color)}" fill-opacity="${d.op.toFixed(2)}"/>`).join('');
}

/** kind: 'tile' (rounded dark square), 'square' (full-bleed, for apple/maskable), 'bare' (transparent, sphere only), 'mono' (white, transparent) */
function markSvg({ size = 512, kind = 'tile', dots = 340, sphere = 0.36, dotScale = 1 }) {
  const c = size / 2;
  const R = size * sphere;
  let body = '';
  if (kind === 'tile' || kind === 'square') {
    const rx = kind === 'tile' ? size * 0.22 : 0;
    body += `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16181C"/><stop offset="1" stop-color="#08090B"/></linearGradient>` +
      `<radialGradient id="glow" cx="50%" cy="46%" r="52%"><stop offset="0" stop-color="#397CE8" stop-opacity="0.38"/><stop offset="1" stop-color="#397CE8" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/><rect width="${size}" height="${size}" rx="${rx}" fill="url(#glow)"/>` +
      (kind === 'tile' ? `<rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="${rx}" fill="none" stroke="#ffffff" stroke-opacity="0.09"/>` : '');
  }
  if (kind === 'mono') {
    const d = sphereDots(c, c, R, dots, dotScale).replace(/fill="#[0-9a-f]{6}"/g, 'fill="#ffffff"');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${d}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}${sphereDots(c, c, R, dots, dotScale)}</svg>`;
}

async function png(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
}

mkdirSync('public/brand', { recursive: true });
mkdirSync('public/icons', { recursive: true });

// the header logo: transparent, sphere only, crisp at any size
writeFileSync('public/brand/stay-mark.svg', markSvg({ size: 128, kind: 'bare', dots: 220, sphere: 0.46 }));
writeFileSync('public/brand/stay-icon.svg', markSvg({ size: 512, kind: 'tile', dots: 340 }));

const big = markSvg({ size: 512, kind: 'tile', dots: 340 });
await png(big, 512, 'public/icons/icon-512.png');
await png(markSvg({ size: 512, kind: 'tile', dots: 340 }), 192, 'public/icons/icon-192.png');
// iOS draws its own rounded corners: full-bleed square
await png(markSvg({ size: 512, kind: 'square', dots: 340, sphere: 0.33 }), 180, 'public/icons/icon-180.png');
// maskable: the important part inside the central 80% safe zone
await png(markSvg({ size: 512, kind: 'square', dots: 340, sphere: 0.28 }), 512, 'public/icons/icon-maskable-512.png');
await png(markSvg({ size: 512, kind: 'square', dots: 340, sphere: 0.28 }), 192, 'public/icons/icon-maskable-192.png');
await png(markSvg({ size: 512, kind: 'mono', dots: 300, sphere: 0.4 }), 512, 'public/icons/icon-mono-512.png');

// favicons: fewer, bigger dots so the sphere still reads at 16 px
const small = (px, dots, scale) => markSvg({ size: 256, kind: 'tile', dots, sphere: 0.4, dotScale: scale });
await png(small(16, 46, 2.3), 16, 'public/icons/favicon-16.png');
await png(small(32, 90, 1.8), 32, 'public/icons/favicon-32.png');
await png(small(48, 150, 1.5), 48, 'public/icons/favicon-48.png');

// favicon.ico with PNG images inside (what every browser asks for first)
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map((s) => sharp(`public/icons/favicon-${s}.png`).png().toBuffer()));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = pngs.map((buf, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 0);
  e.writeUInt8(sizes[i] === 256 ? 0 : sizes[i], 1);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += buf.length;
  return e;
});
writeFileSync('public/favicon.ico', Buffer.concat([header, ...entries, ...pngs]));
console.log('icons written: svg mark, png 16/32/48/180/192/512, maskable, mono, favicon.ico');
