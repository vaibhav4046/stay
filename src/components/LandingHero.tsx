'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Signal } from '@/components/Signal';
import { useOrbShape } from '@/lib/orb/useOrbShape';

/** What the orb shows on its own until you touch the field: the kind of thing people actually avoid. */
const INTRO = ['landlord email', 'taxes', 'ice cream'];
const HANDOFF_KEY = 'stay_handoff_task';

export function LandingHero() {
  const orb = useOrbShape();
  const [text, setText] = useState('');
  const touched = useRef(false);
  const pause = useRef<number | undefined>(undefined);

  useEffect(() => {
    let i = 0;
    const timers: number[] = [];
    const tick = () => {
      if (touched.current) return;
      if (i < INTRO.length) {
        orb.feed(INTRO[i], 'typed');
        i++;
        timers.push(window.setTimeout(tick, 3300));
      } else {
        orb.rest();
      }
    };
    timers.push(window.setTimeout(tick, 1400));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handoff = () => {
    try {
      if (text.trim()) sessionStorage.setItem(HANDOFF_KEY, text.trim());
    } catch {
      // private mode: the app simply opens empty
    }
  };

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-6 px-5 pb-10 pt-6 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14 lg:pt-14">
      <div className="order-2 lg:order-1">
        <h1 className="hero-title max-w-[17ch]">Start the thing you&apos;ve been avoiding.</h1>
        <p className="mt-5 max-w-[46ch] text-[1.12rem] leading-relaxed text-ink-2">
          Tell Stay what you can&apos;t begin. It gives you one small first step, keeps you company for a short
          block, and remembers what helped.
        </p>

        <form
          className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            touched.current = true;
            orb.feed(text, 'typed');
          }}
        >
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
            onFocus={() => {
              touched.current = true;
            }}
            onChange={(e) => {
              touched.current = true;
              setText(e.target.value);
              orb.feed(e.target.value, 'partial');
              // when typing pauses, let any word (not just built-in ones) become a shape
              window.clearTimeout(pause.current);
              const v = e.target.value;
              if (v.trim().length >= 3) pause.current = window.setTimeout(() => orb.feed(v, 'typed'), 700);
            }}
          />
          <Link href="/app/today" onClick={handoff} className="btn btn-primary h-12 whitespace-nowrap" data-testid="hero-start">
            Talk to Stay
          </Link>
        </form>
        <p className="meta mt-3 max-w-[46ch]">Type a word like ice cream, taxes or dragon and watch the dots gather. Then continue in Stay by voice or text.</p>
      </div>

      <div className="order-1 mx-auto aspect-square w-full max-w-[520px] lg:order-2" data-testid="hero-orb">
        <Signal state={orb.thinking ? 'thinking' : 'idle'} energy={0} hideLabel shape={orb.target} thinking={orb.thinking} className="h-full w-full" />
      </div>
    </section>
  );
}
