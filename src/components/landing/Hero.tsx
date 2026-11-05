'use client';

import { useState } from 'react';
import { AppLink } from './AppLink';
import { HeroExample } from './HeroExample';
import { useCrisisPanel } from '@/components/CrisisHelpPanel';
import { detectCrisisSignal } from '@/lib/safety/crisis';

const HANDOFF_KEY = 'stay_handoff_task';

export function Hero() {
  const [text, setText] = useState('');
  const { openCrisisPanel } = useCrisisPanel();

  const handoff = (e: React.MouseEvent) => {
    const trimmed = text.trim();
    // crisis wording is never handed to the app as a task: help opens here, at once (safety review, 4 Nov 2026)
    const crisis = detectCrisisSignal(trimmed);
    if (crisis.triggered) {
      e.preventDefault();
      openCrisisPanel(crisis.message);
      return;
    }
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
        <h1 id="hero-title" className="hero-title max-w-[17ch]">Start the thing you&apos;ve been avoiding.</h1>
        <p className="mt-5 max-w-[46ch] text-pretty text-[1.12rem] leading-relaxed text-ink-2">
          Say what you&apos;re putting off. Stay finds a <span className="whitespace-nowrap">two-minute</span> first step and stays while you do it.
        </p>

        <form className="lp-composer mt-8" onSubmit={(e) => e.preventDefault()}>
          <label className="sr-only" htmlFor="hero-task">
            What are you putting off?
          </label>
          <input
            id="hero-task"
            data-testid="hero-input"
            className="lp-composer-input"
            placeholder="Or type what you are putting off"
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
          />
          <AppLink href="/app/today" onClick={handoff} className="lp-mic" data-testid="hero-start" title="Talk to Stay">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <rect x="9" y="3" width="6" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
            </svg>
            <span className="sr-only">Talk to Stay</span>
          </AppLink>
        </form>
        <p className="meta mt-3 max-w-[46ch]">Not a crisis service. Your history stays on your device.</p>
      </div>

      <HeroExample />
    </section>
  );
}
