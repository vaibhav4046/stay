'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { crisisResourcesFor, detectRegion } from '@/lib/safety/region';
import { useModalFocus } from '@/lib/ui/useModalFocus';

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
        style={{ minHeight: 40, color: '#FF8A80', borderColor: 'rgba(255,138,128,0.35)' }}
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
  const boxRef = useRef<HTMLDivElement>(null);
  // the services for where the person is come first; the rest stay listed because the guess can be wrong
  const [resources] = useState(() => crisisResourcesFor(detectRegion()));

  // declared first so it records what opened the panel before the Close button takes focus
  useModalFocus(boxRef);
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(33,36,34,0.42)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crisis-title"
      data-testid="crisis-panel"
    >
      {/* the whole card scrolls inside the screen: on a phone it is taller than the screen, and the title and the person's own numbers must be reachable */}
      <div ref={boxRef} tabIndex={-1} className="card w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-6 outline-none sm:p-7">
        <h2 id="crisis-title" className="section-title">
          If you might be in danger, talk to a person now
        </h2>
        {reason && (
          <p className="mt-3 text-[0.95rem]" style={{ color: '#FF8A80' }}>
            {reason}
          </p>
        )}
        <p className="mt-3 text-ink-2 text-[0.95rem]">
          Stay is not a crisis service and can&apos;t help in an emergency. These services can, and the ones for your country are listed first.
        </p>
        <ul className="mt-5 space-y-3">
          {resources.map((r) => (
            <li key={r.name} className="flex items-start justify-between gap-4 border-t border-line pt-3">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="meta mt-0.5">{r.detail}</p>
              </div>
              <a href={r.href} className="btn btn-primary shrink-0 tnum">
                {r.contact}
              </a>
            </li>
          ))}
        </ul>
        <p className="meta mt-4">
          Not sure which applies to you? Call your local emergency number, or visit findahelpline.com.
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
