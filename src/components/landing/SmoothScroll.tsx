'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

const HEADER_OFFSET = -76; // the floating header and a little air
const OVERLAY = '[role="dialog"], [role="alertdialog"], dialog[open]';
const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

/**
 * Inertial wheel scrolling on the landing page only (Lenis, one requestAnimationFrame loop). Phones and other touch-first devices keep
 * their native scrolling (fast and already inertial), reduced motion keeps the browser's, and automated browsers keep exact scrolling.
 * Lenis pauses while a dialog or sheet is open (the sheet must scroll itself) and is destroyed when the page unmounts, so the app
 * screen keeps the browser's own scrolling. The header links ease to their section.
 */
export function SmoothScroll() {
  useEffect(() => {
    const is = (q: string) => window.matchMedia(q).matches;
    if (is('(prefers-reduced-motion: reduce)') || is('(hover: none) and (pointer: coarse)') || navigator.webdriver) return;

    const lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      syncTouch: false, // touch scrolls natively
      wheelMultiplier: 0.95,
      anchors: { offset: HEADER_OFFSET, duration: 1.35, easing: easeOutQuart },
    });

    let raf = requestAnimationFrame(function loop(t) {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    });

    let paused = false;
    let queued = false;
    const sync = () => {
      queued = false;
      const open = document.querySelector(OVERLAY) !== null;
      if (open === paused) return;
      paused = open;
      if (open) lenis.stop();
      else lenis.start();
    };
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'role'] });

    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}
