'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { useModalFocus } from '@/lib/ui/useModalFocus';

/**
 * Inside this provider a Sheet renders as a card in the conversation instead of a modal over it. The chat-first home
 * screen wraps its panels in it, so Memory, Brain dump, Routines and the rest appear in the flow when the talk asks for
 * them, and the same components still work as sheets anywhere else.
 */
export const InlineSheetContext = createContext(false);

/** A bottom sheet on phones, a centred dialog on larger screens (or an inline card). Escape or a tap outside closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const inline = useContext(InlineSheetContext);
  const dialog = useRef<HTMLDivElement>(null);
  // as a modal: focus goes into it, Tab stays inside it, and focus goes back to what opened it (QA review, 4 Nov 2026)
  useModalFocus(dialog, !inline);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (inline) {
    return (
      <section role="region" aria-label={title} className="card stay-panel w-full p-5" data-testid="inline-panel" data-panel={title}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center" onClick={onClose}>
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="outline-none max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-[var(--radius-stage)] bg-surface p-6 shadow-xl sm:rounded-[var(--radius-card)]"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
