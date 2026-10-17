'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioSpectrumBands, VoiceVisualState } from '@/types/domain';

const SignalScene = dynamic(() => import('./SignalScene'), {
  ssr: false,
});

export const STATE_LABELS: Record<VoiceVisualState, string> = {
  idle: 'Ready when you are',
  connecting: 'Connecting voice session',
  listening: 'Listening to your voice',
  thinking: 'Synthesizing strategy',
  speaking: 'Speaking',
  interrupted: 'Listening (interrupted)',
  backchannel: 'Listening closely',
  saving: 'Saving progress',
  complete: 'Focus block logged',
  error: 'Voice unavailable',
};

const FALLBACK_COLOR: Record<VoiceVisualState, { primary: string; secondary: string; glow: string }> = {
  idle: { primary: '#006A67', secondary: '#003D3B', glow: '#5EEAD4' },
  connecting: { primary: '#475569', secondary: '#1E293B', glow: '#94A3B8' },
  listening: { primary: '#0284C7', secondary: '#0C4A6E', glow: '#38BDF8' },
  thinking: { primary: '#6D28D9', secondary: '#2E1065', glow: '#C4B5FD' },
  speaking: { primary: '#059669', secondary: '#064E3B', glow: '#6EE7B7' },
  interrupted: { primary: '#D97706', secondary: '#78350F', glow: '#FDE68A' },
  backchannel: { primary: '#0D9488', secondary: '#134E4A', glow: '#5EEAD4' },
  saving: { primary: '#4F46E5', secondary: '#1E1B4B', glow: '#A5B4FC' },
  complete: { primary: '#16A34A', secondary: '#14532D', glow: '#86EFAC' },
  error: { primary: '#DC2626', secondary: '#7F1D1D', glow: '#FCA5A5' },
};

export const SHAPE_PALETTES: Record<number, { primary: string; secondary: string; glow: string; accent: string }> = {
  0: { primary: '#006A67', secondary: '#003634', glow: '#5EEAD4', accent: '#E0F2FE' },
  1: { primary: '#E11D48', secondary: '#881337', glow: '#FDA4AF', accent: '#FBBF24' }, // Ice Cream Cone & Swirl
  2: { primary: '#0071E3', secondary: '#1E3A8A', glow: '#7DD3FC', accent: '#E0F2FE' }, // Crystalline Letterform Gem
  3: { primary: '#7C3AED', secondary: '#3B0764', glow: '#E879F9', accent: '#F5D0FE' }, // Creative Harmonic Rose
  4: { primary: '#0D9488', secondary: '#115E59', glow: '#5EEAD4', accent: '#FDE68A' }, // 8-Petal Botanical Lotus
  5: { primary: '#10B981', secondary: '#1E1B4B', glow: '#38BDF8', accent: '#F59E0B' }, // ADHD Cognitive Game Arena
  6: { primary: '#0284C7', secondary: '#0C4A6E', glow: '#67E8F9', accent: '#E0F2FE' }, // Knowledge & Research Globe
  7: { primary: '#D97706', secondary: '#451A03', glow: '#FDE68A', accent: '#FEF3C7' }, // Focus Hourglass Vortex
};

export const COLOR_THEME_PALETTES: Record<string, { primary: string; secondary: string; glow: string; accent: string }> = {
  aurora: { primary: '#7C3AED', secondary: '#1E1B4B', glow: '#5EEAD4', accent: '#F0ABFC' },
  sunset: { primary: '#EA580C', secondary: '#7C2D12', glow: '#FDA4AF', accent: '#FDE68A' },
  ocean: { primary: '#0284C7', secondary: '#082F49', glow: '#67E8F9', accent: '#E0F2FE' },
  cyber: { primary: '#DB2777', secondary: '#3B0764', glow: '#38BDF8', accent: '#F472B6' },
  emerald: { primary: '#059669', secondary: '#064E3B', glow: '#6EE7B7', accent: '#A7F3D0' },
};

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/**
 * Evaluates exact 2D polar/parametric coordinates (cx=60, cy=60) for angle theta in [0, 2*PI)
 * for each of the 8 morphologies so vertex-to-vertex spring interpolation is 100% smooth and artifact-free.
 * Note: theta = -PI/2 is top (12 o'clock), theta = PI/2 is bottom (6 o'clock).
 */
export function evaluateParametricShapePoint(
  shape: number,
  theta: number,
  time: number,
  energy: number,
  layerScale = 1.0
): [number, number] {
  const cx = 60;
  const cy = 60;
  const breath = Math.sin(time * 1.6) * 0.8 + energy * 3.2;

  if (shape === 1) {
    // Mode 1: Sculpted Ice Cream Cone & Triple Soft-Serve Scoop
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    if (sinT > 0.12) {
      const tCone = Math.min(1, Math.max(0, (sinT - 0.12) / 0.88));
      const halfWidth = 28 * (1 - tCone * 0.92) * layerScale;
      const x = cx + Math.sign(cosT) * Math.pow(Math.abs(cosT), 0.75) * halfWidth;
      const y = cy + (8 + tCone * 38) * layerScale + breath * 0.25;
      return [x, y];
    } else {
      const cheekScallop = 4.2 * Math.pow(Math.abs(cosT), 1.8) * Math.exp(-Math.pow(sinT + 0.05, 2) * 18);
      const topCrown = 3.5 * Math.exp(-Math.pow(cosT, 2) * 12) * (sinT < -0.5 ? 1 : 0);
      const swirlWave = Math.sin(theta * 6 + time * 2.2) * (0.6 + energy * 1.2);
      const r = (34 + cheekScallop + topCrown + swirlWave + breath * 0.4) * layerScale;
      const x = cx + cosT * r;
      const y = cy - 4 * layerScale + sinT * r * 0.95;
      return [x, y];
    }
  }

  if (shape === 2) {
    // Mode 2: Precision Chamfered Octagonal Crystalline Gem
    const n = 8;
    const sector = (2 * Math.PI) / n;
    const modTheta = ((theta % sector) + sector) % sector;
    const polyFactor = Math.cos(sector / 2) / Math.cos(modTheta - sector / 2);
    const r = (38.5 * polyFactor + breath * 0.35) * layerScale;
    const x = cx + Math.cos(theta) * r * 0.96;
    const y = cy + Math.sin(theta) * r * 1.04;
    return [x, y];
  }

  if (shape === 3) {
    // Mode 3: 5-Fold Harmonic Rose / Apple Silk Star Sculpture
    const lobes = 5;
    const rose = 0.5 + 0.5 * Math.cos(lobes * (theta + Math.PI / 2) - time * 0.45);
    const smoothStar = Math.pow(rose, 0.72);
    const harmonic = Math.sin(theta * 10 + time * 1.8) * (0.8 + energy * 1.5);
    const r = (29 + 14.5 * smoothStar + harmonic + breath * 0.5) * layerScale;
    return [cx + Math.cos(theta) * r, cy + Math.sin(theta) * r];
  }

  if (shape === 4) {
    // Mode 4: Sacred 8-Petal Botanical Lotus Blossom
    const petals = 8;
    const petalWave = Math.abs(Math.cos((petals / 2) * theta + time * 0.25));
    const pointedArch = Math.pow(petalWave, 0.58);
    const calmBreath = Math.sin(time * 1.1) * 1.2;
    const r = (30 + 13.5 * pointedArch + calmBreath + energy * 2.5) * layerScale;
    return [cx + Math.cos(theta) * r, cy + Math.sin(theta) * r];
  }

  if (shape === 5) {
    // Mode 5: Interactive 4-Quadrant Harmonic Game Arena Pad (Rounded Squircle with 4 Harmonic Lobes)
    const quadWave = Math.cos(4 * theta);
    const pulse = Math.sin(4 * theta - time * 3.0) * (1.2 + energy * 2.5);
    const r = (39.5 + 4.2 * quadWave + pulse + breath * 0.4) * layerScale;
    return [cx + Math.cos(theta) * r, cy + Math.sin(theta) * r];
  }

  if (shape === 6) {
    // Mode 6: Geodesic Knowledge & Research Globe (12-Meridian Harmonic Sphere)
    const meridian = Math.cos(12 * theta + time * 1.2) * 1.4;
    const r = (41.0 + meridian + breath * 0.45) * layerScale;
    return [cx + Math.cos(theta) * r, cy + Math.sin(theta) * r];
  }

  if (shape === 7) {
    // Mode 7: Focus Hourglass Vortex (Pinched Waist at theta = 0 and PI, Expanded Bulbs at Top/Bottom)
    const pinch = Math.pow(Math.sin(theta), 2);
    const waistR = (22 + 22 * pinch + breath * 0.4) * layerScale;
    return [cx + Math.cos(theta) * waistR * 0.88, cy + Math.sin(theta) * (41 * layerScale)];
  }

  // Mode 0: Default Apple Siri / Fluid Harmonic Silk Sphere
  const wave1 = Math.sin(theta * 3 + time * 2.0) * (1.2 + energy * 3.0);
  const wave2 = Math.cos(theta * 4 - time * 1.5) * (0.8 + energy * 2.0);
  const r = (41.5 + wave1 + wave2 + breath) * layerScale;
  return [cx + Math.cos(theta) * r, cy + Math.sin(theta) * r];
}

function pointsToSmoothSvgPath(pts: Array<[number, number]>): string {
  const n = pts.length;
  if (n === 0) return '';
  let d = `M ${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < n; i++) {
    d += ` L ${pts[i][0].toFixed(2)},${pts[i][1].toFixed(2)}`;
  }
  d += ' Z';
  return d;
}

/**
 * 60fps Spring-Physics Parametric Vector Sculpture Overlay.
 * Renders razor-sharp, liquid-smooth morphing silk contours and topic emblems
 * that smoothly interpolate every vertex with critically-damped spring dynamics.
 */
function ParametricMorphSculpture({
  state,
  energy = 0,
  bands,
  topicShape = 0,
  colorTheme = 'default',
  isOverlay = false,
}: {
  state: VoiceVisualState;
  energy?: number;
  bands?: AudioSpectrumBands;
  topicShape?: number;
  colorTheme?: string;
  isOverlay?: boolean;
}) {
  const outerPathRef = useRef<SVGPathElement>(null);
  const midPathRef = useRef<SVGPathElement>(null);
  const innerPathRef = useRef<SVGPathElement>(null);
  const clipPathRef = useRef<SVGPathElement>(null);

  const shapeRef = useRef(topicShape);
  const energyRef = useRef(energy);
  const bandsRef = useRef(bands);
  shapeRef.current = topicShape;
  energyRef.current = energy;
  bandsRef.current = bands;

  const baseCol = FALLBACK_COLOR[state] || FALLBACK_COLOR.idle;
  const col =
    (colorTheme !== 'default' && COLOR_THEME_PALETTES[colorTheme]) ||
    (topicShape > 0 && SHAPE_PALETTES[topicShape]) || {
      ...baseCol,
      accent: '#FFFFFF',
    };

  useEffect(() => {
    const N = 120;
    const thetas = Array.from({ length: N }, (_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / N);

    // Initialize current & velocity arrays for 3 harmonic silk contour layers
    const curOuter: Array<[number, number]> = thetas.map((th) =>
      evaluateParametricShapePoint(shapeRef.current, th, 0, 0, 1.0)
    );
    const velOuter: Array<[number, number]> = thetas.map(() => [0, 0]);

    const curMid: Array<[number, number]> = thetas.map((th) =>
      evaluateParametricShapePoint(shapeRef.current, th, 0, 0, 0.84)
    );
    const velMid: Array<[number, number]> = thetas.map(() => [0, 0]);

    const curInner: Array<[number, number]> = thetas.map((th) =>
      evaluateParametricShapePoint(shapeRef.current, th, 0, 0, 0.66)
    );
    const velInner: Array<[number, number]> = thetas.map(() => [0, 0]);

    let raf = 0;
    let t = 0;
    let lastTime = performance.now();

    const stiffness = 0.14;
    const damping = 0.78;

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      t += dt;

      const curShape = shapeRef.current;
      const curEnergy = energyRef.current + (bandsRef.current?.low || 0) * 0.5;

      for (let i = 0; i < N; i++) {
        const th = thetas[i];

        const [tx1, ty1] = evaluateParametricShapePoint(curShape, th, t, curEnergy, 1.0);
        velOuter[i][0] = (velOuter[i][0] + (tx1 - curOuter[i][0]) * stiffness) * damping;
        velOuter[i][1] = (velOuter[i][1] + (ty1 - curOuter[i][1]) * stiffness) * damping;
        curOuter[i][0] += velOuter[i][0];
        curOuter[i][1] += velOuter[i][1];

        const [tx2, ty2] = evaluateParametricShapePoint(curShape, th + 0.08 * Math.sin(t), t * 1.1, curEnergy, 0.84);
        velMid[i][0] = (velMid[i][0] + (tx2 - curMid[i][0]) * stiffness * 0.9) * damping;
        velMid[i][1] = (velMid[i][1] + (ty2 - curMid[i][1]) * stiffness * 0.9) * damping;
        curMid[i][0] += velMid[i][0];
        curMid[i][1] += velMid[i][1];

        const [tx3, ty3] = evaluateParametricShapePoint(curShape, th - 0.08 * Math.cos(t), t * 0.9, curEnergy, 0.66);
        velInner[i][0] = (velInner[i][0] + (tx3 - curInner[i][0]) * stiffness * 0.85) * damping;
        velInner[i][1] = (velInner[i][1] + (ty3 - curInner[i][1]) * stiffness * 0.85) * damping;
        curInner[i][0] += velInner[i][0];
        curInner[i][1] += velInner[i][1];
      }

      const outerD = pointsToSmoothSvgPath(curOuter);
      if (outerPathRef.current) outerPathRef.current.setAttribute('d', outerD);
      if (clipPathRef.current) clipPathRef.current.setAttribute('d', outerD);
      if (midPathRef.current) midPathRef.current.setAttribute('d', pointsToSmoothSvgPath(curMid));
      if (innerPathRef.current) innerPathRef.current.setAttribute('d', pointsToSmoothSvgPath(curInner));

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const gradId = `apple-orb-${state}-${topicShape}-${isOverlay ? 'ov' : 'fb'}`;

  return (
    <svg
      viewBox="0 0 120 120"
      className="h-full w-full overflow-visible select-none pointer-events-none"
      aria-hidden="true"
      data-testid={isOverlay ? 'signal-parametric-overlay' : 'signal-fallback'}
      data-topic-shape={topicShape}
    >
      <defs>
        <radialGradient id={`halo-${gradId}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={col.glow} stopOpacity={isOverlay ? '0.28' : '0.55'} />
          <stop offset="55%" stopColor={col.primary} stopOpacity={isOverlay ? '0.1' : '0.22'} />
          <stop offset="100%" stopColor={col.secondary} stopOpacity="0" />
        </radialGradient>

        <radialGradient id={`body-${gradId}`} cx="38%" cy="28%" r="74%">
          <stop offset="0%" stopColor={col.glow} stopOpacity="0.96" />
          <stop offset="48%" stopColor={col.primary} stopOpacity="0.95" />
          <stop offset="100%" stopColor={col.secondary} stopOpacity="0.98" />
        </radialGradient>

        <linearGradient id={`silk-stroke-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
          <stop offset="50%" stopColor={col.glow} stopOpacity="0.85" />
          <stop offset="100%" stopColor={col.accent} stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id={`waffle-${gradId}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.92" />
          <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#B45309" stopOpacity="0.94" />
        </linearGradient>

        <clipPath id={`clip-${gradId}`}>
          <path ref={clipPathRef} d="M 60,18 A 42,42 0 1,1 59.9,18 Z" />
        </clipPath>
      </defs>

      {/* Ambient Halo */}
      {!isOverlay && <circle cx="60" cy="60" r="56" fill={`url(#halo-${gradId})`} />}

      {/* Fallback Solid Body when WebGL is inactive */}
      {!isOverlay && (
        <g clipPath={`url(#clip-${gradId})`}>
          <rect x="4" y="4" width="112" height="112" fill={`url(#body-${gradId})`} />
          <ellipse cx="48" cy="36" rx="22" ry="12" fill="#FFFFFF" fillOpacity="0.28" transform="rotate(-18 48 36)" />
        </g>
      )}

      {/* Smooth 60fps Spring-Interpolated Parametric Silk Contours */}
      <path
        ref={innerPathRef}
        fill={isOverlay ? 'none' : col.glow}
        fillOpacity={isOverlay ? 0 : 0.14}
        stroke={`url(#silk-stroke-${gradId})`}
        strokeWidth="0.9"
        strokeOpacity="0.45"
      />
      <path
        ref={midPathRef}
        fill="none"
        stroke={`url(#silk-stroke-${gradId})`}
        strokeWidth="1.25"
        strokeOpacity="0.65"
      />
      <path
        ref={outerPathRef}
        fill="none"
        stroke={`url(#silk-stroke-${gradId})`}
        strokeWidth="2.0"
        strokeOpacity="0.92"
      />

      {/* Smoothly Transitioning Precision Vector Geometry Details for Modes 1-4 */}
      {/* Mode 1: Sculpted Ice Cream Waffle Cone Lattice, Soft-Serve Swirl & Glossy Cherry */}
      <g
        style={{
          opacity: topicShape === 1 ? 1 : 0,
          transform: topicShape === 1 ? 'scale(1)' : 'scale(0.84)',
          transformOrigin: '60px 60px',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* Golden Waffle Cone Facet */}
        <path
          d="M 38,65 Q 60,71 82,65 L 60,104 Z"
          fill={`url(#waffle-${gradId})`}
          fillOpacity="0.82"
          stroke="#FEF3C7"
          strokeWidth="1.2"
        />
        {/* Crisp Waffle Lattice Lines */}
        <g stroke="#78350F" strokeOpacity="0.55" strokeWidth="1.0">
          <line x1="44" y1="67" x2="65" y2="94" />
          <line x1="53" y1="68" x2="70" y2="85" />
          <line x1="63" y1="68" x2="75" y2="76" />
          <line x1="76" y1="67" x2="55" y2="94" />
          <line x1="67" y1="68" x2="50" y2="85" />
          <line x1="57" y1="68" x2="45" y2="76" />
        </g>
        {/* Triple Soft-Serve Cream Swirl Ribbons */}
        <path
          d="M 33,63 C 33,52 46,50 60,51 C 74,52 87,52 87,63 C 79,68 41,68 33,63 Z"
          fill="#FFF1F2"
          fillOpacity="0.88"
          stroke="#FDA4AF"
          strokeWidth="1.2"
        />
        <path
          d="M 39,51 C 39,40 50,38 60,39 C 70,40 81,40 81,51"
          fill="#FFE4E6"
          fillOpacity="0.85"
          stroke="#FB7185"
          strokeWidth="1.2"
        />
        <path
          d="M 46,39 C 48,28 55,24 60,21 C 65,24 72,28 74,39"
          fill="#FECDD3"
          fillOpacity="0.9"
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />
        {/* Top Cherry & Stem */}
        <circle cx="60" cy="19" r="4.8" fill="#E11D48" stroke="#FFFFFF" strokeWidth="1.2" />
        <path d="M 60,15 C 63,9 69,8 72,11" fill="none" stroke="#FECDD3" strokeWidth="1.3" strokeLinecap="round" />
      </g>

      {/* Mode 2: Precision Crystalline Gem Facets & Luminous Typographic Page */}
      <g
        style={{
          opacity: topicShape === 2 ? 1 : 0,
          transform: topicShape === 2 ? 'scale(1)' : 'scale(0.84)',
          transformOrigin: '60px 60px',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        fill="none"
      >
        {/* Inner Cut-Sapphire Octagon Crown & Facet Rays */}
        <polygon
          points="60,27 81,36 90,60 81,84 60,93 39,84 30,60 39,36"
          stroke="#E0F2FE"
          strokeWidth="1.3"
          strokeOpacity="0.85"
          fill="rgba(255,255,255,0.08)"
        />
        {/* Corner Facet Struts */}
        <g stroke="#7DD3FC" strokeWidth="0.9" strokeOpacity="0.65">
          <line x1="60" y1="19" x2="60" y2="27" />
          <line x1="60" y1="93" x2="60" y2="101" />
          <line x1="21" y1="60" x2="30" y2="60" />
          <line x1="90" y1="60" x2="99" y2="60" />
          <line x1="33" y1="31" x2="39" y2="36" />
          <line x1="87" y1="31" x2="81" y2="36" />
          <line x1="33" y1="89" x2="39" y2="84" />
          <line x1="87" y1="89" x2="81" y2="84" />
        </g>
        {/* Sculpted Glass Document & Precision Letterform Bars */}
        <rect
          x="44"
          y="39"
          width="32"
          height="42"
          rx="4"
          fill="rgba(255, 255, 255, 0.16)"
          stroke="#FFFFFF"
          strokeWidth="1.4"
        />
        <line x1="50" y1="48" x2="70" y2="48" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="50" y1="56" x2="70" y2="56" stroke="#BAE6FD" strokeWidth="1.7" strokeLinecap="round" />
        <line x1="50" y1="64" x2="65" y2="64" stroke="#BAE6FD" strokeWidth="1.7" strokeLinecap="round" />
        <line x1="50" y1="72" x2="60" y2="72" stroke="#7DD3FC" strokeWidth="1.7" strokeLinecap="round" />
      </g>

      {/* Mode 3: 5-Fold Harmonic Rose & Apple Silk Spirograph */}
      <g
        style={{
          opacity: topicShape === 3 ? 1 : 0,
          transform: topicShape === 3 ? 'scale(1)' : 'scale(0.84)',
          transformOrigin: '60px 60px',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        fill="none"
      >
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={deg}
            cx="60"
            cy="44"
            rx="11"
            ry="22"
            transform={`rotate(${deg} 60 60)`}
            stroke="#F5D0FE"
            strokeWidth="1.2"
            strokeOpacity="0.72"
            fill="rgba(232, 121, 249, 0.1)"
          />
        ))}
        <circle cx="60" cy="60" r="9" fill="#FFFFFF" fillOpacity="0.85" stroke="#E879F9" strokeWidth="1.5" />
      </g>

      {/* Mode 4: Sacred 8-Petal Botanical Lotus Crown & Golden Stamen Core */}
      <g
        style={{
          opacity: topicShape === 4 ? 1 : 0,
          transform: topicShape === 4 ? 'scale(1)' : 'scale(0.84)',
          transformOrigin: '60px 60px',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        fill="none"
      >
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <path
            key={deg}
            d="M 60,24 C 69,36 69,50 60,60 C 51,50 51,36 60,24 Z"
            transform={`rotate(${deg} 60 60)`}
            fill="rgba(94, 234, 212, 0.14)"
            stroke="#CCFBF1"
            strokeWidth="1.2"
            strokeOpacity="0.82"
          />
        ))}
        <circle cx="60" cy="60" r="11" fill="rgba(253, 230, 138, 0.32)" stroke="#FDE68A" strokeWidth="1.6" />
        <circle cx="60" cy="60" r="4.5" fill="#FEF08A" />
      </g>

      {/* Mode 5: Interactive 4-Quadrant ADHD Cognitive Game Arena Sculpture */}
      <g
        style={{
          opacity: topicShape === 5 ? 1 : 0,
          transform: topicShape === 5 ? 'scale(1)' : 'scale(0.84)',
          transformOrigin: '60px 60px',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        fill="none"
      >
        {/* 4 Harmonic Simon Pulse Quadrants */}
        <path d="M 60,24 A 36,36 0 0,1 96,60 L 72,60 A 12,12 0 0,0 60,48 Z" fill="rgba(16,185,129,0.45)" stroke="#6EE7B7" strokeWidth="1.3" />
        <path d="M 96,60 A 36,36 0 0,1 60,96 L 60,72 A 12,12 0 0,0 72,60 Z" fill="rgba(14,165,233,0.45)" stroke="#7DD3FC" strokeWidth="1.3" />
        <path d="M 60,96 A 36,36 0 0,1 24,60 L 48,60 A 12,12 0 0,0 60,72 Z" fill="rgba(245,158,11,0.45)" stroke="#FDE68A" strokeWidth="1.3" />
        <path d="M 24,60 A 36,36 0 0,1 60,24 L 60,48 A 12,12 0 0,0 48,60 Z" fill="rgba(139,92,246,0.45)" stroke="#DDD6FE" strokeWidth="1.3" />
        <circle cx="60" cy="60" r="10" fill="#FFFFFF" fillOpacity="0.92" stroke="#10B981" strokeWidth="1.6" />
        <circle cx="60" cy="60" r="4" fill="#006A67" />
      </g>

      {/* Mode 6: Geodesic Knowledge & Web Research Globe */}
      <g
        style={{
          opacity: topicShape === 6 ? 1 : 0,
          transform: topicShape === 6 ? 'scale(1)' : 'scale(0.84)',
          transformOrigin: '60px 60px',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        fill="none"
        stroke="#E0F2FE"
        strokeWidth="1.15"
        strokeOpacity="0.82"
      >
        <circle cx="60" cy="60" r="34" fill="rgba(56,189,248,0.12)" />
        <ellipse cx="60" cy="60" rx="18" ry="34" />
        <ellipse cx="60" cy="60" rx="34" ry="15" />
        <line x1="26" y1="60" x2="94" y2="60" />
        <line x1="60" y1="26" x2="60" y2="94" />
        <circle cx="60" cy="60" r="5" fill="#FFFFFF" />
      </g>

      {/* Mode 7: Focus Hourglass Time Vortex */}
      <g
        style={{
          opacity: topicShape === 7 ? 1 : 0,
          transform: topicShape === 7 ? 'scale(1)' : 'scale(0.84)',
          transformOrigin: '60px 60px',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1), transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        fill="none"
      >
        <path
          d="M 38,28 L 82,28 C 82,45 64,53 60,60 C 56,67 38,75 38,92 L 82,92 C 82,75 64,67 60,60 C 56,53 38,45 38,28 Z"
          fill="rgba(253,230,138,0.22)"
          stroke="#FEF3C7"
          strokeWidth="1.5"
        />
        <circle cx="60" cy="60" r="3.5" fill="#FDE68A" />
      </g>
    </svg>
  );
}

export function SignalFallbackSvg({
  state,
  energy = 0,
  bands,
  topicShape = 0,
  colorTheme = 'default',
}: {
  state: VoiceVisualState;
  energy?: number;
  bands?: AudioSpectrumBands;
  topicShape?: number;
  colorTheme?: string;
}) {
  return (
    <ParametricMorphSculpture
      state={state}
      energy={energy}
      bands={bands}
      topicShape={topicShape}
      colorTheme={colorTheme}
      isOverlay={false}
    />
  );
}

export function Signal({
  state,
  energy = 0,
  bands,
  topicShape = 0,
  colorTheme = 'default',
  size = 240,
  hideLabel = false,
  className = '',
}: {
  state: VoiceVisualState;
  energy?: number;
  bands?: AudioSpectrumBands;
  topicShape?: number;
  colorTheme?: string;
  size?: number;
  hideLabel?: boolean;
  className?: string;
}) {
  const [webglOk, setWebglOk] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setWebglOk(hasWebGL());
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const handleUnsupported = useCallback(() => setWebglOk(false), []);

  const inlineStyle = className ? undefined : { width: size, height: size };

  return (
    <div
      className={`flex flex-col items-center gap-2 select-none ${className}`}
      data-signal-state={state}
      data-topic-shape={topicShape}
      data-color-theme={colorTheme}
    >
      <div
        className="relative flex items-center justify-center w-full h-full select-none outline-none"
        style={{ ...inlineStyle, WebkitTapHighlightColor: 'transparent' }}
      >
        {webglOk ? (
          <>
            <SignalScene
              state={state}
              energy={energy}
              bands={bands}
              topicShape={topicShape}
              reducedMotion={reducedMotion}
              onUnsupported={handleUnsupported}
            />
            {/* Synchronized 60fps Spring-Physics Parametric Silk Vector Sculpture */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <ParametricMorphSculpture
                state={state}
                energy={energy}
                bands={bands}
                topicShape={topicShape}
                colorTheme={colorTheme}
                isOverlay={true}
              />
            </div>
          </>
        ) : (
          <SignalFallbackSvg
            state={state}
            energy={energy}
            bands={bands}
            topicShape={topicShape}
            colorTheme={colorTheme}
          />
        )}
      </div>
      {!hideLabel && (
        <p className="meta text-center" aria-live="polite">
          {STATE_LABELS[state]}
        </p>
      )}
    </div>
  );
}

