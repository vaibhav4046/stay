'use client';

import { useEffect, useRef, useState } from 'react';
import { buildHumanFigure, FACE } from '@/lib/orb/human';
import { useReveal } from './useReveal';

type Mode = 'figure' | 'neural' | 'sphere';

export function NeuralOrbArtifact() {
  const { ref: revealRef, state } = useReveal<HTMLDivElement>(0.12);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mode, setMode] = useState<Mode>('figure');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rotationSpeed, setRotationSpeed] = useState(1);
  const [fps, setFps] = useState(60);

  // Store angle and animation frame
  const stateRef = useRef({
    angleY: 0,
    angleX: 0.1,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    speakingViseme: 0,
    speakingTimer: 0,
    time: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const N = 3200; // Optimal density for smooth 60fps canvas rendering
    const figure = buildHumanFigure(N);

    // Precalculate neural nodes and spherical coordinates
    const spherePts = new Float32Array(N * 3);
    const neuralPts = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Sphere
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 0.75 + (Math.random() - 0.5) * 0.08;
      spherePts[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      spherePts[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      spherePts[i * 3 + 2] = r * Math.cos(phi);

      // Neural pathways (two hemispheres + brain stem)
      const isLeft = Math.random() > 0.5;
      const hX = (isLeft ? -1 : 1) * (0.2 + Math.random() * 0.55);
      const hY = 0.1 + (Math.random() - 0.3) * 0.7;
      const hZ = (Math.random() - 0.5) * 0.8;
      neuralPts[i * 3] = hX;
      neuralPts[i * 3 + 1] = hY;
      neuralPts[i * 3 + 2] = hZ;
    }

    let lastFrame = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const dt = Math.min((now - lastFrame) / 1000, 0.1);
      lastFrame = now;

      frameCount++;
      if (now - fpsTimer >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        fpsTimer = now;
      }

      const s = stateRef.current;
      s.time += dt;

      // Auto rotation when not dragging
      if (!s.isDragging) {
        s.angleY += dt * 0.4 * rotationSpeed;
      }

      // Viseme oscillation when speaking
      if (isSpeaking) {
        s.speakingViseme = Math.abs(Math.sin(s.time * 9)) * 0.08;
      } else {
        s.speakingViseme *= 0.85;
      }

      // Resize canvas handling
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const scale = Math.min(width, height) * 0.44;

      const cosY = Math.cos(s.angleY);
      const sinY = Math.sin(s.angleY);
      const cosX = Math.cos(s.angleX);
      const sinX = Math.sin(s.angleX);

      // Breath offset
      const breath = Math.sin(s.time * 1.8) * 0.015;

      // Pick source coordinates
      const srcPts = mode === 'figure' ? figure.pts : mode === 'neural' ? neuralPts : spherePts;

      // Draw dots
      for (let i = 0; i < N; i += 2) {
        let x = srcPts[i * 3];
        let y = srcPts[i * 3 + 1];
        let z = srcPts[i * 3 + 2];

        // Apply breathing & speaking to figure
        if (mode === 'figure') {
          y += breath;
          // Mouth movement
          if (Math.abs(y - FACE.mouthY) < 0.1 && Math.abs(x) < FACE.mouthHalfW) {
            y += (y < FACE.mouthY ? -1 : 1) * s.speakingViseme;
          }
        }

        // Y-axis rotation
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // X-axis rotation
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        // Perspective projection
        const p = 2.4 / (2.4 + z2);
        const px = cx + x1 * scale * p;
        const py = cy - y2 * scale * p;

        if (px >= 0 && px <= width && py >= 0 && py <= height) {
          const depthAlpha = Math.max(0.15, Math.min(1, (z2 + 1.2) / 2.2));
          const dotRadius = Math.max(1, p * 1.6);

          if (mode === 'neural') {
            ctx.fillStyle = `rgba(168, 85, 247, ${depthAlpha * 0.8})`;
          } else if (mode === 'figure') {
            const r = Math.round(figure.cols[i * 3] * 255);
            const g = Math.round(figure.cols[i * 3 + 1] * 255);
            const b = Math.round(figure.cols[i * 3 + 2] * 255);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${depthAlpha})`;
          } else {
            ctx.fillStyle = `rgba(56, 189, 248, ${depthAlpha * 0.75})`;
          }

          ctx.beginPath();
          ctx.arc(px, py, dotRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [mode, isSpeaking, rotationSpeed]);

  // Mouse / Touch Drag Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    stateRef.current.isDragging = true;
    stateRef.current.lastX = e.clientX;
    stateRef.current.lastY = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!stateRef.current.isDragging) return;
    const dx = e.clientX - stateRef.current.lastX;
    const dy = e.clientY - stateRef.current.lastY;
    stateRef.current.angleY += dx * 0.008;
    stateRef.current.angleX = Math.max(-0.6, Math.min(0.6, stateRef.current.angleX + dy * 0.008));
    stateRef.current.lastX = e.clientX;
    stateRef.current.lastY = e.clientY;
  };

  const handlePointerUp = () => {
    stateRef.current.isDragging = false;
  };

  return (
    <section id="artifacts-3d" ref={revealRef} data-reveal={state} className="lp-section lp-wrap" aria-labelledby="artifacts-title">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <p className="eyebrow">Interactive 3D Artifact</p>
          <h2 id="artifacts-title" className="section-title max-w-[26ch]">
            The 5,200-dot procedural therapist figure
          </h2>
          <p className="mt-3 max-w-[60ch] text-ink-2">
            Built entirely as mathematical point clouds without textures or meshes. Every dot belongs to an organic rig driven in real-time by WebGL, audio visemes, and natural breathing cues.
          </p>
        </div>

        {/* View Controls */}
        <div className="inline-flex rounded-lg bg-surface-2 p-1 border border-edge self-start">
          <button
            type="button"
            onClick={() => setMode('figure')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'figure' ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Therapist Bust
          </button>
          <button
            type="button"
            onClick={() => setMode('neural')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'neural' ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Neural Pathways
          </button>
          <button
            type="button"
            onClick={() => setMode('sphere')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              mode === 'sphere' ? 'bg-primary text-white shadow-sm' : 'text-ink-2 hover:text-ink'
            }`}
          >
            Hypersphere
          </button>
        </div>
      </div>

      {/* 3D Canvas Box */}
      <div className="rounded-2xl border border-edge bg-surface-1 overflow-hidden relative shadow-2xl">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full h-[460px] cursor-grab active:cursor-grabbing block"
          title="Drag to rotate the 3D model in real-time"
        />

        {/* Floating Telemetry & Controls Overlay */}
        <div className="absolute top-4 left-4 p-3 rounded-xl bg-surface-2/80 backdrop-blur-md border border-edge text-xs font-mono space-y-1 select-none pointer-events-none">
          <div className="text-emerald-400 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            3,200 Active SDF Dots
          </div>
          <div className="text-ink-3">FPS: {fps} · Math Rig: Procedural</div>
          <div className="text-ink-3">Mode: {mode.toUpperCase()}</div>
        </div>

        {/* Action Toolbar */}
        <div className="absolute bottom-4 right-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsSpeaking(!isSpeaking)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-2 shadow-lg backdrop-blur-md ${
              isSpeaking
                ? 'bg-accent text-white border-accent'
                : 'bg-surface-2/90 text-ink border-edge hover:bg-surface-3'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isSpeaking ? 'bg-white animate-ping' : 'bg-accent'}`} />
            {isSpeaking ? 'Speaking (Simulating Lip-Sync)' : 'Simulate Spoken Visemes'}
          </button>

          <button
            type="button"
            onClick={() => setRotationSpeed((v) => (v === 0 ? 1 : v === 1 ? 2 : 0))}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-surface-2/90 text-ink-2 border border-edge hover:text-ink shadow-lg backdrop-blur-md"
          >
            Speed: {rotationSpeed}x
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-ink-3">
        <span>Click and drag canvas to rotate across 3 dimensions. Responsive across desktop and mobile.</span>
        <span className="font-mono mt-1 sm:mt-0">Source: <code>src/lib/orb/human.ts</code></span>
      </div>
    </section>
  );
}
