'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Signal } from '@/components/Signal';
import type { OrbTarget } from '@/components/orb/OrbParticles';
import { useOrbShape } from '@/lib/orb/useOrbShape';

/** What the orb shows on its own until you touch the field: the kind of thing people actually avoid. */
const INTRO = ['landlord email', 'taxes', 'overwhelmed', 'first step'];
const HANDOFF_KEY = 'stay_handoff_task';

/** Hover, focus or tap a chip and the same dots become it. Each phrase is matched by the built-in shape library. */
const CHIPS = [
  { label: 'Taxes', text: 'my taxes' },
  { label: 'Overwhelmed', text: 'I feel overwhelmed' },
  { label: 'Stuck', text: 'stuck on the first step' },
  { label: 'A landlord email', text: 'landlord email' },
  { label: 'No energy', text: 'I have no energy' },
];

export function Hero() {
  const orb = useOrbShape();
  const [text, setText] = useState('');
  const [chip, setChip] = useState<string | null>(null);
  const [figure, setFigure] = useState<OrbTarget | null>(null);
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

  const showChip = useCallback(
    (c: (typeof CHIPS)[number]) => {
      touched.current = true;
      setFigure(null);
      setChip(c.label);
      orb.feed(c.text, 'typed');
    },
    [orb],
  );

  const showFigure = useCallback(async () => {
    touched.current = true;
    setChip('Meet Stay');
    const m = await import('@/lib/orb/useOrbPresence'); // loaded on demand: it only matters once someone asks to see her
    setFigure(m.getFigureTarget());
  }, []);

  return (
    <section className="lp-hero lp-wrap" aria-labelledby="hero-title">
      <div className="lp-hero-copy">
        <h1 id="hero-title" className="hero-title max-w-[17ch]">Start the thing you&apos;ve been avoiding.</h1>
        <p className="mt-5 max-w-[46ch] text-[1.12rem] leading-relaxed text-ink-2">
          Say the thing you can&apos;t start. Stay turns it into a two-minute step and keeps you company while you do it.
        </p>

        <form
          className="mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            touched.current = true;
            setFigure(null);
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
              setFigure(null);
              setChip(null);
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
        <p className="meta mt-3 max-w-[46ch]">Type what you are avoiding, like taxes, a landlord email or &quot;I&apos;m overwhelmed&quot;, and watch the dots become it. Then continue in Stay by voice or text.</p>

        <div className="lp-chip-row mt-5" role="group" aria-label="Or try one of these" data-testid="hero-chips">
          {CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              className="chip"
              aria-pressed={chip === c.label}
              onPointerEnter={(e) => e.pointerType === 'mouse' && showChip(c)}
              onFocus={() => showChip(c)}
              onClick={() => {
                showChip(c);
                setText(c.text);
              }}
            >
              {c.label}
            </button>
          ))}
          <button type="button" className="chip lp-chip-face" aria-pressed={chip === 'Meet Stay'} onClick={showFigure} data-testid="hero-face">
            Meet the face
          </button>
        </div>

        <ul className="lp-proof" aria-label="At a glance">
          <li>Waits through your pauses</li>
          <li>History stays on your device</li>
          <li>Not a crisis service</li>
        </ul>
      </div>

      <div className="lp-hero-orb" data-testid="hero-orb">
        <Signal state={orb.thinking ? 'thinking' : 'idle'} energy={0} hideLabel shape={figure ?? orb.target} thinking={orb.thinking} className="h-full w-full" />
      </div>
    </section>
  );
}
