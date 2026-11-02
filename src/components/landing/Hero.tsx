'use client';

import { useState } from 'react';
import Link from 'next/link';

const HANDOFF_KEY = 'stay_handoff_task';

/**
 * One short exchange, written to show the shape of a Stay reply (a plain acknowledgement, one tiny step, a check-in). It is labelled as an
 * example; Stay's real replies are generated live and differ each time. This replaced the dot orb that turned typed words into shapes,
 * which the owner found a distraction from what Stay does (2 Nov 2026).
 */
const EXAMPLE = [
  { who: 'you', text: 'I keep avoiding the email to my landlord.' },
  { who: 'stay', text: 'That email is hanging over you. Open it and type one word, any word. Want to do that now?' },
  { who: 'you', text: 'Um… okay, I’ve opened it.' },
  { who: 'stay', text: 'Good. I’ll stay with you for two minutes while you write the first line.' },
] as const;

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

      <figure className="lp-hero-example card p-5 sm:p-6" data-testid="hero-example" aria-labelledby="hero-example-caption">
        <figcaption id="hero-example-caption" className="meta mb-3">
          An example exchange <span aria-hidden="true">·</span> real replies are generated live
        </figcaption>
        <div className="flex flex-col gap-3">
          {EXAMPLE.map((line, i) => (
            <div key={i} className={`flex flex-col ${line.who === 'you' ? 'items-end' : 'items-start'}`}>
              <span className="mb-1 px-1 text-[0.78rem] font-medium text-ink-2">{line.who === 'you' ? 'You' : 'Stay'}</span>
              <p className={`bubble ${line.who === 'you' ? 'bubble-user' : 'bubble-agent'} max-w-[34ch] px-4 py-2.5 text-[1rem] leading-[1.5]`}>{line.text}</p>
            </div>
          ))}
        </div>
      </figure>
    </section>
  );
}
