'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { UK_CRISIS_RESOURCES } from '@/lib/safety/crisis';

interface CrisisContextValue {
  openCrisisPanel: (reason?: string) => void;
}

const CrisisContext = createContext<CrisisContextValue>({ openCrisisPanel: () => {} });

export function useCrisisPanel() {
  return useContext(CrisisContext);
}

export function CrisisHelpProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const pathname = usePathname();
  const inApp = pathname?.startsWith('/app'); // the app has its own Urgent help button in the header

  const openCrisisPanel = useCallback((r?: string) => {
    setReason(r);
    setOpen(true);
  }, []);

  return (
    <CrisisContext.Provider value={{ openCrisisPanel }}>
      {children}
      {false && <button
        type="button"
        onClick={() => openCrisisPanel()}
        className="fixed bottom-4 right-4 z-40 btn btn-secondary text-[0.85rem]"
        style={{ minHeight: 40, color: '#B23A2E', borderColor: '#E3C3BE' }}
        data-testid="crisis-help-trigger"
      >
        Urgent help
      </button>}
      {open && <CrisisHelpPanel reason={reason} onClose={() => setOpen(false)} />}
    </CrisisContext.Provider>
  );
}

function CrisisHelpPanel({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(33,36,34,0.42)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crisis-title"
      data-testid="crisis-panel"
    >
      <div className="card w-full max-w-lg p-6 sm:p-7">
        <h2 id="crisis-title" className="section-title">
          If you might be in danger, talk to a person now
        </h2>
        {reason && (
          <p className="mt-3 text-[0.95rem]" style={{ color: '#B23A2E' }}>
            {reason}
          </p>
        )}
        <p className="mt-3 text-ink-2 text-[0.95rem]">
          Stay is not a crisis service and can&apos;t help in an emergency. These UK services can.
        </p>
        <ul className="mt-5 space-y-3">
          {UK_CRISIS_RESOURCES.map((r) => (
            <li key={r.name} className="flex items-start justify-between gap-4 border-t border-line pt-3">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="meta mt-0.5">{r.detail}</p>
              </div>
              <a href={r.href} className="btn btn-primary shrink-0 tnum" style={{ minHeight: 40 }}>
                {r.contact}
              </a>
            </li>
          ))}
        </ul>
        <p className="meta mt-4">
          Outside the UK, call your local emergency number or visit findahelpline.com.
        </p>
        <div className="mt-5 flex justify-end">
          <button ref={closeRef} type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
