'use client';

/**
 * The Stay orb: one field of dots. Every shape is just a different place for the same dots to gather.
 * Dots leave the old shape, flow through the middle on a coherent current and settle into the new one on a
 * damped spring (a small overshoot, then a wobble), so shapes pour together like jelly instead of cross-fading.
 * One of the shapes is a person: its dots also carry a "rig" that the vertex shader animates live (mouth from the
 * agent's real audio, blinks, breath, head). No images, no SVG: points only.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VoiceVisualState } from '@/types/domain';
import { spherePoints } from '@/lib/orb/sdf';
import { DEFAULT_PALETTE } from '@/lib/orb/library';
import { colorize } from '@/lib/orb/points';
import { MORPH_GLSL, JellySpring, dotEase } from '@/lib/orb/morph';
import { FACE } from '@/lib/orb/human';
import { FaceAnimator, REST_FACE, type FaceFrame } from '@/lib/orb/faceAnimator';
import { lipSyncBus } from '@/lib/orb/lipSync';

export interface OrbTarget {
  /** Identity of the shape; a new key triggers a morph. */
  key: string;
  /** xyz triples (length = 3 * pointCount) or null for the resting orb. */
  points: Float32Array | null;
  /** Per-dot rgb (0..1) matching points; null = derive a gradient from the palette. */
  cols?: Float32Array | null;
  palette: [string, string];
  /** vec4 per dot animation rig (see human.ts); only the person has one. */
  rig?: Float32Array | null;
  /** Where the staggered pour starts from (default: the middle). */
  waveCenter?: [number, number];
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
  uniform float uMix, uTime, uEnergy, uLow, uMid, uHigh, uSwirl, uThink, uBreath, uYaw, uPx, uSize, uJelly;
  uniform vec4 uFaceA; // mouth open, mouth wide, blink, brow
  uniform vec4 uFaceB; // head tilt, nod, sway, breath
  uniform vec2 uGaze;
  uniform vec2 uWaveC;
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aColFrom;
  attribute vec3 aColTo;
  attribute vec4 aRigFrom;
  attribute vec4 aRigTo;
  varying vec3 vCol;
  attribute vec4 aSeed;
  varying float vC;
  varying float vDepth;
  varying float vTravel;
  ${MORPH_GLSL}
  const float MOUTH_OPEN_H = ${FACE.mouthOpenH.toFixed(4)};
  const float MOUTH_HALF_W = ${FACE.mouthHalfW.toFixed(4)};
  const float NECK_PIVOT_Y = ${FACE.neckPivotY.toFixed(4)};
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  // The person's live animation, as an offset on top of the dot's resting place. Roles: 1 upper lip, 2 lower lip
  // and jaw, 3 inside of the mouth, 4 eye, 5 brow, 6 torso, 7 small detail, 8 hair. rig = (role + 0.01 + headWeight * 0.98, a, b, c).
  vec3 rigOffset(vec4 rig, vec3 base, out float headW, out float sizeMul) {
    float role = floor(rig.x);
    headW = clamp((rig.x - role - 0.01) / 0.98, 0.0, 1.0) * step(0.005, rig.x);
    sizeMul = 1.0;
    vec3 d = vec3(0.0);
    if (rig.x < 0.005) return d;
    float open = uFaceA.x;
    float wide = uFaceA.y;
    float openH = open * MOUTH_OPEN_H;
    if (role > 0.5 && role < 3.5) {
      if (role < 1.5) {
        d.y += rig.y * 0.35 * openH;
        sizeMul = 0.88;
      } else if (role < 2.5) {
        d.y -= rig.y * 0.65 * openH;
      } else {
        d.y += (-0.15 * rig.z + 0.5 * rig.y) * openH;
        sizeMul = smoothstep(0.04, 0.2, open);
      }
      float lx = rig.w;
      d.x += lx * MOUTH_HALF_W * (wide > 0.0 ? wide * 0.14 : wide * 0.3);
      d.y += max(wide, 0.0) * 0.012 * lx * lx;
      d.z += max(-wide, 0.0) * 0.04 * (1.0 - lx * lx);
    } else if (role < 4.5) {
      d.y -= rig.y * uFaceA.z * 0.97;
      d.x += uGaze.x * 0.011;
      d.y += uGaze.y * 0.006 * (1.0 - uFaceA.z);
      sizeMul = 0.85;
    } else if (role < 5.5) {
      d.y += uFaceA.w * 0.024 * rig.y;
      sizeMul = 0.9;
    } else if (role < 6.5) {
      d.y += uFaceB.w * 0.011 * rig.y;
      d.x += base.x * uFaceB.w * 0.006 * rig.y;
    } else {
      sizeMul = role > 7.5 ? 1.22 : 0.82; // hair is bold, small facial detail is fine
    }
    return d;
  }

  void main() {
    float wave = clamp(length(aTo.xy - uWaveC) / 1.25, 0.0, 1.0);
    float t = dotT(uMix, aSeed.x, wave);
    float e = springEase(t);

    float hwF, hwT, szF, szT;
    vec3 pf = aFrom + rigOffset(aRigFrom, aFrom, hwF, szF);
    vec3 pt = aTo + rigOffset(aRigTo, aTo, hwT, szT);
    vec3 p = mix(pf, pt, e); // e may overshoot 1: that is the jelly
    float ec = clamp(e, 0.0, 1.0);
    float fig = mix(step(0.005, aRigFrom.x), step(0.005, aRigTo.x), ec);
    float headW = mix(hwF, hwT, ec);
    float sizeMul = mix(szF, szT, ec);

    // the person's head: tilt about the base of the neck, nod, sway
    vec2 q = p.xy - vec2(0.0, NECK_PIVOT_Y);
    q = rot(uFaceB.x * headW) * q;
    p.xy = q + vec2(0.0, NECK_PIVOT_Y) + vec2(uFaceB.z * 0.5, uFaceB.y) * headW;

    float travel = sin(3.14159265 * t);
    float ang = (aSeed.y - 0.5) * 2.4 * travel * uSwirl;
    p.xz = rot(ang) * p.xz;
    // a current shared by neighbouring dots (so the cloud flows) plus a little per-dot scatter
    vec3 flow = vec3(sin(p.y * 3.3 + uTime * 1.9 + aSeed.z * 1.2), sin(p.z * 2.9 + p.x * 2.1 + uTime * 1.5), cos(p.x * 3.1 - p.y * 1.7 + uTime * 2.1));
    vec3 dir = normalize(aSeed.xyz * 2.0 - 1.0 + vec3(0.001));
    p += flow * travel * 0.14 * uSwirl;
    p += dir * travel * (0.05 + 0.2 * aSeed.w) * uSwirl;

    // thinking: the dots wind into a slow vortex while a new shape is being drawn
    float spin = uThink * uTime * (0.7 + (1.0 - aSeed.w) * 1.6);
    vec2 v = rot(spin) * p.xy * (1.0 - 0.38 * uThink * aSeed.z);
    p.xy = mix(p.xy, v, uThink);

    // breathing and voice: radial, so the surface itself moves with sound. The person keeps her face instead
    float calm = 1.0 - 0.93 * fig;
    vec3 n3 = normalize(p + vec3(0.001));
    float ph = uTime * 1.4 + aSeed.z * 31.4;
    float breathe = uBreath * 0.014 * (0.5 + 0.5 * sin(ph));
    float voice = uEnergy * (0.05 + 0.10 * aSeed.w) * (0.6 + 0.4 * sin(ph * 2.3 + aSeed.x * 9.0))
                + uLow * 0.06 * sin(length(p) * 8.0 - uTime * 5.0)
                + uMid * 0.025 * sin(ph * 4.0);
    p += n3 * (breathe + voice) * calm;

    // jelly: the whole body squashes and stretches on a soft spring and a ripple runs through the surface
    float j = uJelly * uSwirl;
    p.xy *= vec2(1.0 + j * 0.09, 1.0 - j * 0.09);
    p += n3 * j * 0.035 * sin(length(p.xy) * 7.0 - uTime * 9.0 + aSeed.z * 2.0);

    p.xz = rot(uYaw) * p.xz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = clamp(0.5 - p.z * 0.5, 0.0, 1.0);
    float size = uSize * (0.75 + aSeed.w * 0.85) * (1.0 + uHigh * 0.6 * aSeed.y * calm) * (1.0 + travel * 0.5) * (1.0 - 0.38 * depth);
    size *= mix(1.0, 0.8, fig) * sizeMul;
    gl_PointSize = size * uPx * (5.0 / -mv.z);
    vC = clamp(p.y * 0.5 + 0.5 + (aSeed.z - 0.5) * 0.35, 0.0, 1.0);
    vCol = mix(aColFrom, aColTo, ec);
    vDepth = depth;
    vTravel = travel;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uColA;
  uniform vec3 uColB;
  uniform float uDesat;
  uniform float uTint;
  uniform float uFade;
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
    gl_FragColor = vec4(col, a * (0.94 - 0.4 * vDepth) * uFade);
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

const MORPH_SECONDS = 2.5;
/** Reduced motion: the old shape fades out, the new one fades in. No travel, no wobble. */
const FADE_OUT_SECONDS = 0.16;
const FADE_IN_SECONDS = 0.24;

/** Frame-time telemetry for measurements: only collected when a test or developer sets window.__stayOrbDebug. */
interface OrbDebug {
  frameMs: number[];
  /** Main-thread time spent inside one render() call (JS + WebGL command submission), per frame. */
  cpuMs: number[];
  face: FaceFrame;
  shape: string;
  figureOn: boolean;
  onsets: number;
}
declare global {
  interface Window {
    __stayOrbDebug?: boolean;
    __stayOrb?: OrbDebug;
  }
}

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
    renderer.domElement.setAttribute('aria-hidden', 'true'); // decoration: the button around it carries the name
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
    const zeroRig = new Float32Array(N * 4);
    const aFrom = new Float32Array(rest);
    const aTo = new Float32Array(rest);
    const cFrom = new Float32Array(restCols);
    const cTo = new Float32Array(restCols);
    const rigFrom = new Float32Array(N * 4);
    const rigTo = new Float32Array(N * 4);
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
    const rigFromAttr = new THREE.BufferAttribute(rigFrom, 4);
    const rigToAttr = new THREE.BufferAttribute(rigTo, 4);
    rigFromAttr.setUsage(THREE.DynamicDrawUsage);
    rigToAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aRigFrom', rigFromAttr);
    geo.setAttribute('aRigTo', rigToAttr);
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
      uFade: { value: 1 },
      uJelly: { value: 0 },
      uFaceA: { value: new THREE.Vector4() },
      uFaceB: { value: new THREE.Vector4() },
      uGaze: { value: new THREE.Vector2() },
      uWaveC: { value: new THREE.Vector2(0, 0) },
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
    let figW = 0; // how much of the current scene is the person (eases), for gentler head yaw
    let spin = 0;
    let waveC: [number, number] = [0, 0];
    let toIsFigure = false;
    let fromIsFigure = false;
    let landed = true; // the "most dots have arrived" jelly kick has fired for this morph
    const tgtA = new THREE.Color(startPalette[0]);
    const tgtB = new THREE.Color(startPalette[1]);
    const jelly = new JellySpring();
    const face = new FaceAnimator(lipSyncBus);
    let faceFrame: FaceFrame = REST_FACE;

    const setDest = (next: OrbTarget) => {
      const ok = !!next.points && next.points.length >= N * 3;
      aTo.set((ok ? next.points! : rest).subarray(0, N * 3));
      cTo.set(ok ? (next.cols && next.cols.length >= N * 3 ? next.cols : colorize(next.points!, next.palette)).subarray(0, N * 3) : restCols);
      const hasRig = ok && !!next.rig && next.rig.length >= N * 4;
      rigTo.set(hasRig ? next.rig!.subarray(0, N * 4) : zeroRig);
      toIsFigure = hasRig;
      waveC = next.waveCenter ?? [0, 0];
      uniforms.uWaveC.value.set(waveC[0], waveC[1]);
    };
    if (live.current.target.points && live.current.target.key !== 'orb') {
      setDest(live.current.target);
      aFrom.set(aTo);
      cFrom.set(cTo);
      rigFrom.set(rigTo);
      fromIsFigure = toIsFigure;
      if (toIsFigure) figW = 1;
    }

    const waveOf = (i: number) => Math.min(1, Math.hypot(aTo[i * 3] - waveC[0], aTo[i * 3 + 1] - waveC[1]) / 1.25);
    const flagAttrs = () => {
      fromAttr.needsUpdate = true;
      toAttr.needsUpdate = true;
      colFromAttr.needsUpdate = true;
      colToAttr.needsUpdate = true;
      rigFromAttr.needsUpdate = true;
      rigToAttr.needsUpdate = true;
    };

    // reduced motion: cross-fade through nothing instead of travelling
    let fade = 1;
    let fadeDir = 0; // -1 fading out, +1 fading in
    let pendingTarget: OrbTarget | null = null;
    const swapNow = (next: OrbTarget) => {
      setDest(next);
      aFrom.set(aTo);
      cFrom.set(cTo);
      rigFrom.set(rigTo);
      fromIsFigure = toIsFigure;
      flagAttrs();
      uniforms.uMix.value = 1;
      mixStart = -1;
      uniforms.uColA.value.set(next.palette[0]);
      uniforms.uColB.value.set(next.palette[1]);
      tgtA.set(next.palette[0]);
      tgtB.set(next.palette[1]);
    };

    const retarget = (next: OrbTarget, now: number) => {
      currentKey = next.key;
      if (reducedMotion) {
        pendingTarget = next;
        fadeDir = -1;
        return;
      }
      if (mixStart >= 0) {
        // mid-flight: continue from where each dot currently is
        const p = Math.min(1, (now - mixStart) / MORPH_SECONDS);
        for (let i = 0; i < N; i++) {
          const e = dotEase(p, seed[i * 4], waveOf(i));
          for (let c = 0; c < 3; c++) {
            aFrom[i * 3 + c] += (aTo[i * 3 + c] - aFrom[i * 3 + c]) * e;
            cFrom[i * 3 + c] += (cTo[i * 3 + c] - cFrom[i * 3 + c]) * Math.min(1, Math.max(0, e));
          }
          if (e >= 0.5) for (let c = 0; c < 4; c++) rigFrom[i * 4 + c] = rigTo[i * 4 + c];
        }
        fromIsFigure = fromIsFigure || toIsFigure;
      } else {
        // settled: the old shape keeps its live animation (a closing mouth, a breath) while it departs
        aFrom.set(aTo);
        cFrom.set(cTo);
        rigFrom.set(rigTo);
        fromIsFigure = toIsFigure;
      }
      setDest(next);
      flagAttrs();
      tgtA.set(next.palette[0]);
      tgtB.set(next.palette[1]);
      mixStart = now;
      landed = false;
      uniforms.uMix.value = 0;
      jelly.kick(2.6);
    };

    const clock = new THREE.Clock();
    let t = 0;
    let raf = 0;
    let readyFired = false;
    let frameMsEma = 16;
    let frames = 0;
    let smoothEnergy = 0, sLow = 0, sMid = 0, sHigh = 0;
    const debug: OrbDebug = { frameMs: [], cpuMs: [], face: REST_FACE, shape: currentKey, figureOn: false, onsets: 0 };

    const render = () => {
      const cpuStart = window.__stayOrbDebug ? performance.now() : 0;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      t += dt;
      const L = live.current;
      const ease = (r: number) => 1 - Math.exp(-dt * r);
      const follow = (cur: number, to: number) => cur + (to - cur) * ease(to > cur ? 22 : 7);

      if (L.target.key !== currentKey) retarget(L.target, t);

      if (fadeDir !== 0) {
        if (fadeDir < 0) {
          fade = Math.max(0, fade - dt / FADE_OUT_SECONDS);
          if (fade <= 0 && pendingTarget) {
            swapNow(pendingTarget);
            pendingTarget = null;
            fadeDir = 1;
          }
        } else {
          fade = Math.min(1, fade + dt / FADE_IN_SECONDS);
          if (fade >= 1) fadeDir = 0;
        }
        uniforms.uFade.value = fade * fade * (3 - 2 * fade);
      }

      if (mixStart >= 0) {
        const p = (t - mixStart) / MORPH_SECONDS;
        if (!landed && p > 0.72) {
          landed = true;
          jelly.kick(-3.2); // most dots have arrived: the body settles with a wobble
        }
        if (p >= 1) {
          uniforms.uMix.value = 1;
          mixStart = -1;
          aFrom.set(aTo);
          cFrom.set(cTo);
          rigFrom.set(rigTo);
          fromIsFigure = toIsFigure;
          fromAttr.needsUpdate = true;
          colFromAttr.needsUpdate = true;
          rigFromAttr.needsUpdate = true;
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

      // the person: live mouth and ambient motion while she is (becoming or leaving) on screen
      const figureLive = toIsFigure || fromIsFigure;
      if (figureLive) {
        faceFrame = face.update({
          dt,
          time: t,
          speaking: L.state === 'speaking',
          listening: L.state === 'listening' || L.state === 'backchannel',
          fallbackLevel: smoothEnergy,
          reduced: reducedMotion,
        });
      } else if (faceFrame !== REST_FACE) {
        faceFrame = REST_FACE;
      }
      uniforms.uFaceA.value.set(faceFrame.open, faceFrame.wide, faceFrame.blink, faceFrame.brow);
      uniforms.uFaceB.value.set(faceFrame.tilt, faceFrame.nod, faceFrame.sway, faceFrame.breath);
      uniforms.uGaze.value.set(faceFrame.gazeX, faceFrame.gazeY);

      if (!reducedMotion) {
        uniforms.uTime.value = t;
        uniforms.uThink.value += (thinkTarget - uniforms.uThink.value) * ease(3);
        uniforms.uBreath.value += (preset.breath - uniforms.uBreath.value) * ease(3);
        sphereW += ((currentKey === 'orb' ? 1 : 0) - sphereW) * ease(2.2);
        figW += ((toIsFigure ? 1 : 0) - figW) * ease(2.4);
        spin += dt * 0.2 * sphereW;
        uniforms.uYaw.value = spin + Math.sin(t * 0.45) * (0.26 - 0.17 * figW) * (1 - sphereW);
        uniforms.uJelly.value = jelly.step(dt);
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

      if (window.__stayOrbDebug) {
        debug.frameMs.push(rawDt * 1000);
        debug.cpuMs.push(performance.now() - cpuStart);
        if (debug.frameMs.length > 1200) {
          debug.frameMs.shift();
          debug.cpuMs.shift();
        }
        debug.face = faceFrame;
        debug.shape = currentKey;
        debug.figureOn = toIsFigure;
        debug.onsets = face.onsets;
        window.__stayOrb = debug;
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
