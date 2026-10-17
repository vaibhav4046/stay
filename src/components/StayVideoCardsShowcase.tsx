'use client';

import { useState } from 'react';
import Link from 'next/link';

interface ShowcaseCard {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  highlights: string[];
  ctaLabel: string;
  ctaHref: string;
  category: string;
}

const CARDS: ShowcaseCard[] = [
  {
    id: 'billion-shapes',
    badge: '1 Billion Shapes',
    category: 'Procedural Morphology',
    title: '1,000,000,000+ AI Generative Shapes',
    subtitle:
      'Beyond static icons. The dynamic Orb leverages Gielis Superformula mathematics and harmonic Fourier descriptors to synthesize billions of unique, responsive forms.',
    highlights: [
      'Gielis Superformula & Fourier series physics',
      'Real-time semantic vector synthesis',
      'Smooth 60fps spring-mass transitions',
    ],
    ctaLabel: 'Launch Living Orb',
    ctaHref: '/app/today',
  },
  {
    id: 'multi-intent-voice',
    badge: 'Multi-Intent Voice',
    category: 'Conversational Reflex',
    title: 'Natural Multi-Intent Reflex in 32 Languages',
    subtitle:
      'Speak how humans actually think. Express overwhelm, request a focus game, and morph the Orb in a single breath without robotic menus.',
    highlights: [
      '<15ms latency Universal-3 speech recognition',
      'Automatic language detection across 32 tongues',
      'Simultaneous command + context decomposition',
    ],
    ctaLabel: 'Try Voice Companion',
    ctaHref: '/app/today',
  },
  {
    id: 'intelligent-canvas',
    badge: 'ChatGPT-Class Canvas',
    category: 'Executive Function',
    title: 'Intelligent Visual Decomposition Canvas',
    subtitle:
      'Transforms paralyzing dread into tangible micro-momentum with step-by-step visual streaming, interactive nodes, and autonomous starter drafts.',
    highlights: [
      'Automated starter drafts and actionable steps',
      'Visual timeline flowchart showing micro-progress',
      'Perceived dread vs. 60-second micro-entry metric',
    ],
    ctaLabel: 'Explore Live Canvas',
    ctaHref: '/app/today',
  },
  {
    id: 'adhd-games',
    badge: 'Cognitive Neuro-Games',
    category: 'Clinical Dopamine Engine',
    title: 'Orb Cognitive Games for Dopamine Priming',
    subtitle:
      'Activate under-aroused prefrontal networks with fast, gamified cognitive exercises before tackling daunting everyday tasks.',
    highlights: [
      'Simon pattern recall for working memory',
      'Go / No-Go impulse and inhibitory control',
      'Phasic dopamine stimulation grounded in clinical science',
    ],
    ctaLabel: 'Play Focus Games',
    ctaHref: '/app/today',
  },
];

export function StayVideoCardsShowcase() {
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  return (
    <section
      data-testid="stay-video-cards-showcase"
      className="mx-auto max-w-6xl px-5 sm:px-8 py-16"
      aria-labelledby="showcase-title"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
        <div>
          <span className="inline-block text-[0.75rem] font-bold tracking-widest uppercase text-[#006A67] bg-[#006A67]/10 px-3 py-1 rounded-full mb-3">
            Pure Real Product · Autonomous AGI Companion
          </span>
          <h2 id="showcase-title" className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">
            Experience STAY in Motion.
          </h2>
        </div>
        <p className="text-ink-2 max-w-[42ch] text-sm sm:text-base">
          Built for how neurodivergent brains truly operate. No tedious menus, no complex setups—just intuitive voice, visual clarity, and adaptive feedback.
        </p>
      </div>

      {/* Main 4-Card Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {CARDS.map((card, idx) => {
          const isSelected = activeCardIndex === idx;
          return (
            <div
              key={card.id}
              data-testid={`video-card-${idx}`}
              onMouseEnter={() => setActiveCardIndex(idx)}
              className={`group relative rounded-[28px] overflow-hidden border transition-all duration-500 bg-white/80 backdrop-blur-xl ${
                isSelected
                  ? 'border-[#006A67]/40 shadow-[0_20px_50px_rgba(0,106,103,0.12)] -translate-y-1'
                  : 'border-black/[0.07] shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:border-black/20'
              }`}
            >
              {/* Media Container with Real Looping Video */}
              <div className="relative aspect-video w-full overflow-hidden bg-black/5">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src="/stay-showcase.mp4"
                />
                
                {/* Frosted Overlay with Live Dynamic Information */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-5 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-[0.7rem] font-semibold tracking-wide uppercase border border-white/20">
                      {card.badge}
                    </span>
                    <span className="flex items-center gap-1.5 text-[0.7rem] font-mono text-emerald-300 bg-black/40 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Engine
                    </span>
                  </div>

                  <div>
                    <span className="text-[0.7rem] text-white/80 tracking-wide uppercase font-semibold">
                      {card.category}
                    </span>
                    <h3 className="text-xl font-bold tracking-tight text-white mt-0.5">
                      {card.title}
                    </h3>
                  </div>
                </div>
              </div>

              {/* Card Details & Features */}
              <div className="p-6 space-y-4">
                <p className="text-xs sm:text-sm text-ink-2 leading-relaxed">
                  {card.subtitle}
                </p>

                <ul className="space-y-1.5 text-xs text-ink font-medium">
                  {card.highlights.map((h, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#006A67]" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-2 flex items-center justify-between border-t border-black/[0.06]">
                  <Link
                    href={card.ctaHref}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006A67] hover:text-[#00524F] transition-colors group/link"
                  >
                    <span>{card.ctaLabel}</span>
                    <span className="transition-transform group-hover/link:translate-x-1">→</span>
                  </Link>

                  <span className="text-[0.68rem] text-ink-2 font-mono">
                    0{idx + 1} / 04
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
