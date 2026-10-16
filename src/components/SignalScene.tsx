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

const STATE_TUNING: Record<VoiceVisualState, { speed: number; amp: number; color: number }> = {
  idle: { speed: 0.25, amp: 0.04, color: 0x006a67 },
  connecting: { speed: 0.9, amp: 0.06, color: 0x626b66 },
  listening: { speed: 0.45, amp: 0.1, color: 0x006a67 },
  thinking: { speed: 1.3, amp: 0.07, color: 0x3c7f7c },
  speaking: { speed: 0.7, amp: 0.16, color: 0x006a67 },
  interrupted: { speed: 0.2, amp: 0.03, color: 0x9a6318 },
  saving: { speed: 1.0, amp: 0.05, color: 0x626b66 },
  complete: { speed: 0.2, amp: 0.05, color: 0x236b48 },
  error: { speed: 0.1, amp: 0.02, color: 0xb23a2e },
};

/**
 * Stay Signal: a matte mineral ring assembly. A primary torus breathes with
 * audio energy, an inner offset ring tracks state, and a horizon bar stays still
 * as the visual anchor (mirrors the Stay mark).
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
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onUnsupported();
      return;
    }

    const size = () => ({ w: mount.clientWidth || 320, h: mount.clientHeight || 320 });
    let { w, h } = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(0, 0, 7);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe9e6df, 1.1));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.4);
    key.position.set(3, 4, 5);
    scene.add(key);

    const outerGeo = new THREE.TorusGeometry(1.55, 0.13, 48, 220);
    const basePositions = (outerGeo.attributes.position.array as Float32Array).slice();
    const outerMat = new THREE.MeshStandardMaterial({ color: 0x212422, roughness: 0.75, metalness: 0.05 });
    const outer = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outer);

    const innerMat = new THREE.MeshStandardMaterial({ color: 0x006a67, roughness: 0.6, metalness: 0.1 });
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.1, 40, 160), innerMat);
    inner.position.x = 0.45;
    scene.add(inner);

    const bar = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.045, 4.6, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x212422, roughness: 0.8 })
    );
    bar.rotation.z = Math.PI / 2;
    scene.add(bar);

    const targetColor = new THREE.Color();
    let smoothEnergy = 0;
    let t = 0;
    let raf = 0;
    const clock = new THREE.Clock();

    const render = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const tune = STATE_TUNING[stateRef.current];
      smoothEnergy += (energyRef.current - smoothEnergy) * 0.12;

      if (!reducedMotion) {
        t += dt * tune.speed;
        const pos = outerGeo.attributes.position.array as Float32Array;
        const amp = tune.amp + smoothEnergy * 0.22;
        for (let i = 0; i < pos.length; i += 3) {
          const x = basePositions[i];
          const y = basePositions[i + 1];
          const z = basePositions[i + 2];
          const angle = Math.atan2(y, x);
          const wave = Math.sin(angle * 6 + t * 4) * amp * 0.5 + Math.sin(angle * 3 - t * 2.3) * amp * 0.5;
          const scale = 1 + wave / 1.55;
          pos[i] = x * scale;
          pos[i + 1] = y * scale;
          pos[i + 2] = z + wave * 0.4;
        }
        outerGeo.attributes.position.needsUpdate = true;
        outer.rotation.x = Math.sin(t * 0.6) * 0.18;
        outer.rotation.y = Math.cos(t * 0.4) * 0.22;
        inner.rotation.y = t * 0.8;
        inner.position.x = 0.45 + Math.sin(t * 1.2) * 0.08 * (1 + smoothEnergy);
      }

      targetColor.setHex(tune.color);
      innerMat.color.lerp(targetColor, 0.08);

      renderer.render(scene, camera);
      if (!reducedMotion) raf = requestAnimationFrame(render);
    };
    render();

    const ro = new ResizeObserver(() => {
      ({ w, h } = size());
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (reducedMotion) renderer.render(scene, camera);
    });
    ro.observe(mount);

    // Reduced motion still needs colour updates on state change.
    const stillTimer = reducedMotion
      ? window.setInterval(() => {
          targetColor.setHex(STATE_TUNING[stateRef.current].color);
          innerMat.color.copy(targetColor);
          renderer.render(scene, camera);
        }, 400)
      : 0;

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(stillTimer);
      ro.disconnect();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [reducedMotion, onUnsupported]);

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
