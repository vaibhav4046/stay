'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VoiceVisualState } from '@/types/domain';

interface Props {
  state: VoiceVisualState;
  energy: number;
  reducedMotion: boolean;
  onUnsupported: () => void;
}

interface CosmicPaletteConfig {
  primary: number;    // Upper wave nebula primary hue
  secondary: number;  // Upper wave deep space / abyss hue
  base: number;       // Lower fluid luminous creamy pearl hue
  core: number;       // Inner singularity intensity flare hue
  rim: number;        // Glass Fresnel boundary hue
  star: number;       // Twinkling celestial starlight hue
  speed: number;      // Fluid wave tempo
  waveAmp: number;    // Wave surge amplitude
}

/**
 * ChatGPT Voice-Style Undulating Fluid Wave Orb with Marvel 'Eternity' Cosmic Interior.
 * Combines the iconic dual-phase liquid horizon of ChatGPT AVM with deep cosmic intensity:
 * volumetric nebula, 3D twinkling stardust, and a blazing internal singularity core.
 */
const COSMIC_PALETTES: Record<VoiceVisualState, CosmicPaletteConfig> = {
  idle: {
    primary: 0x006a67,   // Deep oceanic teal
    secondary: 0x002826, // Cosmic midnight abyss
    base: 0xf0fdfa,      // Luminous pearl white
    core: 0x00f5d4,      // Electric cyan singularity
    rim: 0x5eead4,       // Mint aurora sheen
    star: 0xffffff,      // Pure starlight
    speed: 0.8,
    waveAmp: 0.08,
  },
  connecting: {
    primary: 0x475569,   // Celestial slate
    secondary: 0x0f172a, // Deep interstellar void
    base: 0xf8fafc,      // Moonlit silver pearl
    core: 0x94a3b8,      // Pulsing silver core
    rim: 0xcbd5e1,       // Silver reflection
    star: 0xe2e8f0,
    speed: 1.2,
    waveAmp: 0.10,
  },
  listening: {
    primary: 0x0284c7,   // Electric oceanic cyan
    secondary: 0x003d3a, // Deep abyss teal
    base: 0xf0fdfa,      // Luminous cream ivory
    core: 0x00f5d4,      // Radiant cyan singularity flare
    rim: 0x38bdf8,       // Vivid turquoise rim
    star: 0xe0f2fe,
    speed: 1.1,
    waveAmp: 0.14,
  },
  thinking: {
    primary: 0x7c3aed,   // Ultraviolet galactic nebula
    secondary: 0x1e1b4b, // Infinity deep cosmic purple
    base: 0xfaf5ff,      // Soft lavender pearl
    core: 0xc084fc,      // Radiant pulsar singularity
    rim: 0xa855f7,       // Ethereal amethyst rim
    star: 0xf3e8ff,
    speed: 1.7,
    waveAmp: 0.16,
  },
  speaking: {
    primary: 0x059669,   // Living aurora emerald
    secondary: 0x022c22, // Deep celestial forest void
    base: 0xfefce8,      // Warm golden creamy pearl
    core: 0x34d399,      // Radiant emerald star core
    rim: 0x6ee7b7,       // Mint prismatic rim
    star: 0xffffff,
    speed: 1.35,
    waveAmp: 0.18,
  },
  backchannel: {
    primary: 0x10b981,   // Attuned mint emerald
    secondary: 0x064e3b, // Deep jade void
    base: 0xf0fdf4,      // Fresh pearl
    core: 0x6ee7b7,      // Soft emerald pulse
    rim: 0xa7f3d0,       // Gentle mint halo
    star: 0xffffff,
    speed: 1.15,
    waveAmp: 0.12,
  },
  interrupted: {
    primary: 0xd97706,   // Warm celestial amber
    secondary: 0x431407, // Deep cosmic ember void
    base: 0xfffbeb,      // Warm cream pearl
    core: 0xfbbf24,      // Golden starlight flare
    rim: 0xfde68a,       // Amber glint
    star: 0xfef3c7,
    speed: 0.7,
    waveAmp: 0.09,
  },
  saving: {
    primary: 0x4f46e5,   // Twilight indigo nebula
    secondary: 0x1e1b4b, // Deep space
    base: 0xf8fafc,      // Silver pearl
    core: 0x818cf8,      // Starlight beacon
    rim: 0xc7d2fe,       // Ethereal sheen
    star: 0xffffff,
    speed: 1.1,
    waveAmp: 0.08,
  },
  complete: {
    primary: 0x10b981,   // Triumphant aurora emerald
    secondary: 0x022c22, // Deep cosmic void
    base: 0xecfdf5,      // Brilliant gold-tinted pearl
    core: 0x4ade80,      // Solar accomplishment flare
    rim: 0x86efac,       // Radiant mint rim
    star: 0xffffff,
    speed: 0.75,
    waveAmp: 0.09,
  },
  error: {
    primary: 0xdc2626,   // Deep nebula ruby
    secondary: 0x450a0a, // Abyssal crimson void
    base: 0xfef2f2,      // Blush pearl
    core: 0xf87171,      // Ember singularity
    rim: 0xfca5a5,       // Rose glint
    star: 0xffe4e6,
    speed: 0.6,
    waveAmp: 0.07,
  },
};

const VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uEnergy;
  uniform float uReducedMotion;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    
    // Subtle organic surface breathing
    float breath = uReducedMotion > 0.5 ? 0.0 : sin(uTime * 1.2) * 0.02;
    // Acoustic soundwave surface ripple on audio arrival
    float soundRipple = uReducedMotion > 0.5 ? 0.0 : uEnergy * 0.045 * sin(position.y * 5.0 + uTime * 7.0);
    vec3 displaced = position * (1.0 + breath + soundRipple);
    
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
  varying vec3 vViewPosition;
  varying vec2 vUv;

  uniform float uTime;
  uniform float uEnergy;
  uniform float uSpeed;
  uniform float uWaveAmp;
  uniform float uReducedMotion;

  uniform vec3 uColorPrimary;
  uniform vec3 uColorSecondary;
  uniform vec3 uColorBase;
  uniform vec3 uColorCore;
  uniform vec3 uColorRim;
  uniform vec3 uColorStar;

  // Cross-platform hash function without sine (Dave Hoskins)
  float hash31(vec3 p) {
    vec3 q = fract(p * vec3(443.8975, 397.2973, 491.1871));
    q += dot(q, q.yzx + 19.19);
    return fract((q.x + q.y) * q.z);
  }

  // 3D procedural continuous value noise
  float noise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), u.x),
          mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
      mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), u.x),
          mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
      u.z
    );
  }

  // 3-octave Fractional Brownian Motion for cosmic nebula
  float fbm(vec3 p) {
    float v = 0.0;
    v += 0.5000 * noise3D(p); p *= 2.02;
    v += 0.2500 * noise3D(p); p *= 2.03;
    v += 0.1250 * noise3D(p);
    return v;
  }

  void main() {
    vec3 pos = vPosition / 1.45; // Normalized to unit sphere coordinates
    float x = pos.x;
    float y = pos.y;
    float z = pos.z;
    float rDist = length(pos);

    // 1. ChatGPT-Style Fluid Wavy Interface
    float t = uTime * uSpeed;
    float tilt = x * 0.14; // Subtle natural diagonal slope

    // Primary undulating liquid swell
    float wave1 = sin(x * 3.1 + t * 2.0) * (uWaveAmp + uEnergy * 0.26);
    // Secondary counter-wave for rich fluid viscosity
    float wave2 = cos(x * 4.6 - z * 2.4 - t * 1.5) * (uWaveAmp * 0.65 + uEnergy * 0.16);

    // Fast acoustic harmonic ripples when voice energy arrives
    float harmonics = 0.0;
    if (uReducedMotion < 0.5) {
      harmonics = uEnergy * (
        0.08 * sin(x * 9.2 + t * 7.5) * cos(z * 5.5 - t * 5.0) +
        0.05 * sin(x * 15.0 - t * 11.0)
      );
    }

    float waveHorizon = tilt + wave1 + wave2 + harmonics;
    float distToWave = y - waveHorizon;

    // Fluid phase mixing factor (smooth transition between upper nebula & lower creamy pearl)
    float waveMask = smoothstep(-0.045, 0.045, distToWave);

    // Luminous starlight wave crest ribbon along the fluid interface
    float crestGlow = exp(-distToWave * distToWave * 160.0) * (0.6 + uEnergy * 1.5);

    // 2. Marvel 'Eternity' Cosmic Interior ("Carrying Intensity Inside")
    // Central radiant singularity star core
    float coreSingularity = 1.0 / (1.0 + rDist * rDist * 4.2);
    coreSingularity *= (1.3 + uEnergy * 2.7);

    // Swirling volumetric celestial nebula clouds
    vec3 nebulaCoords = pos * 2.2 + vec3(sin(uTime * 0.32), cos(uTime * 0.26), sin(uTime * 0.38)) * 0.35;
    float nebulaDensity = fbm(nebulaCoords);

    // 3D Twinkling Stardust & Celestial Stars (Eternity starry silhouette)
    vec3 starGrid = pos * 24.0;
    vec3 starCell = floor(starGrid);
    float starRand = hash31(starCell);
    float isStar = step(0.92, starRand);
    float twinkle = sin(starRand * 628.3 + uTime * (3.0 + uEnergy * 5.5)) * 0.5 + 0.5;
    float starGlint = isStar * pow(twinkle, 3.5) * (0.8 + uEnergy * 1.8);

    // Chromatic dispersion along the wave horizon (iridescent prismatic edge)
    float crestR = exp(-pow(distToWave - 0.012, 2.0) * 160.0);
    float crestG = exp(-pow(distToWave, 2.0) * 160.0);
    float crestB = exp(-pow(distToWave + 0.012, 2.0) * 160.0);
    vec3 chromaticCrest = vec3(crestR, crestG, crestB) * (0.6 + uEnergy * 1.4);

    // 3. Fluid Color Compositing
    // Upper Fluid: Cosmic Universe / Nebula (Eternity)
    vec3 topFluid = mix(uColorSecondary, uColorPrimary, nebulaDensity * 1.35);
    topFluid += uColorCore * coreSingularity * 0.7;
    topFluid += uColorStar * starGlint * 1.6;

    // Lower Fluid: ChatGPT Signature Luminous Ivory/Cream Pearl
    vec3 bottomFluid = uColorBase;
    bottomFluid = mix(bottomFluid, uColorPrimary, 0.22 * (1.0 - rDist));
    bottomFluid += uColorCore * coreSingularity * 0.45;
    bottomFluid += uColorStar * starGlint * 0.4;

    // Blend the two fluid phases across the undulating wave horizon
    vec3 interiorColor = mix(bottomFluid, topFluid, waveMask);

    // Add the glowing wave crest starlight ribbon
    interiorColor += chromaticCrest * mix(uColorStar, uColorPrimary, 0.35);

    // 4. Outer Glass Enclosure & Fresnel Specular Sheen
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPosition);
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, 2.6);

    // Dual specular key lights
    vec3 L1 = normalize(vec3(2.5, 3.8, 3.5));
    vec3 H1 = normalize(L1 + V);
    float spec1 = pow(max(dot(N, H1), 0.0), 40.0) * 0.85;

    vec3 L2 = normalize(vec3(-2.5, -2.0, 2.0));
    vec3 H2 = normalize(L2 + V);
    float spec2 = pow(max(dot(N, H2), 0.0), 24.0) * 0.35;

    vec3 finalColor = interiorColor;
    // Core radiant bloom from within
    finalColor += uColorCore * coreSingularity * (0.28 + uEnergy * 0.55);
    // Outer glass Fresnel rim
    finalColor += uColorRim * fresnel * (1.4 + uEnergy * 0.8);
    // Specular reflections
    finalColor += vec3(1.0) * (spec1 + spec2);

    gl_FragColor = vec4(finalColor, 0.95 + fresnel * 0.05);
  }
`;

export default function SignalScene({ state, energy, reducedMotion, onUnsupported }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const energyRef = useRef(energy);
  stateRef.current = state;
  energyRef.current = energy;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      onUnsupported();
      return;
    }

    const size = () => ({ w: mount.clientWidth || 320, h: mount.clientHeight || 320 });
    let { w, h } = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(0, 0, 5.8);

    // 1. Soft Ambient Bloom Halo (behind the orb)
    const auraGeo = new THREE.PlaneGeometry(5.4, 5.4);
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(0, 245, 212, 0.6)');
      grad.addColorStop(0.38, 'rgba(0, 106, 103, 0.25)');
      grad.addColorStop(0.72, 'rgba(0, 50, 48, 0.08)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
    }
    const auraTexture = new THREE.CanvasTexture(canvas);
    const auraMat = new THREE.MeshBasicMaterial({
      map: auraTexture,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.position.set(0, 0, -0.6);
    scene.add(auraMesh);

    // 2. High-precision 3D Cosmic Liquid Sphere
    const sphereRadius = 1.45;
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 96, 96);

    const initialConfig = COSMIC_PALETTES[stateRef.current] || COSMIC_PALETTES.idle;

    const uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
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
    let t = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const targetPrimary = new THREE.Color();
    const targetSecondary = new THREE.Color();
    const targetBase = new THREE.Color();
    const targetCore = new THREE.Color();
    const targetRim = new THREE.Color();
    const targetStar = new THREE.Color();

    const render = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const config = COSMIC_PALETTES[stateRef.current] || COSMIC_PALETTES.idle;
      smoothEnergy += (energyRef.current - smoothEnergy) * 0.18;

      // Color targets
      targetPrimary.setHex(config.primary);
      targetSecondary.setHex(config.secondary);
      targetBase.setHex(config.base);
      targetCore.setHex(config.core);
      targetRim.setHex(config.rim);
      targetStar.setHex(config.star);

      // Smooth color interpolation
      uniforms.uColorPrimary.value.lerp(targetPrimary, 0.08);
      uniforms.uColorSecondary.value.lerp(targetSecondary, 0.08);
      uniforms.uColorBase.value.lerp(targetBase, 0.08);
      uniforms.uColorCore.value.lerp(targetCore, 0.08);
      uniforms.uColorRim.value.lerp(targetRim, 0.08);
      uniforms.uColorStar.value.lerp(targetStar, 0.08);

      uniforms.uSpeed.value += (config.speed - uniforms.uSpeed.value) * 0.08;
      uniforms.uWaveAmp.value += (config.waveAmp - uniforms.uWaveAmp.value) * 0.08;
      uniforms.uEnergy.value = smoothEnergy;

      if (!reducedMotion) {
        t += dt;
        uniforms.uTime.value = t;

        // Subtle gentle rotation to give 3D celestial depth
        orbMesh.rotation.y = t * 0.12;
        orbMesh.rotation.z = Math.sin(t * 0.2) * 0.06;

        // Aura bloom response
        auraMat.color.lerp(targetRim, 0.08);
        const auraScale = 1 + Math.sin(t * 1.2) * 0.05 + smoothEnergy * 0.35;
        auraMesh.scale.set(auraScale, auraScale, 1);
        auraMat.opacity = 0.45 + smoothEnergy * 0.4;
      } else {
        uniforms.uTime.value = clock.getElapsedTime() * 0.4;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

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
  }, [reducedMotion, onUnsupported]);

  return <div ref={mountRef} className="h-full w-full select-none" aria-hidden="true" />;
}
