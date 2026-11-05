'use client';

import Link from 'next/link';
import { useRef, type ComponentProps } from 'react';

const PULL = 0.22; // how much of the pointer's distance from the centre the button follows
const MAX = 6; // px: never further than this
const clamp = (v: number) => Math.max(-MAX, Math.min(MAX, v));

/**
 * A link that leans a few pixels toward a mouse pointer on the way in and settles when it leaves (CSS eases it: `.lp-magnet` in scroll.css).
 * Mouse only, and only when motion is welcome: touch and pen never move it, reduced motion switches it off.
 */
export function MagneticLink({ className = '', ...props }: ComponentProps<typeof Link>) {
  const ref = useRef<HTMLAnchorElement>(null);
  const lean = (x: number, y: number) => {
    ref.current?.style.setProperty('--mx', `${x}px`);
    ref.current?.style.setProperty('--my', `${y}px`);
  };
  return (
    <Link
      ref={ref}
      {...props}
      className={`${className} lp-magnet`}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        lean(clamp((e.clientX - r.left - r.width / 2) * PULL), clamp((e.clientY - r.top - r.height / 2) * PULL));
      }}
      onPointerLeave={() => lean(0, 0)}
    />
  );
}
