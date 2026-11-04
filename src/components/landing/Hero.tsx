'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HeroExample } from './HeroExample';

const HANDOFF_KEY = 'stay_handoff_task';

export function Hero() {
  const [text, setText] = useState('');

  const handoff = () => {
    const trimmed = text.trim();
    try {
      if (trimmed) {
        sessionStorage.setItem(HANDOFF_KEY, trimmed);
        localStorage.setItem('stay_pending_prompt', trimmed);
      }
    } catch {
      // private mode: the app simply opens empty
    }
  };

  return (
    <section className="lp-hero lp-wrap" aria-labelledby="hero-title">
      <div className="lp-hero-copy">
        <p className="glass mb-5 flex w-fit max-w-full items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.74rem] font-medium text-ink-2 sm:text-[0.8rem]" data-testid="hero-badge">
          Live speech in your browser, powered by
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/assemblyai-logo.svg" alt="AssemblyAI" height={16} className="h-4 w-auto" />
        </p>
        <h1 id="hero-title" className="hero-title max-w-[17ch]">Start the thing you&apos;ve been avoiding.</h1>
        <p className="mt-5 max-w-[46ch] text-[1.12rem] leading-relaxed text-ink-2">
          Say the thing you can&apos;t start. Stay turns it into a two-minute step and keeps you company while you do it.
        </p>

        <form className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
          <label className="sr-only" htmlFor="hero-task">
            What are you putting off?
          </label>
          <input
            id="hero-task"
            data-testid="hero-input"
            className="field h-12 flex-1"
            placeholder="What are you putting off?"
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
          />
          <Link href="/app/today" onClick={handoff} className="btn btn-primary h-12 whitespace-nowrap" data-testid="hero-start">
            Talk to Stay
          </Link>
        </form>
        <p className="meta mt-3 max-w-[46ch]">Type it here or just press Talk to Stay and say it out loud. You can switch between voice and typing at any time.</p>

        <ul className="lp-proof" aria-label="At a glance">
          <li>Waits through your pauses</li>
          <li>History stays on your device</li>
          <li>Not a crisis service</li>
        </ul>
      </div>

      <HeroExample />
    </section>
  );
}
