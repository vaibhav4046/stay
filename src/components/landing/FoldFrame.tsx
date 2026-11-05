import type { CSSProperties } from 'react';
import { BEZEL, DEPTH, FOLD, R_IN, R_OUT, SPINE, barrelFacets, edgeFacets, sizeOf, type Half, type Orient, type Role } from './foldGeometry';

/**
 * The art of the book-style foldable in the hero (decorative: aria-hidden, no text). Original drawing; no real product's logo, name or marks.
 * One continuous inner display, two halves that meet at the spine (a, b), a thin metal frame, a hinge barrel along the spine.
 * Every colour is a class or a custom property here and a token in fold.css: no literal colour in this file.
 */
const vars = (v: Record<string, number>) => v as unknown as CSSProperties;

/** The numbers CSS needs, as custom properties on the device root (one source of truth with the art). */
export function foldVars(): CSSProperties {
  const out: Record<string, number> = { '--depth': DEPTH, '--spine': SPINE, '--bezel': BEZEL, '--r-out': R_OUT, '--r-in': R_IN, '--r-screen': R_OUT - BEZEL };
  (Object.keys(FOLD) as Orient[]).forEach((o) => {
    const { a, b } = FOLD[o];
    const { w, h } = sizeOf(o);
    Object.assign(out, {
      [`--${o}-hw`]: a.w,
      [`--${o}-hh`]: a.h,
      [`--${o}-sxa`]: a.sx,
      [`--${o}-sxb`]: b.sx,
      [`--${o}-sya`]: a.sy,
      [`--${o}-syb`]: b.sy,
      [`--${o}-sw`]: a.sw,
      [`--${o}-sh`]: a.sh,
      [`--${o}-tw`]: w,
      [`--${o}-th`]: h,
    });
  });
  return vars(out);
}

/** A rounded rectangle with a radius per corner, drawn inside its box by `inset` so a stroke is not clipped. */
function outline({ w, h, r }: Pick<Half, 'w' | 'h' | 'r'>, inset: number) {
  const [tl, tr, br, bl] = r.map((v) => Math.max(0, v - inset));
  const x1 = w - inset;
  const y1 = h - inset;
  return `M${inset + tl} ${inset}H${x1 - tr}A${tr} ${tr} 0 0 1 ${x1} ${inset + tr}V${y1 - br}A${br} ${br} 0 0 1 ${x1 - br} ${y1}H${inset + bl}A${bl} ${bl} 0 0 1 ${inset} ${y1 - bl}V${inset + tl}A${tl} ${tl} 0 0 1 ${inset + tl} ${inset}Z`;
}

function Body({ role, orient }: { role: Role; orient: Orient }) {
  const half = FOLD[orient][role];
  const id = `fd-${role}-${orient}`;
  const screen = { w: half.sw, h: half.sh, r: half.rs };
  return (
    <svg className="fd-svg" viewBox={`0 0 ${half.w} ${half.h}`} preserveAspectRatio="none" focusable="false" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={`fd-body-${role}-0`} />
          <stop offset="1" className="fd-body-1" />
        </linearGradient>
      </defs>
      <path d={outline(half, 0)} fill={`url(#${id}-body)`} />
      <path d={outline(half, 3.5)} className="fd-chamfer" fill="none" strokeWidth="1" />
      <path d={outline(screen, 0)} transform={`translate(${half.sx} ${half.sy})`} className="fd-well" strokeWidth="3" />
    </svg>
  );
}

/** Both orientations are drawn; CSS shows the one that fits (spine vertical from 640px, horizontal below). */
export function FoldBody({ role }: { role: Role }) {
  return (
    <>
      <span className="fd-art fd-only-wide"><Body role={role} orient="wide" /></span>
      <span className="fd-art fd-only-tall"><Body role={role} orient="tall" /></span>
    </>
  );
}

/** The edge of a half as a ring of strips standing on its outline: the thickness of the metal frame. */
export function FoldEdges({ role }: { role: Role }) {
  return (
    <>
      {(['wide', 'tall'] as Orient[]).map((o) => {
        const half = FOLD[o][role];
        const { w, h } = sizeOf(o);
        const off = role === 'b' ? (o === 'wide' ? half.w : half.h) : 0; // where this half starts along the device, for the colour that runs across it
        return (
          <span key={o} className={`fd-edges fd-only-${o}`}>
            {edgeFacets(half).map((f, i) => {
              const tint = o === 'wide' ? (f.x + off) / w : (f.y + off) / h;
              return <i key={i} className="fd-facet" style={vars({ '--x': f.x, '--y': f.y, '--a': f.angle, '--len': f.len, '--shade': +f.shade.toFixed(3), '--tint': +tint.toFixed(3) })} />;
            })}
          </span>
        );
      })}
    </>
  );
}

/** The hinge: a barrel of strips along the spine. Hidden behind the display when open; the thin metal spine when it is folded. */
export function FoldSpine() {
  return (
    <div className="fd-spine" aria-hidden="true">
      {barrelFacets().map((f) => (
        <i key={f.angle} className={`fd-barrel${f.spec ? ' fd-barrel-spec' : ''}`} style={vars({ '--p': f.angle, '--bw': +f.width.toFixed(2), '--shade': +f.shade.toFixed(3) })} />
      ))}
      <i className="fd-spine-glow" />
    </div>
  );
}
