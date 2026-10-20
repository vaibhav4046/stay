'use client';

import { useEffect, useRef, useState } from 'react';

export type RevealState = 'idle' | 'armed' | 'in';

/**
 * Scroll reveal that can never hide content: the server markup and a failed script both leave everything visible.
 * Only after hydration, and only if motion is allowed, is a not-yet-seen element "armed" (collapsed); it plays once when
 * it enters the viewport. Pair with `[data-reveal="armed"]` / `[data-reveal="in"]` in landing.css.
 */
export function useReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [state, setState] = useState<RevealState>('idle');

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
      setState('in'); // already on screen at load: nothing to reveal
      return;
    }
    setState('armed');
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState('in');
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, state };
}
