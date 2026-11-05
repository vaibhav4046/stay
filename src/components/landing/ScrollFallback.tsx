'use client';

import { useEffect } from 'react';

const TARGETS = '.pipe-node, .bento-card, .bench-card, .lp-platform, .lp-promises li, .lp-seen li';

/**
 * Browsers without scroll-driven animations (no `animation-timeline`) get the same rise-and-fade from an IntersectionObserver.
 * Nothing is hidden until this runs (no script, or a script that fails, leaves every card visible), and nothing is hidden under
 * reduced motion. In browsers that do support scroll timelines this does nothing at all (scroll.css does the work).
 */
export function ScrollFallback() {
  // html[data-scrolling] while the page is moving (and 160 ms after): scroll.css uses it to drop the full-page grain, which is too costly to re-blend on every scrolled frame
  useEffect(() => {
    const root = document.documentElement;
    let t = 0;
    const on = () => {
      root.dataset.scrolling = '1';
      window.clearTimeout(t);
      t = window.setTimeout(() => delete root.dataset.scrolling, 160);
    };
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      window.clearTimeout(t);
      delete root.dataset.scrolling;
    };
  }, []);

  useEffect(() => {
    if (CSS.supports('animation-timeline: view()') || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(TARGETS)).filter((el) => el.getBoundingClientRect().top > window.innerHeight * 0.92);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.lpIn = '1';
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => {
      el.dataset.lpIn = '0';
      io.observe(el);
    });
    document.documentElement.dataset.lpIo = '1';
    return () => {
      io.disconnect();
      delete document.documentElement.dataset.lpIo;
      els.forEach((el) => delete el.dataset.lpIn);
    };
  }, []);
  return null;
}
