'use client';

import type { ReactNode } from 'react';

/** A page of the app shown inside the conversation, so the call keeps going while the person looks at it (a navigation would end the call). */
export function InlinePage({ title, onClose, children, testId }: { title: string; onClose: () => void; children: ReactNode; testId: string }) {
  return (
    <section className="card w-full p-4 sm:p-5" aria-label={title} data-testid={testId}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="card-title">{title}</h2>
        <button type="button" className="btn btn-ghost h-9 !px-3 text-sm" onClick={onClose} data-testid={`${testId}-close`}>Close</button>
      </div>
      {children}
    </section>
  );
}
