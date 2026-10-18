'use client';

/**
 * The Stay orb: one field of dots. Every shape is just a different place for the same dots to gather.
 * Dots leave the old shape, swirl through the middle at slightly different times and settle into the new
 * one, so shapes visibly accumulate instead of cross-fading. No images, no SVG: points only.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VoiceVisualState } from '@/types/domain';
import { spherePoints } from '@/lib/orb/sdf';
import { DEFAULT_PALETTE } from '@/lib/orb/library';
import { colorize } from '@/lib/orb/points';

export interface OrbTarget {
  /** Identity of the shape; a new key triggers a morph. */
  key: string;
  /** xyz triples (length = 3 * pointCount) or null for the resting orb. */
  points: Float32Array | null;
  /** Per-dot rgb (0..1) matching points; null = derive a gradient from the palette. */
  cols?: Float32Array | null;
  palette: [string, string];
}

export const REST_TARGET: OrbTarget = { key: 'orb', points: null, palette: DEFAULT_PALETTE };

export function getOrbPointCount(): number {
  if (typeof window === 'undefined') return 5200;
  return window.innerWidth < 640 ? 3200 : 5200;
}

interface Props {
  state: VoiceVisualState;
  energy: number;
  bands?: { low: number; mid: number; high: number };
  target: OrbTarget;
  /** Optional two-colour theme chosen by the user; recolours every dot as a gradient. */
  tint?: [string, string] | null;
  /** True while a brand-new shape is being authored: the dots gather into a vortex. */
  thinking?: boolean;
  reducedMotion: boolean;
  onUnsupported: () => void;
  onReady?: () => void;
}

const VERT = /* glsl */ `
  uniform float uMix, uTime, uEnergy, uLow, uMid, uHigh, uSwirl, uThink, uBreath, uYaw, uPx, uSize;
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aColFrom;
  attribute vec3 aColTo;
  varying vec3 vCol;
  attribute vec4 aSeed;
  varying float vC;
  varying float vDepth;
  varying float vTravel;
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  void main() {
    // each dot starts and finishes at its own moment, so the shape pours together
    float delay = aSeed.x * 0.42;
    float t = clamp((uMix - delay) / 0.58, 0.0, 1.0);
    float e = t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    vec3 p = mix(aFrom, aTo, e);
    float travel = sin(3.14159265 * t);
    float ang = (aSeed.y - 0.5) * 3.4 * travel * uSwirl;
    p.xz = rot(ang) * p.xz;
    vec3 dir = normalize(aSeed.xyz * 2.0 - 1.0 + vec3(0.001));
    p += dir * travel * (0.14 + 0.36 * aSeed.w) * uSwirl;

    // thinking: the dots wind into a slow vortex while a new shape is being drawn
    float spin = uThink * uTime * (0.7 + (1.0 - aSeed.w) * 1.6);
    vec2 v = rot(spin) * p.xy * (1.0 - 0.38 * uThink * aSeed.z);
    p.xy = mix(p.xy, v, uThink);

    // breathing and voice: radial, so the surface itself moves with sound
    vec3 n3 = normalize(p + vec3(0.001));
    float ph = uTime * 1.4 + aSeed.z * 31.4;
    float breathe = uBreath * 0.014 * (0.5 + 0.5 * sin(ph));
    float voice = uEnergy * (0.05 + 0.10 * aSeed.w) * (0.6 + 0.4 * sin(ph * 2.3 + aSeed.x * 9.0))
                + uLow * 0.06 * sin(length(p) * 8.0 - uTime * 5.0)
                + uMid * 0.025 * sin(ph * 4.0);
    p += n3 * (breathe + voice);

    p.xz = rot(uYaw) * p.xz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = clamp(0.5 - p.z * 0.5, 0.0, 1.0);
    float size = uSize * (0.75 + aSeed.w * 0.85) * (1.0 + uHigh * 0.6 * aSeed.y) * (1.0 + travel * 0.5) * (1.0 - 0.38 * depth);
    gl_PointSize = size * uPx * (5.0 / -mv.z);
    vC = clamp(p.y * 0.5 + 0.5 + (aSeed.z - 0.5) * 0.35, 0.0, 1.0);
    vCol = mix(aColFrom, aColTo, e);
    vDepth = depth;
    vTravel = travel;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform float uDesat;
  uniform float uTint;
  varying vec3 vCol;
  varying float vC;
  varying float vDepth;
  varying float vTravel;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.2, d);
    if (a < 0.01) discard;
    vec3 col = mix(vCol, mix(uColB, uColA, vC), uTint);
    col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), uDesat);
    col = mix(col, vec3(1.0), vDepth * 0.22);
    col += vTravel * 0.1;
    gl_FragColor = vec4(col, a * (0.94 - 0.4 * vDepth));
  }
`;

interface StatePreset {
  breath: number;
  think: number;
  desat: number;
}
const PRESETS: Record<VoiceVisualState, StatePreset> = {
  idle: { breath: 1, think: 0, desat: 0 },
  connecting: { breath: 1.6, think: 0.35, desat: 0 },
  listening: { breath: 1.8, think: 0, desat: 0 },
  thinking: { breath: 1, think: 0.8, desat: 0 },
  speaking: { breath: 1, think: 0, desat: 0 },
  interrupted: { breath: 2, think: 0, desat: 0 },
  backchannel: { breath: 2, think: 0, desat: 0 },
  saving: { breath: 1, think: 0.3, desat: 0 },
  complete: { breath: 1.4, think: 0, desat: 0 },
  error: { breath: 0.4, think: 0, desat: 0.85 },
};

const MORPH_SECONDS = 1.9;

export default function OrbParticles({ state, energy, bands, target, tint, thinking, reducedMotion, onUnsupported, onReady }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const live = useRef({ state, energy, bands, target, tint, thinking });
  live.current = { state, energy, bands, target, tint, thinking };
  const cbs = useRef({ onUnsupported, onReady });
  cbs.current = { onUnsupported, onReady };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    while (mount.firstChild) mount.removeChild(mount.firstChild);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
    } catch {
      cbs.current.onUnsupported();
      return;
    }
    const onLost = (e: Event) => {
      e.preventDefault();
      cbs.current.onUnsupported();
    };
    renderer.domElement.addEventListener('webglcontextlost', onLost);

    // The orb is a sphere: always render a square sized by the narrower side.
    const side = () => {
      const w = mount.clientWidth || 320;
      return Math.max(64, Math.min(w, mount.clientHeight || w));
    };
    let px = side();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(px, px);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 5);

    const N = getOrbPointCount();
    const small = px < 180;
    const drawCount = small ? Math.min(N, 1700) : N;

    const rest = spherePoints(N);
    const restCols = colorize(rest, DEFAULT_PALETTE);
    const aFrom = new Float32Array(rest);
    const aTo = new Float32Array(rest);
    const cFrom = new Float32Array(restCols);
    const cTo = new Float32Array(restCols);
    const seed = new Float32Array(N * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    const fromAttr = new THREE.BufferAttribute(aFrom, 3);
    const toAttr = new THREE.BufferAttribute(aTo, 3);
    fromAttr.setUsage(THREE.DynamicDrawUsage);
    toAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aFrom', fromAttr);
    geo.setAttribute('aTo', toAttr);
    const colFromAttr = new THREE.BufferAttribute(cFrom, 3);
    const colToAttr = new THREE.BufferAttribute(cTo, 3);
    colFromAttr.setUsage(THREE.DynamicDrawUsage);
    colToAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aColFrom', colFromAttr);
    geo.setAttribute('aColTo', colToAttr);
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    geo.setDrawRange(0, drawCount);

    const startPalette = live.current.target.palette;
    const uniforms = {
      uMix: { value: 1 },
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uLow: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uSwirl: { value: reducedMotion ? 0 : 1 },
      uThink: { value: 0 },
      uBreath: { value: reducedMotion ? 0 : 1 },
      uYaw: { value: 0 },
      uPx: { value: dpr },
      uSize: { value: px * 0.0088 },
      uDesat: { value: 0 },
      uTint: { value: 0 },
      uColA: { value: new THREE.Color(startPalette[0]) },
      uColB: { value: new THREE.Color(startPalette[1]) },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    scene.add(points);

    // ---- morph bookkeeping ----
    let currentKey = live.current.target.key;
    let mixStart = -1; // seconds on the animation clock; -1 = settled
    let sphereW = currentKey === 'orb' ? 1 : 0;
    let spin = 0;
    const tgtA = new THREE.Color(startPalette[0]);
    const tgtB = new THREE.Color(startPalette[1]);
    const setDest = (next: OrbTarget) => {
      const ok = !!next.points && next.points.length >= N * 3;
      aTo.set((ok ? next.points! : rest).subarray(0, N * 3));
      cTo.set(ok ? (next.cols && next.cols.length >= N * 3 ? next.cols : colorize(next.points!, next.palette)).subarray(0, N * 3) : restCols);
    };
    if (live.current.target.points && live.current.target.key !== 'orb') {
      setDest(live.current.target);
      aFrom.set(aTo);
      cFrom.set(cTo);
    }

    const stagger = (i: number, p: number) => {
      const t = Math.min(1, Math.max(0, (p - seed[i * 4] * 0.42) / 0.58));
      return t * t * t * (t * (t * 6 - 15) + 10);
    };
    const retarget = (next: OrbTarget, now: number) => {
      if (mixStart >= 0) {
        // mid-flight: continue from where each dot currently is
        const p = Math.min(1, (now - mixStart) / MORPH_SECONDS);
        for (let i = 0; i < N; i++) {
          const e = stagger(i, p);
          for (let c = 0; c < 3; c++) {
            aFrom[i * 3 + c] += (aTo[i * 3 + c] - aFrom[i * 3 + c]) * e;
            cFrom[i * 3 + c] += (cTo[i * 3 + c] - cFrom[i * 3 + c]) * e;
          }
        }
      } else {
        aFrom.set(aTo);
        cFrom.set(cTo);
      }
      setDest(next);
      fromAttr.needsUpdate = true;
      toAttr.needsUpdate = true;
      colFromAttr.needsUpdate = true;
      colToAttr.needsUpdate = true;
      tgtA.set(next.palette[0]);
      tgtB.set(next.palette[1]);
      if (reducedMotion) {
        aFrom.set(aTo);
        cFrom.set(cTo);
        fromAttr.needsUpdate = true;
        colFromAttr.needsUpdate = true;
        uniforms.uMix.value = 1;
        mixStart = -1;
        uniforms.uColA.value.copy(tgtA);
        uniforms.uColB.value.copy(tgtB);
      } else {
        mixStart = now;
        uniforms.uMix.value = 0;
      }
      currentKey = next.key;
    };

    const clock = new THREE.Clock();
    let t = 0;
    let raf = 0;
    let readyFired = false;
    let frameMsEma = 16;
    let frames = 0;
    let smoothEnergy = 0, sLow = 0, sMid = 0, sHigh = 0;

    const render = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      t += dt;
      const L = live.current;
      const ease = (r: number) => 1 - Math.exp(-dt * r);
      const follow = (cur: number, to: number) => cur + (to - cur) * ease(to > cur ? 22 : 7);

      if (L.target.key !== currentKey) retarget(L.target, t);
      if (mixStart >= 0) {
        const p = (t - mixStart) / MORPH_SECONDS;
        if (p >= 1) {
          uniforms.uMix.value = 1;
          mixStart = -1;
          aFrom.set(aTo);
          cFrom.set(cTo);
          fromAttr.needsUpdate = true;
          colFromAttr.needsUpdate = true;
        } else {
          uniforms.uMix.value = p;
        }
      }

      const preset = PRESETS[L.state] || PRESETS.idle;
      const thinkTarget = Math.max(preset.think, L.thinking ? 1 : 0);
      smoothEnergy = follow(smoothEnergy, L.energy);
      sLow = follow(sLow, L.bands ? L.bands.low : smoothEnergy * 0.85);
      sMid = follow(sMid, L.bands ? L.bands.mid : smoothEnergy * 0.6);
      sHigh = follow(sHigh, L.bands ? L.bands.high : smoothEnergy * 0.4);

      if (!reducedMotion) {
        uniforms.uTime.value = t;
        uniforms.uThink.value += (thinkTarget - uniforms.uThink.value) * ease(3);
        uniforms.uBreath.value += (preset.breath - uniforms.uBreath.value) * ease(3);
        sphereW += ((currentKey === 'orb' ? 1 : 0) - sphereW) * ease(2.2);
        spin += dt * 0.2 * sphereW;
        uniforms.uYaw.value = spin + Math.sin(t * 0.45) * 0.26 * (1 - sphereW);
      }
      uniforms.uEnergy.value = smoothEnergy;
      uniforms.uLow.value = sLow;
      uniforms.uMid.value = sMid;
      uniforms.uHigh.value = sHigh;
      uniforms.uDesat.value += (preset.desat - uniforms.uDesat.value) * ease(4);
      const tint = L.tint;
      if (tint) {
        tgtA.set(tint[0]);
        tgtB.set(tint[1]);
        uniforms.uColA.value.lerp(tgtA, reducedMotion ? 1 : ease(4));
        uniforms.uColB.value.lerp(tgtB, reducedMotion ? 1 : ease(4));
      }
      uniforms.uTint.value += ((tint ? 1 : 0) - uniforms.uTint.value) * (reducedMotion ? 1 : ease(4));

      renderer.render(scene, camera);
      if (!readyFired) {
        readyFired = true;
        cbs.current.onReady?.();
      }

      // adaptive resolution: step down once if frames run long for ~1.5 s
      frameMsEma += (dt * 1000 - frameMsEma) * 0.1;
      if (++frames >= 90) {
        frames = 0;
        if (frameMsEma > 26 && dpr > 1) {
          dpr = Math.max(1, dpr - 0.5);
          renderer.setPixelRatio(dpr);
          renderer.setSize(px, px);
          uniforms.uPx.value = dpr;
        }
      }
      raf = requestAnimationFrame(render);
    };

    let onScreen = true;
    const start = () => {
      if (raf || !onScreen || document.hidden) return;
      clock.getDelta();
      raf = requestAnimationFrame(render);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);
    const io = new IntersectionObserver((entries) => {
      onScreen = entries[0]?.isIntersecting ?? true;
      if (onScreen) start();
      else stop();
    });
    io.observe(mount);
    const ro = new ResizeObserver(() => {
      px = side();
      renderer.setSize(px, px);
      uniforms.uSize.value = px * 0.0088;
    });
    ro.observe(mount);

    if (live.current.target.key !== 'orb') {
      // first paint already on a shape (e.g. remount): start settled on it
      uniforms.uMix.value = 1;
    }
    render();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      io.disconnect();
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [reducedMotion]);

  return <div ref={mountRef} className="h-full w-full select-none outline-none" aria-hidden="true" />;
}
