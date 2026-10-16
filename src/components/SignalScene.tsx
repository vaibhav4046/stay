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

interface OrbStateConfig {
  base: string;
  top: string;
  wave: string;
  ring: string;
  speed: number;
  activityFloor: number;
}

const ORB_STATE_CONFIG: Record<VoiceVisualState, OrbStateConfig> = {
  idle: { base: '#064943', top: '#0B625B', wave: '#ABD5C8', ring: '#659A8F', speed: 0.16, activityFloor: 0.025 },
  connecting: { base: '#405651', top: '#627570', wave: '#D0DED7', ring: '#8EA79E', speed: 0.42, activityFloor: 0.08 },
  listening: { base: '#064A45', top: '#087068', wave: '#B9E2D4', ring: '#76B2A2', speed: 0.62, activityFloor: 0.08 },
  thinking: { base: '#174943', top: '#28645D', wave: '#C0DBD1', ring: '#83AFA3', speed: 0.3, activityFloor: 0.19 },
  speaking: { base: '#044B45', top: '#08766C', wave: '#D6EADF', ring: '#7FB8A9', speed: 0.8, activityFloor: 0.12 },
  interrupted: { base: '#5B4228', top: '#89673D', wave: '#EAD0A7', ring: '#B99A6B', speed: 0.22, activityFloor: 0.06 },
  backchannel: { base: '#0B4B42', top: '#1A6E60', wave: '#C8E2D6', ring: '#7EB6A5', speed: 0.52, activityFloor: 0.09 },
  saving: { base: '#454D48', top: '#69736D', wave: '#DAE0D9', ring: '#AAB9AE', speed: 0.24, activityFloor: 0.035 },
  complete: { base: '#1D5134', top: '#34764B', wave: '#D1E7CA', ring: '#87B891', speed: 0.14, activityFloor: 0.025 },
  error: { base: '#632F29', top: '#914D42', wave: '#F0C0B4', ring: '#C38477', speed: 0.12, activityFloor: 0.02 },
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

const vertexShader = [
  'uniform float uTime;',
  'uniform float uEnergy;',
  'uniform float uActivity;',
  'uniform float uMotion;',
  'varying vec3 vLocalPosition;',
  'varying vec3 vNormalView;',
  'varying vec3 vViewDirection;',
  'void main() {',
  '  vec3 p = position;',
  '  float activity = max(uEnergy, uActivity);',
  '  float swellA = sin(position.y * 10.0 - uTime * 1.25 + sin(position.x * 3.8 + uTime * 0.22) * 0.9);',
  '  float swellB = sin(position.x * 7.0 + position.z * 3.1 - uTime * 0.72);',
  '  float displacement = (swellA * 0.012 + swellB * 0.004) * (0.18 + activity * 1.45) * uMotion;',
  '  p += normal * displacement;',
  '  vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);',
  '  vLocalPosition = p;',
  '  vNormalView = normalize(normalMatrix * normal);',
  '  vViewDirection = normalize(-viewPosition.xyz);',
  '  gl_Position = projectionMatrix * viewPosition;',
  '}',
].join('\n');

const fragmentShader = [
  'uniform float uTime;',
  'uniform float uEnergy;',
  'uniform float uActivity;',
  'uniform float uMotion;',
  'uniform vec3 uBaseColor;',
  'uniform vec3 uTopColor;',
  'uniform vec3 uWaveColor;',
  'varying vec3 vLocalPosition;',
  'varying vec3 vNormalView;',
  'varying vec3 vViewDirection;',
  'void main() {',
  '  vec3 p = normalize(vLocalPosition);',
  '  vec3 n = normalize(vNormalView);',
  '  vec3 viewDirection = normalize(vViewDirection);',
  '  float activity = max(uEnergy, uActivity);',
  '  float flow = uTime * uMotion;',
  '  float frontMask = smoothstep(-0.18, 0.32, p.z);',
  '  float volume = smoothstep(-0.98, -0.05, p.y) * (1.0 - smoothstep(0.90, 0.99, abs(p.x)));',
  '',
  '  // An unmistakable fluid ribbon lives inside the orb, not around its outside.',
  '  // Its amplitude and brightness react to live voice energy.',
  '  float carrier = sin(p.x * 6.4 - flow * 2.15 + sin(p.z * 4.0 + flow * 0.34) * 0.72);',
  '  float fineCarrier = sin(p.x * 12.0 - flow * 3.1 + p.z * 2.4);',
  '  float waveAmplitude = 0.018 + activity * 0.205;',
  '  float waveY = carrier * waveAmplitude + fineCarrier * (0.005 + activity * 0.026);',
  '  float distanceToWave = abs(p.y - waveY);',
  '  float mainRibbon = 1.0 - smoothstep(0.012, 0.046 + activity * 0.012, distanceToWave);',
  '  float ribbonHalo = 1.0 - smoothstep(0.035, 0.115 + activity * 0.018, distanceToWave);',
  '',
  '  // Two softer companion currents give the centre depth without turning it into rings.',
  '  float upperY = waveY + 0.105 + sin(p.x * 4.2 - flow * 0.9) * 0.014;',
  '  float lowerY = waveY - 0.115 + sin(p.x * 4.9 + flow * 0.78) * 0.012;',
  '  float upperRibbon = 1.0 - smoothstep(0.008, 0.023, abs(p.y - upperY));',
  '  float lowerRibbon = 1.0 - smoothstep(0.008, 0.023, abs(p.y - lowerY));',
  '',
  '  float verticalShade = smoothstep(-0.92, 0.92, p.y);',
  '  vec3 base = mix(uBaseColor, uTopColor, verticalShade * 0.78);',
  '  vec3 lightDirection = normalize(vec3(-0.44, 0.72, 0.92));',
  '  float diffuse = 0.52 + 0.48 * max(dot(n, lightDirection), 0.0);',
  '  float fresnel = pow(1.0 - max(dot(n, viewDirection), 0.0), 2.8);',
  '  vec3 color = base * diffuse;',
  '  color += uWaveColor * ribbonHalo * frontMask * volume * (0.11 + activity * 0.23);',
  '  color += uWaveColor * mainRibbon * frontMask * volume * (0.72 + activity * 1.05);',
  '  color += uWaveColor * (upperRibbon + lowerRibbon) * frontMask * volume * (0.17 + activity * 0.23);',
  '  color = mix(color, uWaveColor, fresnel * 0.17);',
  '',
  '  vec3 halfVector = normalize(lightDirection + viewDirection);',
  '  float specular = pow(max(dot(n, halfVector), 0.0), 38.0);',
  '  color += vec3(0.82, 0.94, 0.87) * specular * 0.22;',
  '  gl_FragColor = vec4(color, 1.0);',
  '  #include <tonemapping_fragment>',
  '  #include <colorspace_fragment>',
  '}',
].join('\\n');

/** A mineral-glass orb with a live energy-reactive field inside it. */
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
        powerPreference: 'low-power',
      });
    } catch {
      onUnsupported();
      return;
    }

    const getSize = () => ({
      width: Math.max(mount.clientWidth, 1),
      height: Math.max(mount.clientHeight, 1),
    });

    let { width, height } = getSize();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.25);

    scene.add(new THREE.AmbientLight(0xfff8f0, 1.05));

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 2.15);
    keyLight.position.set(-3.2, 4.0, 4.5);
    scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x73a99b, 0.85, 7);
    rimLight.position.set(2.7, -1.7, 2.7);
    scene.add(rimLight);

    const initial = ORB_STATE_CONFIG.idle;
    const uniforms = {
      uTime: { value: 0 },
      uEnergy: { value: 0 },
      uActivity: { value: initial.activityFloor },
      uMotion: { value: reducedMotion ? 0 : 1 },
      uBaseColor: { value: new THREE.Color(initial.base) },
      uTopColor: { value: new THREE.Color(initial.top) },
      uWaveColor: { value: new THREE.Color(initial.wave) },
    };

    const sphereGeometry = new THREE.SphereGeometry(1, 96, 72);
    const sphereMaterial = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.FrontSide,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);

    const signalGroup = new THREE.Group();
    signalGroup.add(sphere);
    scene.add(signalGroup);

    // One hairline orbit gives the orb an instrument-like silhouette.
    const ringGeometry = new THREE.TorusGeometry(1.19, 0.007, 8, 160);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: initial.ring,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.set(1.02, 0.12, -0.22);
    signalGroup.add(ring);

    const targetBase = new THREE.Color();
    const targetTop = new THREE.Color();
    const targetWave = new THREE.Color();
    const targetRing = new THREE.Color();

    let time = 0;
    let smoothedEnergy = 0;
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const render = () => {
      if (disposed) return;

      const dt = Math.min(clock.getDelta(), 0.05);
      const config = ORB_STATE_CONFIG[stateRef.current] || initial;
      const rawEnergy = clamp01(energyRef.current);
      const smoothing = rawEnergy > smoothedEnergy ? 0.24 : 0.09;
      smoothedEnergy += (rawEnergy - smoothedEnergy) * smoothing;

      if (!reducedMotion) time += dt * config.speed;

      uniforms.uTime.value = reducedMotion ? 0 : time;
      uniforms.uEnergy.value = smoothedEnergy;
      uniforms.uActivity.value = Math.max(config.activityFloor, smoothedEnergy * 0.72);
      uniforms.uMotion.value = reducedMotion ? 0 : 1;

      targetBase.set(config.base);
      targetTop.set(config.top);
      targetWave.set(config.wave);
      uniforms.uBaseColor.value.lerp(targetBase, 0.055);
      uniforms.uTopColor.value.lerp(targetTop, 0.055);
      uniforms.uWaveColor.value.lerp(targetWave, 0.07);
      targetRing.set(config.ring);
      ringMaterial.color.lerp(targetRing, 0.06);

      const breath = reducedMotion
        ? 1
        : 1 + Math.sin(time * 0.7) * 0.007 + Math.max(smoothedEnergy, config.activityFloor) * 0.016;
      signalGroup.scale.setScalar(breath);

      if (!reducedMotion) {
        ring.rotation.z = -0.22 + Math.sin(time * 0.22) * 0.06;
        ring.rotation.y = 0.12 + time * 0.035;
      }

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };

    render();

    const resizeObserver = new ResizeObserver(() => {
      ({ width, height } = getSize());
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resizeObserver.observe(mount);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      sphereGeometry.dispose();
      sphereMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [reducedMotion, onUnsupported]);

  return <div ref={mountRef} className="h-full w-full" aria-hidden="true" />;
}
