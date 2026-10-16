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

interface StateColorConfig {
  coreColor: number;
  emissiveColor: number;
  rimColor: number;
  ambientColor: number;
  speed: number;
  baseAmp: number;
  energyScale: number;
  lightIntensity: number;
}

/**
 * Authentic ChatGPT Voice-style Chromatic Fluid Liquid Orb.
 * Seamless, iridescent, organic liquid plasma that breathes and reacts to human voice.
 */
const CHROMATIC_STATE_CONFIG: Record<VoiceVisualState, StateColorConfig> = {
  idle: {
    coreColor: 0x004d40,
    emissiveColor: 0x006a67,
    rimColor: 0x00f5d4,
    ambientColor: 0x002826,
    speed: 0.7,
    baseAmp: 0.035,
    energyScale: 0.15,
    lightIntensity: 1.8,
  },
  connecting: {
    coreColor: 0x1e293b,
    emissiveColor: 0x475569,
    rimColor: 0x94a3b8,
    ambientColor: 0x0f172a,
    speed: 1.3,
    baseAmp: 0.05,
    energyScale: 0.2,
    lightIntensity: 2.0,
  },
  listening: {
    // Vibrant electric cyan / deep teal with active liquid attention
    coreColor: 0x025a58,
    emissiveColor: 0x00a896,
    rimColor: 0x00f5d4,
    ambientColor: 0x003d3a,
    speed: 1.0,
    baseAmp: 0.065,
    energyScale: 0.55,
    lightIntensity: 2.8,
  },
  thinking: {
    // Deep iridescent celestial indigo & lavender nebula
    coreColor: 0x2e1065,
    emissiveColor: 0x6366f1,
    rimColor: 0xa855f7,
    ambientColor: 0x1e1b4b,
    speed: 1.8,
    baseAmp: 0.08,
    energyScale: 0.25,
    lightIntensity: 3.2,
  },
  speaking: {
    // Radiant living emerald / turquoise with acoustic soundwave ripples
    coreColor: 0x064e3b,
    emissiveColor: 0x059669,
    rimColor: 0x34d399,
    ambientColor: 0x022c22,
    speed: 1.3,
    baseAmp: 0.09,
    energyScale: 0.75,
    lightIntensity: 3.5,
  },
  interrupted: {
    // Soft warm amber settling smoothly
    coreColor: 0x7c2d12,
    emissiveColor: 0xd97706,
    rimColor: 0xfbbf24,
    ambientColor: 0x431407,
    speed: 0.6,
    baseAmp: 0.04,
    energyScale: 0.2,
    lightIntensity: 2.4,
  },
  backchannel: {
    // Warm conversational attunement (ChatGPT Voice "mm-hmm" cue)
    coreColor: 0x064e3b,
    emissiveColor: 0x10b981,
    rimColor: 0x6ee7b7,
    ambientColor: 0x064e3b,
    speed: 1.1,
    baseAmp: 0.07,
    energyScale: 0.45,
    lightIntensity: 3.0,
  },
  saving: {
    coreColor: 0x1e293b,
    emissiveColor: 0x475569,
    rimColor: 0x64748b,
    ambientColor: 0x0f172a,
    speed: 1.2,
    baseAmp: 0.04,
    energyScale: 0.15,
    lightIntensity: 1.8,
  },
  complete: {
    coreColor: 0x064e3b,
    emissiveColor: 0x10b981,
    rimColor: 0x86efac,
    ambientColor: 0x022c22,
    speed: 0.6,
    baseAmp: 0.04,
    energyScale: 0.15,
    lightIntensity: 2.2,
  },
  error: {
    coreColor: 0x7f1d1d,
    emissiveColor: 0xdc2626,
    rimColor: 0xfca5a5,
    ambientColor: 0x450a0a,
    speed: 0.5,
    baseAmp: 0.03,
    energyScale: 0.1,
    lightIntensity: 1.9,
  },
};

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

    // Ambient diffuse light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    // Internal Core Glow Light (illuminates fluid droplet from inside)
    const centerPointLight = new THREE.PointLight(0x00f5d4, 3.5, 9);
    centerPointLight.position.set(0, 0, 0);
    scene.add(centerPointLight);

    // Warm specular key light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(3, 4, 4);
    scene.add(keyLight);

    // Chromatic rim backlight
    const rimLight = new THREE.PointLight(0x38b2ac, 2.8, 8);
    rimLight.position.set(-3.5, -2.5, 2.5);
    scene.add(rimLight);

    // 1. Soft Ambient Bloom Halo (behind the orb)
    const auraGeo = new THREE.PlaneGeometry(5.2, 5.2);
    // Radial gradient texture created programmatically
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(0, 245, 212, 0.55)');
      grad.addColorStop(0.35, 'rgba(0, 106, 103, 0.28)');
      grad.addColorStop(0.7, 'rgba(0, 50, 48, 0.08)');
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

    // 2. Inner Undulating Luminous Core
    const coreGeo = new THREE.SphereGeometry(0.88, 48, 48);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x004d40,
      emissive: 0x006a67,
      emissiveIntensity: 1.4,
      roughness: 0.12,
      metalness: 0.1,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // 3. Outer Fluid Liquid Chromatic Droplet (ChatGPT AVM style)
    const sphereRadius = 1.38;
    const sphereGeo = new THREE.SphereGeometry(sphereRadius, 96, 96);
    const basePositions = (sphereGeo.attributes.position.array as Float32Array).slice();

    const fluidMat = new THREE.MeshPhysicalMaterial({
      color: 0x006a67,
      emissive: 0x002c29,
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transmission: 0.85,
      ior: 1.45,
      thickness: 1.8,
      iridescence: 0.95,
      iridescenceIOR: 1.33,
    });
    const fluidMesh = new THREE.Mesh(sphereGeo, fluidMat);
    scene.add(fluidMesh);

    let smoothEnergy = 0;
    let t = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const targetCore = new THREE.Color();
    const targetEmissive = new THREE.Color();
    const targetRim = new THREE.Color();

    const render = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const config = CHROMATIC_STATE_CONFIG[stateRef.current] || CHROMATIC_STATE_CONFIG.idle;
      smoothEnergy += (energyRef.current - smoothEnergy) * 0.18;

      // Color interpolation
      targetCore.setHex(config.coreColor);
      targetEmissive.setHex(config.emissiveColor);
      targetRim.setHex(config.rimColor);

      coreMat.color.lerp(targetCore, 0.08);
      coreMat.emissive.lerp(targetEmissive, 0.08);
      fluidMat.color.lerp(targetEmissive, 0.08);
      fluidMat.emissive.lerp(targetCore, 0.08);
      centerPointLight.color.lerp(targetRim, 0.08);
      rimLight.color.lerp(targetRim, 0.08);
      auraMat.color.lerp(targetRim, 0.08);

      centerPointLight.intensity = config.lightIntensity + smoothEnergy * 3.0;

      if (!reducedMotion) {
        t += dt * config.speed;

        // Smooth breathing & acoustic energy scale
        const breath = Math.sin(t * 1.1) * 0.035;
        const totalAmp = config.baseAmp + smoothEnergy * config.energyScale;

        // Fluid organic wave displacement across smooth spherical harmonics
        const pos = sphereGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < pos.length; i += 3) {
          const bx = basePositions[i];
          const by = basePositions[i + 1];
          const bz = basePositions[i + 2];

          // Normalized coordinates
          const nx = bx / sphereRadius;
          const ny = by / sphereRadius;
          const nz = bz / sphereRadius;

          // Continuous fluid wave equation (smooth surface tension ripples)
          const wave1 = Math.sin(nx * 2.4 + ny * 1.8 + t * 2.2);
          const wave2 = Math.cos(ny * 2.2 - nz * 2.0 + t * 1.7);
          const wave3 = Math.sin((nx + nz) * 2.8 + t * 2.6) * Math.cos(ny * 2.2);
          const ripple = (wave1 * 0.45 + wave2 * 0.35 + wave3 * 0.2) * totalAmp;

          const rScale = 1 + breath + ripple;
          pos[i] = bx * rScale;
          pos[i + 1] = by * rScale;
          pos[i + 2] = bz * rScale;
        }
        sphereGeo.attributes.position.needsUpdate = true;
        sphereGeo.computeVertexNormals();

        // Inner core breathing and subtle rotation
        const coreScale = 1 + Math.sin(t * 1.4) * 0.06 + smoothEnergy * 0.25;
        coreMesh.scale.set(coreScale, coreScale, coreScale);
        coreMesh.rotation.y = t * 0.35;
        coreMesh.rotation.x = Math.sin(t * 0.25) * 0.15;

        // Outer fluid rotation
        fluidMesh.rotation.y = -t * 0.2;
        fluidMesh.rotation.z = Math.sin(t * 0.15) * 0.1;

        // Ambient aura bloom pulse
        const auraScale = 1 + breath * 2.5 + smoothEnergy * 0.35;
        auraMesh.scale.set(auraScale, auraScale, 1);
        auraMat.opacity = 0.45 + smoothEnergy * 0.35;
      } else {
        // Serene translucent breathing pearl for reduced motion
        const calmBreath = 1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.025;
        coreMesh.scale.set(calmBreath, calmBreath, calmBreath);
        fluidMesh.scale.set(calmBreath, calmBreath, calmBreath);
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
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [reducedMotion, onUnsupported]);

  return <div ref={mountRef} className="h-full w-full select-none" aria-hidden="true" />;
}
