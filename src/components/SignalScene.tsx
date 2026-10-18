'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { AudioSpectrumBands, VoiceVisualState } from '@/types/domain';

interface Props {
  state: VoiceVisualState;
  energy: number;
  bands?: AudioSpectrumBands;
  topicShape?: number;
  reducedMotion: boolean;
  onUnsupported: () => void;
  /** Fired once, after the first frame has actually been drawn. */
  onReady?: () => void;
}

interface CosmicPaletteConfig {
  primary: number;    // Upper luminous glass primary hue
  secondary: number;  // Deep subsurface core hue
  base: number;       // Lower translucent silk pearl hue
  core: number;       // Inner radiant bloom hue
  rim: number;        // Apple VisionOS Fresnel specular rim hue
  star: number;       // Highlight sheen hue
  speed: number;      // Fluid tempo
  waveAmp: number;    // Harmonic amplitude
}

const COSMIC_PALETTES: Record<VoiceVisualState, CosmicPaletteConfig> = {
  idle: {
    primary: 0x006a67,
    secondary: 0x003331,
    base: 0x99f6e4,
    core: 0x2dd4bf,
    rim: 0xccfbf1,
    star: 0xffffff,
    speed: 0.75,
    waveAmp: 0.06,
  },
  connecting: {
    primary: 0x475569,
    secondary: 0x1e293b,
    base: 0xcbd5e1,
    core: 0x94a3b8,
    rim: 0xf1f5f9,
    star: 0xffffff,
    speed: 1.0,
    waveAmp: 0.08,
  },
  listening: {
    primary: 0x0284c7,
    secondary: 0x0c4a6e,
    base: 0x7dd3fc,
    core: 0x38bdf8,
    rim: 0xe0f2fe,
    star: 0xffffff,
    speed: 1.05,
    waveAmp: 0.11,
  },
  thinking: {
    primary: 0x6d28d9,
    secondary: 0x2e1065,
    base: 0xd8b4fe,
    core: 0xc084fc,
    rim: 0xf3e8ff,
    star: 0xffffff,
    speed: 1.4,
    waveAmp: 0.12,
  },
  speaking: {
    primary: 0x059669,
    secondary: 0x064e3b,
    base: 0x6ee7b7,
    core: 0x34d399,
    rim: 0xd1fae5,
    star: 0xffffff,
    speed: 1.25,
    waveAmp: 0.14,
  },
  backchannel: {
    primary: 0x0d9488,
    secondary: 0x115e59,
    base: 0x99f6e4,
    core: 0x5eead4,
    rim: 0xccfbf1,
    star: 0xffffff,
    speed: 1.0,
    waveAmp: 0.09,
  },
  interrupted: {
    primary: 0xd97706,
    secondary: 0x78350f,
    base: 0xfde68a,
    core: 0xfbbf24,
    rim: 0xfef3c7,
    star: 0xffffff,
    speed: 0.7,
    waveAmp: 0.07,
  },
  saving: {
    primary: 0x4f46e5,
    secondary: 0x1e1b4b,
    base: 0xc7d2fe,
    core: 0x818cf8,
    rim: 0xe0e7ff,
    star: 0xffffff,
    speed: 0.95,
    waveAmp: 0.07,
  },
  complete: {
    primary: 0x10b981,
    secondary: 0x064e3b,
    base: 0xa7f3d0,
    core: 0x4ade80,
    rim: 0xd1fae5,
    star: 0xffffff,
    speed: 0.7,
    waveAmp: 0.07,
  },
  error: {
    primary: 0xdc2626,
    secondary: 0x7f1d1d,
    base: 0xfca5a5,
    core: 0xf87171,
    rim: 0xfee2e2,
    star: 0xffffff,
    speed: 0.6,
    waveAmp: 0.06,
  },
};

const VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vUnitDir;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uEnergy;
  uniform float uLowBand;
  uniform float uMidBand;
  uniform float uHighBand;
  uniform float uW0;
  uniform float uW1;
  uniform float uW2;
  uniform float uW3;
  uniform float uW4;
  uniform float uReducedMotion;

  // Evaluates clean, sculpted 3D parametric position for a given unit direction d
  vec3 evaluateSculptedPos(vec3 d, float baseRadius) {
    float angleXY = atan(d.y, d.x);
    float angleXZ = atan(d.z, d.x);
    float xyLen = length(d.xy);

    // 0: Smooth Apple Siri Harmonic Silk Sphere
    float r0 = 1.0 + 0.025 * sin(d.x * 3.0 + uTime * 1.6) * cos(d.y * 3.0 - uTime * 1.3);
    vec3 p0 = d * (baseRadius * r0);

    // 1: Sculpted Ice Cream Cone & Soft-Serve Swirl Dome
    vec3 p1 = d * baseRadius;
    if (d.y < -0.08) {
      // Taper lower hemisphere into a crisp V-cone toward the bottom vertex
      float tCone = clamp((-0.08 - d.y) / 0.92, 0.0, 1.0);
      float taper = mix(0.84, 0.08, pow(tCone, 0.88));
      p1.x *= taper;
      p1.z *= taper;
      p1.y = baseRadius * (-0.08 - tCone * 1.12);
    } else {
      // Sculpted 3-tier soft-serve scoop dome
      float h = clamp((d.y + 0.08) / 1.08, 0.0, 1.0);
      float tierScallop = 0.08 * cos(h * 9.42) + 0.03 * sin(angleXZ * 4.0 + h * 6.0 - uTime * 2.0);
      float widthProfile = mix(0.95, 0.55, pow(h, 1.35)) + tierScallop * (1.0 - h * 0.5);
      p1.x = d.x * baseRadius * widthProfile / max(length(d.xz), 0.28);
      p1.z = d.z * baseRadius * widthProfile / max(length(d.xz), 0.28);
      // Smooth blend near pole
      p1.xz = mix(d.xz * baseRadius * (0.98 + tierScallop), p1.xz, smoothstep(0.0, 0.45, length(d.xz)));
      p1.y = baseRadius * (-0.08 + h * 1.08);
    }

    // 2: Precision Chamfered Octagonal Crystalline Gem
    float l1 = (abs(d.x) + abs(d.y) + abs(d.z));
    float lInf = max(max(abs(d.x), abs(d.y)), abs(d.z));
    float crystalR = mix(1.0, 1.18 / max(mix(l1 * 0.66, lInf, 0.42), 0.65), 0.58);
    vec3 p2 = d * (baseRadius * crystalR);
    p2.y *= 1.06;

    // 3: 5-Fold Harmonic Rose / Apple Silk Star Sculpture
    float rose5 = 0.5 + 0.5 * cos(angleXY * 5.0 - uTime * 0.6);
    float r3 = 0.84 + 0.28 * pow(rose5, 0.78) * pow(xyLen, 0.65);
    vec3 p3 = d * (baseRadius * r3);

    // 4: Sacred 8-Petal Botanical Lotus Blossom
    float lotus8 = abs(cos(angleXY * 4.0 + uTime * 0.3));
    float r4 = 0.85 + 0.26 * pow(lotus8, 0.62) * pow(xyLen, 0.65);
    vec3 p4 = d * (baseRadius * r4);

    return uW0 * p0 + uW1 * p1 + uW2 * p2 + uW3 * p3 + uW4 * p4;
  }

  void main() {
    vUv = uv;
    float baseR = length(position);
    vec3 d = normalize(position);
    vUnitDir = d;

    vec3 sculpted = evaluateSculptedPos(d, baseR);

    // Compute smooth analytical finite-difference normal on the unit sphere so lighting is never distorted
    vec3 tangent = normalize(abs(d.y) > 0.99 ? cross(d, vec3(1.0, 0.0, 0.0)) : cross(d, vec3(0.0, 1.0, 0.0)));
    vec3 bitangent = normalize(cross(d, tangent));
    float eps = 0.025;
    vec3 dT = normalize(d + tangent * eps);
    vec3 dB = normalize(d + bitangent * eps);
    vec3 pT = evaluateSculptedPos(dT, baseR);
    vec3 pB = evaluateSculptedPos(dB, baseR);
    vec3 calcNormal = normalize(cross(pB - sculpted, pT - sculpted));
    if (dot(calcNormal, d) < 0.0) {
      calcNormal = -calcNormal;
    }

    // Gentle acoustic voice breathing
    float breath = uReducedMotion > 0.5 ? 0.0 : sin(uTime * 1.4) * 0.018;
    float voicePulse = uReducedMotion > 0.5 ? 0.0 : (uEnergy * 0.06 + uLowBand * 0.045) * sin(d.y * 3.0 + uTime * 3.5);
    vec3 displaced = sculpted * (1.0 + breath + voicePulse);

    vNormal = normalize(normalMatrix * mix(d, calcNormal, 0.72));
    vPosition = displaced;
    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vUnitDir;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uEnergy;
  uniform float uLowBand;
  uniform float uMidBand;
  uniform float uHighBand;
  uniform float uW0;
  uniform float uW1;
  uniform float uW2;
  uniform float uW3;
  uniform float uW4;
  uniform float uSpeed;
  uniform float uWaveAmp;

  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorBase;
  uniform vec3 uColorCore;
  uniform vec3 uColorRim;
  uniform vec3 uColorStar;

  void main() {
    vec3 d = normalize(vUnitDir);
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);
    float NdotV = max(dot(N, V), 0.0);

    // Smooth Apple Siri / VisionOS Iridescent Silk Gradient (NO harsh horizontal bleach cut!)
    float t = uTime * uSpeed;
    float silkWave = 0.5 + 0.5 * sin(d.y * 2.4 + d.x * 1.6 + sin(d.z * 2.2 + t * 1.1));
    float verticalGrad = smoothstep(-0.85, 0.85, d.y + 0.12 * sin(d.x * 3.0 + t * 1.4));

    vec3 baseGradient = mix(uColorBase, uColorPrimary, verticalGrad);
    baseGradient = mix(baseGradient, uColorSecondary, (1.0 - silkWave) * 0.42);

    // Mode 1 Special Shading: Golden Toasted Waffle Cone Base + Creamy Strawberry Soft-Serve Top
    if (uW1 > 0.01) {
      float coneMask = 1.0 - smoothstep(-0.14, 0.02, d.y);
      float angleXZ = atan(d.z, d.x);
      float lattice = 0.5 + 0.5 * sin(angleXZ * 10.0 + d.y * 16.0) * sin(angleXZ * 10.0 - d.y * 16.0);
      vec3 waffleColor = mix(vec3(0.78, 0.45, 0.08), vec3(0.98, 0.82, 0.42), lattice);

      float swirlBand = 0.5 + 0.5 * sin(angleXZ * 3.0 + d.y * 7.0 - t * 1.6);
      vec3 scoopColor = mix(vec3(0.96, 0.32, 0.52), vec3(1.0, 0.92, 0.95), swirlBand * 0.78);
      // Ruby cherry accent at top crown
      float cherryMask = smoothstep(0.84, 0.94, d.y);
      scoopColor = mix(scoopColor, vec3(0.88, 0.08, 0.24), cherryMask);

      vec3 iceCreamCol = mix(scoopColor, waffleColor, coneMask);
      baseGradient = mix(baseGradient, iceCreamCol, uW1 * 0.9);
    }

    // Mode 2 Special Shading: Cut-Sapphire Crystal Prism Sheen
    if (uW2 > 0.01) {
      float facetBand = 0.5 + 0.5 * cos((abs(d.x) + abs(d.y) + abs(d.z)) * 10.0 - t * 1.2);
      vec3 crystalCol = mix(vec3(0.06, 0.32, 0.78), vec3(0.68, 0.91, 1.0), facetBand * 0.65);
      baseGradient = mix(baseGradient, crystalCol, uW2 * 0.65);
    }

    // Mode 4 Special Shading: Warm Golden Lotus Stamen Core + Translucent Jade Petals
    if (uW4 > 0.01) {
      float centerGlow = exp(-dot(d.xy, d.xy) * 5.5);
      vec3 lotusCore = vec3(0.99, 0.91, 0.52);
      baseGradient = mix(baseGradient, lotusCore, uW4 * centerGlow * 0.65);
    }

    // Studio Three-Point Specular & Subsurface Lighting (Apple Industrial Design Look)
    vec3 L1 = normalize(vec3(2.2, 3.4, 3.8));
    vec3 H1 = normalize(L1 + V);
    float diff1 = max(dot(N, L1), 0.0);
    float spec1 = pow(max(dot(N, H1), 0.0), 48.0) * 0.75;

    vec3 L2 = normalize(vec3(-2.6, -1.8, 2.4));
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(dot(N, H2), 0.0), 24.0) * 0.32;

    float fresnel = pow(1.0 - NdotV, 2.4);

    vec3 finalColor = baseGradient * (0.76 + 0.28 * diff1);
    finalColor += uColorCore * (0.22 + uEnergy * 0.45) * (1.0 - fresnel * 0.5);
    finalColor += uColorRim * fresnel * (0.95 + uEnergy * 0.5);
    finalColor += uColorStar * (spec1 + spec2);

    gl_FragColor = vec4(finalColor, 0.94 + fresnel * 0.06);
  }
`;

export default function SignalScene({ state, energy, bands, topicShape = 0, reducedMotion, onUnsupported, onReady }: Props) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const energyRef = useRef(energy);
  const bandsRef = useRef(bands);
  const topicShapeRef = useRef(topicShape);
  const onUnsupportedRef = useRef(onUnsupported);
  onUnsupportedRef.current = onUnsupported;
  stateRef.current = state;
  energyRef.current = energy;
  bandsRef.current = bands;
  topicShapeRef.current = topicShape;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    while (mount.firstChild) {
      mount.removeChild(mount.firstChild);
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      onUnsupportedRef.current();
      return;
    }
    const onContextLost = (e: Event) => {
      e.preventDefault();
      onUnsupportedRef.current();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    // The orb is a sphere: always render a square, sized by the narrower side (a stale canvas height must not stretch it).
    const size = () => {
      const w = mount.clientWidth || 320;
      const side = Math.min(w, mount.clientHeight || w);
      return { w: side, h: side };
    };
    let { w, h } = size();
    let dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.outline = 'none';
    renderer.domElement.style.userSelect = 'none';
    (renderer.domElement.style as unknown as { webkitTapHighlightColor: string }).webkitTapHighlightColor = 'transparent';
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    camera.position.set(0, 0, 5.8);

    // 1. Soft Ambient Bloom Halo
    const auraGeo = new THREE.PlaneGeometry(4.2, 4.2);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 56);
      grad.addColorStop(0, 'rgba(45, 212, 191, 0.5)');
      grad.addColorStop(0.45, 'rgba(0, 106, 103, 0.2)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const auraTexture = new THREE.CanvasTexture(canvas);
    const auraMat = new THREE.MeshBasicMaterial({
      map: auraTexture,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.position.set(0, 0, -0.6);
    scene.add(auraMesh);

    // 2. High-precision 3D Parametric Glass Sculpture
    const sphereRadius = 1.42;
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 96, 96);

    const initialConfig = COSMIC_PALETTES[stateRef.current] || COSMIC_PALETTES.idle;
    const initShape = topicShapeRef.current || 0;

    const uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uLowBand: { value: 0 },
      uMidBand: { value: 0 },
      uHighBand: { value: 0 },
      uW0: { value: initShape === 0 ? 1 : 0 },
      uW1: { value: initShape === 1 ? 1 : 0 },
      uW2: { value: initShape === 2 ? 1 : 0 },
      uW3: { value: initShape === 3 ? 1 : 0 },
      uW4: { value: initShape === 4 ? 1 : 0 },
      uSpeed: { value: initialConfig.speed },
      uWaveAmp: { value: initialConfig.waveAmp },
      uReducedMotion: { value: reducedMotion ? 1.0 : 0.0 },
      uColorPrimary: { value: new THREE.Color(initialConfig.primary) },
      uColorSecondary: { value: new THREE.Color(initialConfig.secondary) },
      uColorBase: { value: new THREE.Color(initialConfig.base) },
      uColorCore: { value: new THREE.Color(initialConfig.core) },
      uColorRim: { value: new THREE.Color(initialConfig.rim) },
      uColorStar: { value: new THREE.Color(initialConfig.star) },
    };

    const shaderMat = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      depthWrite: true,
    });

    const orbMesh = new THREE.Mesh(sphereGeo, shaderMat);
    scene.add(orbMesh);

    let smoothEnergy = 0;
    let smoothLow = 0;
    let smoothMid = 0;
    let smoothHigh = 0;
    const weights = [
      initShape === 0 ? 1 : 0,
      initShape === 1 ? 1 : 0,
      initShape === 2 ? 1 : 0,
      initShape === 3 ? 1 : 0,
      initShape === 4 ? 1 : 0,
    ];
    // Critically damped spring state per shape weight: smooth ease-in/out, no overshoot.
    const weightVel = [0, 0, 0, 0, 0];
    let t = 0;
    let raf = 0;
    let readyFired = false;
    let frameMsEma = 16;
    let framesSinceCheck = 0;
    const clock = new THREE.Clock();

    const targetPrimary = new THREE.Color();
    const targetSecondary = new THREE.Color();
    const targetBase = new THREE.Color();
    const targetCore = new THREE.Color();
    const targetRim = new THREE.Color();
    const targetStar = new THREE.Color();

    const TOPIC_PALETTE_OVERRIDES: Record<number, Partial<CosmicPaletteConfig>> = {
      1: {
        primary: 0xe11d48,
        secondary: 0x881337,
        base: 0xfde68a,
        core: 0xfb7185,
        rim: 0xffe4e6,
      },
      2: {
        primary: 0x0071e3,
        secondary: 0x1e3a8a,
        base: 0x7dd3fc,
        core: 0x38bdf8,
        rim: 0xe0f2fe,
      },
      3: {
        primary: 0x7c3aed,
        secondary: 0x3b0764,
        base: 0xf0abfc,
        core: 0xe879f9,
        rim: 0xfdf4ff,
      },
      4: {
        primary: 0x0d9488,
        secondary: 0x115e59,
        base: 0x99f6e4,
        core: 0x5eead4,
        rim: 0xccfbf1,
      },
    };

    const render = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      // Frame-rate independent easing: same feel at 30, 60 or 144 Hz, and stable across hitches.
      const ease = (rate: number) => 1 - Math.exp(-dt * rate);
      // Fast attack when sound arrives, slower release so the shape settles instead of snapping.
      const follow = (cur: number, target: number) => cur + (target - cur) * ease(target > cur ? 22 : 7);
      const activeShape = topicShapeRef.current || 0;
      const baseConfig = COSMIC_PALETTES[stateRef.current] || COSMIC_PALETTES.idle;
      const shapeOverride = (activeShape && TOPIC_PALETTE_OVERRIDES[activeShape]) || {};
      const config = { ...baseConfig, ...shapeOverride };
      smoothEnergy = follow(smoothEnergy, energyRef.current);

      // Shape morph: critically damped spring (omega 8 => ~0.6 s settle, no overshoot).
      const omega = 8;
      let weightSum = 0;
      for (let i = 0; i < 5; i++) {
        const targetW = activeShape === i ? 1.0 : 0.0;
        const accel = (targetW - weights[i]) * omega * omega - 2 * omega * weightVel[i];
        weightVel[i] += accel * dt;
        weights[i] = Math.min(1, Math.max(0, weights[i] + weightVel[i] * dt));
        weightSum += weights[i];
      }
      if (weightSum > 0.0001) {
        uniforms.uW0.value = weights[0] / weightSum;
        uniforms.uW1.value = weights[1] / weightSum;
        uniforms.uW2.value = weights[2] / weightSum;
        uniforms.uW3.value = weights[3] / weightSum;
        uniforms.uW4.value = weights[4] / weightSum;
      }

      const curBands = bandsRef.current;
      const targetLow = curBands ? curBands.low : smoothEnergy * 0.85;
      const targetMid = curBands ? curBands.mid : smoothEnergy * 0.65;
      const targetHigh = curBands ? curBands.high : smoothEnergy * 0.45;

      smoothLow = follow(smoothLow, targetLow);
      smoothMid = follow(smoothMid, targetMid);
      smoothHigh = follow(smoothHigh, targetHigh);

      targetPrimary.setHex(config.primary);
      targetSecondary.setHex(config.secondary);
      targetBase.setHex(config.base);
      targetCore.setHex(config.core);
      targetRim.setHex(config.rim);
      targetStar.setHex(config.star);

      const colorK = ease(5);
      uniforms.uColorPrimary.value.lerp(targetPrimary, colorK);
      uniforms.uColorSecondary.value.lerp(targetSecondary, colorK);
      uniforms.uColorBase.value.lerp(targetBase, colorK);
      uniforms.uColorCore.value.lerp(targetCore, colorK);
      uniforms.uColorRim.value.lerp(targetRim, colorK);
      uniforms.uColorStar.value.lerp(targetStar, colorK);

      uniforms.uSpeed.value += (config.speed - uniforms.uSpeed.value) * ease(4);
      uniforms.uWaveAmp.value += (config.waveAmp - uniforms.uWaveAmp.value) * ease(4);
      uniforms.uEnergy.value = smoothEnergy;
      uniforms.uLowBand.value = smoothLow;
      uniforms.uMidBand.value = smoothMid;
      uniforms.uHighBand.value = smoothHigh;

      if (!reducedMotion) {
        t += dt;
        uniforms.uTime.value = t;

        // Keep orientation steady and front-facing when morphed so silhouette aligns with parametric vector overlay
        const rotDecay = activeShape === 0 ? 1.0 : 0.18;
        orbMesh.rotation.y = Math.sin(t * 0.35) * 0.12 * rotDecay;
        orbMesh.rotation.z = Math.sin(t * 0.25) * 0.04 * rotDecay;

        auraMat.color.lerp(targetRim, ease(4));
        const auraScale = 1 + Math.sin(t * 1.2) * 0.04 + (smoothEnergy + smoothLow * 0.5) * 0.3;
        auraMesh.scale.set(auraScale, auraScale, 1);
        auraMat.opacity = 0.42 + smoothEnergy * 0.35;
      } else {
        uniforms.uTime.value = clock.getElapsedTime() * 0.4;
      }

      renderer.render(scene, camera);
      if (!readyFired) {
        readyFired = true;
        onReadyRef.current?.();
      }

      // Adaptive resolution: if frames run long for ~1.5 s, step the pixel ratio down once per check.
      frameMsEma += (dt * 1000 - frameMsEma) * 0.1;
      if (++framesSinceCheck >= 90) {
        framesSinceCheck = 0;
        if (frameMsEma > 26 && dpr > 1) {
          dpr = Math.max(1, dpr - 0.5);
          renderer.setPixelRatio(dpr);
          renderer.setSize(mount.clientWidth || 320, mount.clientHeight || 320);
        }
      }
      raf = requestAnimationFrame(render);
    };

    // Only animate while on screen and the tab is visible (saves battery, avoids a huge catch-up dt on return).
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

    render();

    const ro = new ResizeObserver(() => {
      const { w, h } = size();
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      io.disconnect();
      ro.disconnect();
      auraTexture.dispose();
      auraGeo.dispose();
      auraMat.dispose();
      sphereGeo.dispose();
      shaderMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [reducedMotion]);

  return (
    <div
      ref={mountRef}
      className="h-full w-full select-none outline-none"
      style={{ WebkitTapHighlightColor: 'transparent' }}
      aria-hidden="true"
    />
  );
}
