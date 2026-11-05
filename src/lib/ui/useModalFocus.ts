'use client';

import { useEffect, type RefObject } from 'react';

const TAB_STOPS = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * For a modal dialog: focus goes into it, Tab stays inside it, and focus goes back to what opened it when it closes.
 * Give the dialog `tabIndex={-1}` so it can take focus when nothing inside it asks for it.
 */
export function useModalFocus(box: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const el = box.current;
    el?.focus();
    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !el) return;
      const stops = Array.from(el.querySelectorAll<HTMLElement>(TAB_STOPS));
      if (stops.length === 0) { e.preventDefault(); return; }
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onTab);
    return () => {
      window.removeEventListener('keydown', onTab);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [box, active]);
}
