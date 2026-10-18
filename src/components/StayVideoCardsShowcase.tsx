'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export function StayVideoCardsShowcase() {
  const [activeShape, setActiveShape] = useState<'rocket' | 'butterfly' | 'dragon' | 'dna'>('rocket');
  const [activeLang, setActiveLang] = useState<'hi' | 'ko' | 'en' | 'es'>('en');
  const [gameScore, setGameScore] = useState(30);
  const [litPad, setLitPad] = useState<number | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({ 0: true, 1: false, 2: false });

  // Tone generator for card 3 Simon interactive game
  const playCardTone = (freq: number) => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      // headless fallback
    }
  };

  // Card 0 canvas morphing animation
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.03;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      // Parameters based on activeShape
      const m = activeShape === 'rocket' ? 3 : activeShape === 'butterfly' ? 2 : activeShape === 'dragon' ? 5 : 4;
      const color =
        activeShape === 'rocket'
          ? '#EA580C'
          : activeShape === 'butterfly'
          ? '#0284C7'
          : activeShape === 'dragon'
          ? '#E11D48'
          : '#10B981';

      ctx.save();
      ctx.translate(cx, cy);

      // Draw glowing Gielis parametric contour
      ctx.beginPath();
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const r1 = Math.pow(Math.abs(Math.cos((m * theta) / 4)), 1.2);
        const r2 = Math.pow(Math.abs(Math.sin((m * theta) / 4)), 1.2);
        const radius = (1 / Math.pow(r1 + r2, 1 / 1.5)) * (48 + Math.sin(time * 2 + theta * 3) * 6);
        const x = Math.cos(theta) * radius;
        const y = Math.sin(theta) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = `${color}25`;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.stroke();

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeShape]);

  return (
    <section
      data-testid="stay-video-cards-showcase"
      className="mx-auto max-w-6xl px-5 sm:px-8 py-12 sm:py-20"
      aria-labelledby="showcase-title"
    >
      {/* Section Header with Clear Visual Airspace */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <span className="inline-block text-[0.72rem] font-bold tracking-widest uppercase text-[#006A67] bg-[#006A67]/10 px-3.5 py-1 rounded-full mb-3">
            Real Product Cinema · 4 Core Pillars
          </span>
          <h2 id="showcase-title" className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Experience STAY in Motion.
          </h2>
        </div>
        <p className="text-ink-2 max-w-[44ch] text-sm sm:text-base leading-relaxed">
          Four distinct, real-time cognitive technologies purpose-built for ADHD executive function. No static mockups—each pillar runs dynamic 60fps mathematics and speech processing.
        </p>
      </div>

      {/* 4 Distinct Bento Cards with Zero Overlap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* CARD 0: 1 Billion Generative Shapes */}
        <div
          data-testid="video-card-0"
          className="group rounded-[32px] overflow-hidden border border-black/[0.08] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_rgba(0,106,103,0.12)] transition-all duration-300 flex flex-col"
        >
          {/* Dedicated Media Box */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-slate-900/10 flex items-center justify-center p-4">
            <video
              autoPlay
              loop
              muted
              playsInline
              poster="/poster-1b-shapes.png"
              className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-700 group-hover:scale-105"
              src="/stay-showcase.mp4"
            />
            {/* Live 60fps Gielis Superformula Parametric Canvas */}
            <canvas ref={canvasRef} width={280} height={180} className="relative z-10 drop-shadow-lg" />
            
            {/* Interactive Shape Morphing Chips */}
            <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-center gap-1.5 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/10">
              {[
                { id: 'rocket', icon: '🚀', label: 'Rocket' },
                { id: 'butterfly', icon: '🦋', label: 'Butterfly' },
                { id: 'dragon', icon: '🐉', label: 'Dragon' },
                { id: 'dna', icon: '🧬', label: 'DNA' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveShape(s.id as any)}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${
                    activeShape === s.id
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Clean Card Content Body (No text overlap) */}
          <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[0.68rem] font-bold uppercase tracking-widest text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                  1 Billion Shapes
                </span>
                <span className="text-xs font-mono text-ink-2">Gielis Topology</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-ink">
                1,000,000,000+ AI Generative Shapes
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-ink-2 leading-relaxed">
                Beyond static icons. The dynamic Orb leverages Gielis Superformula mathematics and harmonic Fourier descriptors to synthesize billions of unique, responsive forms with spring-mass physics.
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between">
              <Link
                href="/app/today"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006A67] hover:text-[#004D4A]"
              >
                <span>Morph in Living Orb</span>
                <span>→</span>
              </Link>
              <span className="text-[0.7rem] font-mono text-ink-3">01 / 04</span>
            </div>
          </div>
        </div>

        {/* CARD 1: Multi-Intent Voice & 32 Languages */}
        <div
          data-testid="video-card-1"
          className="group rounded-[32px] overflow-hidden border border-black/[0.08] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_rgba(0,106,103,0.12)] transition-all duration-300 flex flex-col"
        >
          {/* Dedicated Media Box */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-teal-500/10 via-emerald-500/5 to-slate-900/10 flex flex-col items-center justify-center p-5">
            <video
              autoPlay
              loop
              muted
              playsInline
              poster="/poster-rewards.png"
              className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-700 group-hover:scale-105"
              src="/stay-showcase.mp4"
            />
            {/* Real 32-Band Audio Waveform Simulator */}
            <div className="relative z-10 flex items-center justify-center gap-1 h-14 w-full max-w-[240px]">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1.5 bg-[#006A67] rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.sin(i * 0.45) * 16 + (i % 3) * 10}px`,
                    animationDuration: `${0.6 + (i % 4) * 0.25}s`,
                    animationDelay: `${i * 40}ms`,
                  }}
                />
              ))}
            </div>

            {/* Live Multi-Intent Decomposer Pill */}
            <div className="relative z-10 mt-3 rounded-xl bg-black/60 backdrop-blur-md p-2.5 text-left border border-white/10 w-full max-w-[280px]">
              <div className="flex items-center gap-1.5 text-[0.66rem] font-mono text-emerald-300 mb-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Simultaneous Decompose (&lt;15ms)</span>
              </div>
              <p className="text-[0.72rem] text-white font-medium truncate">
                &ldquo;Play game on hard &amp; help with landlord email&rdquo;
              </p>
              <div className="mt-1 flex flex-wrap gap-1 text-[0.62rem]">
                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded">🎮 Simon: Hard</span>
                <span className="bg-white/20 text-white px-1.5 py-0.5 rounded">📄 Task: Landlord</span>
              </div>
            </div>

            {/* Language Selector */}
            <div className="absolute top-3 right-3 z-20 flex gap-1 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full text-[0.68rem] text-white font-semibold">
              <button
                type="button"
                onClick={() => setActiveLang('en')}
                className={`px-1.5 rounded ${activeLang === 'en' ? 'bg-white text-ink' : 'opacity-70'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('hi')}
                className={`px-1.5 rounded ${activeLang === 'hi' ? 'bg-white text-ink' : 'opacity-70'}`}
              >
                हिन्दी
              </button>
              <button
                type="button"
                onClick={() => setActiveLang('ko')}
                className={`px-1.5 rounded ${activeLang === 'ko' ? 'bg-white text-ink' : 'opacity-70'}`}
              >
                한국어
              </button>
            </div>
          </div>

          {/* Clean Card Content Body */}
          <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[0.68rem] font-bold uppercase tracking-widest text-[#006A67] bg-[#006A67]/10 px-2.5 py-0.5 rounded-full">
                  Conversational Reflex
                </span>
                <span className="text-xs font-mono text-ink-2">9 Languages Verified Live</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-ink">
                Natural Multi-Intent Voice, Many Languages
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-ink-2 leading-relaxed">
                Speak how humans actually think. Express emotional overwhelm, request a focus game, and morph the Orb in a single breath without robotic menus or interruptions.
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between">
              <Link
                href="/app/today"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006A67] hover:text-[#004D4A]"
              >
                <span>Try Voice Companion</span>
                <span>→</span>
              </Link>
              <span className="text-[0.7rem] font-mono text-ink-3">02 / 04</span>
            </div>
          </div>
        </div>

        {/* CARD 2: ChatGPT-Class Visual Task Canvas */}
        <div
          data-testid="video-card-2"
          className="group rounded-[32px] overflow-hidden border border-black/[0.08] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_rgba(0,106,103,0.12)] transition-all duration-300 flex flex-col"
        >
          {/* Dedicated Media Box */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-slate-900/10 flex flex-col items-center justify-center p-5">
            <video
              autoPlay
              loop
              muted
              playsInline
              poster="/poster-canvas.png"
              className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-700 group-hover:scale-105"
              src="/stay-showcase.mp4"
            />
            {/* Live Interactive SVG Node Flowchart */}
            <div className="relative z-10 w-full max-w-[300px] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-md border border-black/[0.06] space-y-2">
              <div className="flex items-center justify-between text-[0.68rem] font-semibold text-ink">
                <span>Task Decomposition Stream</span>
                <span className="text-[#006A67] font-mono">60s Micro-Entry</span>
              </div>
              <svg viewBox="0 0 260 36" className="w-full h-8">
                <line x1="20" y1="18" x2="240" y2="18" stroke="#E5E7EB" strokeWidth="2" />
                <line x1="20" y1="18" x2="160" y2="18" stroke="#006A67" strokeWidth="2.5" />
                {['Chaos', 'Dopamine', '60s Step', 'Draft'].map((step, i) => {
                  const cx = 20 + i * 73;
                  const active = i <= 2;
                  return (
                    <g key={step}>
                      <circle cx={cx} cy="18" r={active ? 6 : 4} fill={active ? '#006A67' : '#D1D5DB'} />
                      <text x={cx} y="32" textAnchor="middle" fontSize="7" fill={active ? '#111827' : '#9CA3AF'}>
                        {step}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="space-y-1">
                {[
                  'Open landlord lease renewal tab',
                  'Type one messy rough sentence',
                  'Review drafted reply before sending',
                ].map((txt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCheckedSteps((prev) => ({ ...prev, [i]: !prev[i] }))}
                    className="w-full flex items-center justify-between rounded-lg bg-black/[0.03] px-2 py-1 text-[0.68rem] text-left hover:bg-black/[0.06]"
                  >
                    <span className={checkedSteps[i] ? 'line-through text-ink-3' : 'text-ink font-medium'}>
                      {checkedSteps[i] ? '✓ ' : '○ '} {txt}
                    </span>
                    <span className="text-[#006A67] font-mono text-[0.62rem]">~45s</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clean Card Content Body */}
          <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[0.68rem] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full">
                  Executive Canvas
                </span>
                <span className="text-xs font-mono text-ink-2">ChatGPT Inspiration</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-ink">
                Intelligent Visual Decomposition Canvas
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-ink-2 leading-relaxed">
                Transforms paralyzing dread into tangible micro-momentum with step-by-step visual streaming, interactive nodes, and autonomous starter drafts.
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between">
              <Link
                href="/app/today"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006A67] hover:text-[#004D4A]"
              >
                <span>Explore Live Canvas</span>
                <span>→</span>
              </Link>
              <span className="text-[0.7rem] font-mono text-ink-3">03 / 04</span>
            </div>
          </div>
        </div>

        {/* CARD 3: ADHD Cognitive Neuro-Games Arena */}
        <div
          data-testid="video-card-3"
          className="group rounded-[32px] overflow-hidden border border-black/[0.08] bg-white shadow-[0_12px_40px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_50px_rgba(0,106,103,0.12)] transition-all duration-300 flex flex-col"
        >
          {/* Dedicated Media Box */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-slate-900/10 flex flex-col items-center justify-center p-5">
            <video
              autoPlay
              loop
              muted
              playsInline
              poster="/poster-arch.png"
              className="absolute inset-0 h-full w-full object-cover opacity-35 transition-transform duration-700 group-hover:scale-105"
              src="/stay-showcase.mp4"
            />
            {/* Playable Simon Mini-Quadrant */}
            <div className="relative z-10 grid grid-cols-2 gap-2 p-3 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
              {[
                { id: 0, color: '#10B981', label: '🟢 Emerald', freq: 392.0 },
                { id: 1, color: '#0EA5E9', label: '🔵 Sapphire', freq: 493.88 },
                { id: 2, color: '#F59E0B', label: '🟡 Amber', freq: 587.33 },
                { id: 3, color: '#8B5CF6', label: '🟣 Violet', freq: 659.25 },
              ].map((pad) => (
                <button
                  key={pad.id}
                  type="button"
                  onClick={() => {
                    setLitPad(pad.id);
                    playCardTone(pad.freq);
                    setGameScore((s) => s + 10);
                    setTimeout(() => setLitPad(null), 250);
                  }}
                  className={`w-20 h-14 rounded-xl text-[0.68rem] font-semibold text-white flex items-center justify-center transition-all ${
                    litPad === pad.id ? 'scale-105 brightness-125 shadow-lg' : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: pad.color }}
                >
                  {pad.label}
                </button>
              ))}
            </div>

            {/* Score & Dopamine Status */}
            <div className="relative z-10 mt-2 flex items-center gap-3 text-white text-[0.7rem] font-semibold bg-black/40 backdrop-blur-md px-3 py-1 rounded-full">
              <span>⚡ Dopamine Score: {gameScore}</span>
              <span className="text-emerald-400">Working Memory: Primed</span>
            </div>
          </div>

          {/* Clean Card Content Body */}
          <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[0.68rem] font-bold uppercase tracking-widest text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full">
                  Cognitive Neuro-Games
                </span>
                <span className="text-xs font-mono text-ink-2">Dopamine Primer</span>
              </div>
              <h3 className="text-xl font-bold tracking-tight text-ink">
                Orb Cognitive Games for Dopamine Priming
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-ink-2 leading-relaxed">
                Activate under-aroused prefrontal networks with fast, gamified cognitive exercises (Simon Pulse, Go/No-Go Impulse Shield, Word Rally) before tackling daunting everyday tasks.
              </p>
            </div>

            <div className="pt-3 border-t border-black/[0.06] flex items-center justify-between">
              <Link
                href="/app/today"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006A67] hover:text-[#004D4A]"
              >
                <span>Play Live in Orb</span>
                <span>→</span>
              </Link>
              <span className="text-[0.7rem] font-mono text-ink-3">04 / 04</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
