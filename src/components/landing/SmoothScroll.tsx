'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Inertial scrolling on the landing page only. Off for reduced motion and for touch screens (native momentum is already
 * good there). The app screen keeps the browser's own scrolling, so the chat and its panels behave like any web page.
 */
export function SmoothScroll() {
  useEffect(() => {
    // not for reduced motion, touch screens, or automated browsers (scripted scrolling should land exactly where it is told)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches || navigator.webdriver) return;
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95, anchors: true });
    let raf = requestAnimationFrame(function loop(t) {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    });
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}
