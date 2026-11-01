'use client';

import { useEffect, useRef } from 'react';
import type { SignalLevels, SignalState } from '@/lib/signal/signalModel';
import { breath, lookFor, smoothDrive, targetDrive } from '@/lib/signal/signalModel';
import { signalBus } from '@/lib/signal/signalBus';
import { lipSyncBus } from '@/lib/orb/lipSync';

/**
 * The one real source of levels: the microphone worklet's RMS (signalBus) and the envelope of assistant audio that is
 * actually audible right now (lipSyncBus, cleared on barge-in). Nothing here opens a microphone or touches a provider.
 */
export function readSignalLevels(): SignalLevels {
  const out = lipSyncBus.now();
  return { input: signalBus.input(), output: out.live ? Math.min(1, out.level * 1.6) : 0 };
}

const TINTS = {
  accent: { a: '#8FD3FF', b: '#E4F6FF', glow: 'rgba(62, 143, 214,0.55)' },
  warm: { a: '#F0B35A', b: '#FFE2AE', glow: 'rgba(240,179,90,0.4)' },
  danger: { a: '#FF8A80', b: '#FFD0CC', glow: 'rgba(255,138,128,0.4)' },
  muted: { a: '#3A4A5E', b: '#6F8199', glow: 'rgba(90,91,92,0)' },
} as const;

/** Three layered, tapered strands: calm and nearly flat in quiet, filling out with the real level. */
const LAYERS = [
  { amp: 1, freq: 1.7, speed: 1.0, phase: 0, alpha: 0.95, width: 2.2 },
  { amp: 0.62, freq: 2.9, speed: -1.35, phase: 1.3, alpha: 0.5, width: 1.5 },
  { amp: 0.38, freq: 4.4, speed: 1.9, phase: 2.7, alpha: 0.28, width: 1.1 },
] as const;

export interface SignalWaveProps {
  state: SignalState;
  /** pixel height; width follows the container */
  height?: number;
  className?: string;
  /** levels source; defaults to the real microphone and rendered assistant audio */
  getLevels?: () => SignalLevels;
}

export function SignalWave({ state, height = 56, className = '', getLevels = readSignalLevels }: SignalWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const getLevelsRef = useRef(getLevels);
  getLevelsRef.current = getLevels;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // 30 fps on small devices; 60 elsewhere
    const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    const frameMs = lowPower ? 33 : 0;

    let raf = 0;
    let visible = true;
    let drive = 0;
    let last = performance.now();
    let lastDraw = 0;
    let lastAttr = 0;
    let width = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(canvas);

    const draw = (tSec: number, st: SignalState, level: number) => {
      const look = lookFor(st);
      const tint = TINTS[look.tint];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const mid = height / 2;
      const swell = look.breathe && !reduced ? 0.05 + 0.05 * breath(tSec) : 0;
      const maxAmp = (height / 2 - 3) * (level + swell);
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      if (look.travel && !reduced) {
        const p = (tSec * 0.28) % 1.4 - 0.2; // a slow highlight sliding along the line
        grad.addColorStop(0, tint.a);
        grad.addColorStop(Math.min(1, Math.max(0, p - 0.18)), tint.a);
        grad.addColorStop(Math.min(1, Math.max(0, p)), tint.b);
        grad.addColorStop(Math.min(1, Math.max(0, p + 0.18)), tint.a);
        grad.addColorStop(1, tint.a);
      } else {
        grad.addColorStop(0, tint.a);
        grad.addColorStop(0.5, tint.b);
        grad.addColorStop(1, tint.a);
      }
      ctx.lineCap = 'round';
      ctx.shadowColor = tint.glow;
      ctx.shadowBlur = level > 0.04 ? 12 : 0;
      const layers = reduced ? LAYERS.slice(0, 1) : LAYERS;
      for (const L of layers) {
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.globalAlpha = L.alpha * (look.tint === 'muted' ? 0.6 : 1);
        ctx.lineWidth = L.width;
        const steps = Math.max(24, Math.round(width / 5));
        for (let i = 0; i <= steps; i++) {
          const x = i / steps;
          const taper = Math.pow(Math.sin(Math.PI * x), 1.6); // tapered ends
          const y = mid + Math.sin(x * Math.PI * 2 * L.freq + (reduced ? 0 : tSec * L.speed * 2.4) + L.phase) * maxAmp * L.amp * taper;
          if (i === 0) ctx.moveTo(x * width, y);
          else ctx.lineTo(x * width, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.visibilityState === 'hidden') return; // no background rendering; visibilitychange restarts it
      if (frameMs && now - lastDraw < frameMs) {
        raf = requestAnimationFrame(frame);
        return;
      }
      lastDraw = now;
      const dt = now - last;
      last = now;
      const st = stateRef.current;
      drive = smoothDrive(drive, targetDrive(st, getLevelsRef.current()), dt, st);
      draw(now / 1000, st, reduced ? 0 : drive);
      if (now - lastAttr > 100) {
        lastAttr = now;
        canvas.dataset.drive = drive.toFixed(2); // read by tests and diagnostics; not used for rendering
      }
      raf = requestAnimationFrame(frame);
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      io.disconnect();
    };
  }, [height]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="signal-wave"
      data-signal-state={state}
      data-drive="0.00"
      className={`block w-full ${className}`}
      style={{ height }}
    />
  );
}
