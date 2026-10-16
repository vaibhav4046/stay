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
  membraneColor: number;
  haloColor: number;
  lightIntensity: number;
  speed: number;
  noiseAmp: number;
}

const ORB_STATE_CONFIG: Record<VoiceVisualState, StateColorConfig> = {
  idle: {
    coreColor: 0x004d40,
    membraneColor: 0x006a67,
    haloColor: 0x38b2ac,
    lightIntensity: 1.4,
    speed: 0.6,
    noiseAmp: 0.08,
  },
  connecting: {
    coreColor: 0x334155,
    membraneColor: 0x64748b,
    haloColor: 0x94a3b8,
    lightIntensity: 1.8,
    speed: 1.4,
    noiseAmp: 0.12,
  },
  listening: {
    coreColor: 0x005f5b,
    membraneColor: 0x028090,
    haloColor: 0x00f5d4,
    lightIntensity: 2.2,
    speed: 0.9,
    noiseAmp: 0.16,
  },
  thinking: {
    coreColor: 0x312e81,
    membraneColor: 0x4338ca,
    haloColor: 0x818cf8,
    lightIntensity: 2.6,
    speed: 2.0,
    noiseAmp: 0.14,
  },
  speaking: {
    coreColor: 0x005f5b,
    membraneColor: 0x008080,
    haloColor: 0x70e000,
    lightIntensity: 2.8,
    speed: 1.2,
    noiseAmp: 0.22,
  },
  interrupted: {
    coreColor: 0x78350f,
    membraneColor: 0xb45309,
    haloColor: 0xfbbf24,
    lightIntensity: 2.4,
    speed: 0.5,
    noiseAmp: 0.06,
  },
  backchannel: {
    coreColor: 0x064e3b,
    membraneColor: 0x059669,
    haloColor: 0x34d399,
    lightIntensity: 2.5,
    speed: 1.1,
    noiseAmp: 0.18,
  },
  saving: {
    coreColor: 0x1f2937,
    membraneColor: 0x4b5563,
    haloColor: 0x9ca3af,
    lightIntensity: 1.6,
    speed: 1.5,
    noiseAmp: 0.08,
  },
  complete: {
    coreColor: 0x14532d,
    membraneColor: 0x16a34a,
    haloColor: 0x86efac,
    lightIntensity: 2.0,
    speed: 0.5,
    noiseAmp: 0.07,
  },
  error: {
    coreColor: 0x7f1d1d,
    membraneColor: 0xdc2626,
    haloColor: 0xfca5a5,
    lightIntensity: 1.8,
    speed: 0.4,
    noiseAmp: 0.05,
  },
};

/**
 * 3D Luminous Living Orb.
 * Features:
 * - Fluid organic noise-displaced outer membrane responding in real-time to voice energy
 * - Luminous pulsing crystalline inner core
 * - Orbital chromatic energy rings with gyroscopic rotation
 * - Ambient orbiting stardust swarm
 * - Accessible graceful fallback for reduced motion
 */
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
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      onUnsupported();
      return;
    }

    const size = () => ({ w: mount.clientWidth || 320, h: mount.clientHeight || 320 });
    let { w, h } = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(0, 0, 6.2);

    // Dynamic point lights that orbit the Orb
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const coreLight = new THREE.PointLight(0x006a67, 3, 10);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    keyLight.position.set(4, 5, 4);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x38b2ac, 2.5, 8);
    rimLight.position.set(-3, -2, 3);
    scene.add(rimLight);

    // 1. Inner Luminous Core
    const coreGeo = new THREE.SphereGeometry(0.82, 48, 48);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x004d40,
      emissive: 0x006a67,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.2,
      wireframe: false,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    scene.add(coreMesh);

    // 2. Outer Fluid Organic Membrane with noise displacement
    const membraneGeo = new THREE.IcosahedronGeometry(1.35, 26);
    const basePositions = (membraneGeo.attributes.position.array as Float32Array).slice();
    const membraneMat = new THREE.MeshPhysicalMaterial({
      color: 0x006a67,
      emissive: 0x00332c,
      emissiveIntensity: 0.35,
      roughness: 0.25,
      metalness: 0.3,
      transparent: true,
      opacity: 0.78,
      clearcoat: 0.85,
      clearcoatRoughness: 0.2,
      transmission: 0.45,
      ior: 1.35,
    });
    const membraneMesh = new THREE.Mesh(membraneGeo, membraneMat);
    scene.add(membraneMesh);

    // 3. Orbital Energy Halos (Twin gyroscopic rings)
    const haloGeoA = new THREE.TorusGeometry(1.82, 0.016, 16, 120);
    const haloMatA = new THREE.MeshStandardMaterial({
      color: 0x38b2ac,
      emissive: 0x006a67,
      emissiveIntensity: 1.2,
      roughness: 0.3,
    });
    const haloMeshA = new THREE.Mesh(haloGeoA, haloMatA);
    haloMeshA.rotation.x = Math.PI / 4;
    scene.add(haloMeshA);

    const haloGeoB = new THREE.TorusGeometry(2.05, 0.012, 16, 120);
    const haloMatB = new THREE.MeshStandardMaterial({
      color: 0x00f5d4,
      emissive: 0x004d40,
      emissiveIntensity: 0.9,
      roughness: 0.4,
    });
    const haloMeshB = new THREE.Mesh(haloGeoB, haloMatB);
    haloMeshB.rotation.y = Math.PI / 3;
    haloMeshB.rotation.z = Math.PI / 6;
    scene.add(haloMeshB);

    // 4. Ethereal Stardust Swarm (100 particles)
    const particleCount = 100;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleOriginals = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      const radius = 1.6 + Math.random() * 1.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const px = radius * Math.sin(phi) * Math.cos(theta);
      const py = radius * Math.sin(phi) * Math.sin(theta);
      const pz = radius * Math.cos(phi);
      particlePositions[i] = px;
      particlePositions[i + 1] = py;
      particlePositions[i + 2] = pz;
      particleOriginals[i] = px;
      particleOriginals[i + 1] = py;
      particleOriginals[i + 2] = pz;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38b2ac,
      size: 0.045,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    let smoothEnergy = 0;
    let t = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const targetCore = new THREE.Color();
    const targetMembrane = new THREE.Color();
    const targetHalo = new THREE.Color();

    const render = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const config = ORB_STATE_CONFIG[stateRef.current] || ORB_STATE_CONFIG.idle;
      smoothEnergy += (energyRef.current - smoothEnergy) * 0.15;

      // Color interpolation across all layers
      targetCore.setHex(config.coreColor);
      targetMembrane.setHex(config.membraneColor);
      targetHalo.setHex(config.haloColor);

      coreMat.color.lerp(targetCore, 0.08);
      coreMat.emissive.lerp(targetHalo, 0.08);
      membraneMat.color.lerp(targetMembrane, 0.08);
      haloMatA.color.lerp(targetHalo, 0.08);
      haloMatB.color.lerp(targetHalo, 0.08);
      particleMat.color.lerp(targetHalo, 0.08);
      coreLight.color.lerp(targetHalo, 0.08);
      coreLight.intensity = config.lightIntensity + smoothEnergy * 2.2;

      if (!reducedMotion) {
        t += dt * config.speed;

        // Dynamic 3-octave fluid noise displacement on outer membrane
        const pos = membraneGeo.attributes.position.array as Float32Array;
        const totalAmp = config.noiseAmp + smoothEnergy * 0.35;

        for (let i = 0; i < pos.length; i += 3) {
          const bx = basePositions[i];
          const by = basePositions[i + 1];
          const bz = basePositions[i + 2];

          // Normalized spherical coordinates
          const nx = bx / 1.35;
          const ny = by / 1.35;
          const nz = bz / 1.35;

          const n1 = Math.sin(nx * 3.2 + t * 2.5) * Math.cos(ny * 3.2 + t * 1.9);
          const n2 = Math.sin(nz * 4.0 - t * 1.7) * Math.cos(nx * 2.5 + t * 1.3);
          const n3 = Math.sin((nx + ny + nz) * 5.0 + t * 3.1);

          const displacement = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2) * totalAmp;
          const scale = 1 + displacement / 1.35;

          pos[i] = bx * scale;
          pos[i + 1] = by * scale;
          pos[i + 2] = bz * scale;
        }
        membraneGeo.attributes.position.needsUpdate = true;

        // Core breathing & gentle rotation
        const coreScale = 1 + Math.sin(t * 1.5) * 0.04 + smoothEnergy * 0.22;
        coreMesh.scale.set(coreScale, coreScale, coreScale);
        coreMesh.rotation.y = t * 0.4;
        coreMesh.rotation.x = Math.sin(t * 0.3) * 0.15;

        membraneMesh.rotation.y = -t * 0.25;
        membraneMesh.rotation.z = Math.sin(t * 0.2) * 0.12;

        // Gyroscopic halo spin
        haloMeshA.rotation.z = t * 0.5;
        haloMeshA.rotation.x = Math.PI / 4 + Math.sin(t * 0.4) * 0.15;
        haloMeshB.rotation.y = t * 0.4;
        haloMeshB.rotation.z = Math.PI / 6 + Math.cos(t * 0.3) * 0.18;

        // Orbiting particle swarm
        const pArray = particleGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < particleCount * 3; i += 3) {
          const ox = particleOriginals[i];
          const oy = particleOriginals[i + 1];
          const oz = particleOriginals[i + 2];
          const angle = t * 0.25 + i * 0.02;
          pArray[i] = ox * Math.cos(angle) - oz * Math.sin(angle);
          pArray[i + 1] = oy + Math.sin(t * 1.2 + i) * 0.1 * (1 + smoothEnergy);
          pArray[i + 2] = ox * Math.sin(angle) + oz * Math.cos(angle);
        }
        particleGeo.attributes.position.needsUpdate = true;
      } else {
        // Reduced motion: serene smooth breathing
        const calmBreath = 1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.03;
        coreMesh.scale.set(calmBreath, calmBreath, calmBreath);
        membraneMesh.scale.set(calmBreath, calmBreath, calmBreath);
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    render();

    const ro = new ResizeObserver(() => {
      ({ w, h } = size());
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
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

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
