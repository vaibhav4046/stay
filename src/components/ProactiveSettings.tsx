'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, readPushState, type PushState } from '@/lib/push/client';

const NOTE: Record<Exclude<PushState, 'loading' | 'on' | 'off'>, string> = {
  unsupported: 'This browser cannot receive background notifications. On iPhone, add Stay to the Home Screen first.',
  unconfigured: 'Check-ins are not switched on for this copy of Stay.',
  denied: 'Notifications are blocked for this site. Allow them in the browser settings, then come back.',
};

/** Stay speaking first, with the app closed: opt-in, two soft windows a day, off in one tap. */
export function ProactiveSettings() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    readPushState().then(setState, () => setState('unsupported'));
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    setFailed(false);
    if (on) {
      const next = await enablePush();
      if (next === 'error') setFailed(true);
      setState(next === 'error' ? 'off' : next);
    } else {
      await disablePush();
      setState('off');
    }
    setBusy(false);
  };

  if (state === 'loading') return null;
  const interactive = state === 'on' || state === 'off';
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="push-title" data-testid="proactive-settings">
      <h2 id="push-title" className="card-title">Stay checks in on you</h2>
      <p className="mt-2 text-[0.95rem] text-ink-2">
        Once in the morning and once in the evening, Stay can send a short, calm message even when the app is closed. It never nags: two at most a day, nothing at night.
        The message is general: the server keeps your browser&apos;s notification address and time zone, and nothing you say or plan. Tap it and Stay opens on Today.
      </p>
      {interactive ? (
        <label className="mt-3 flex min-h-11 items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 accent-[#8FD3FF]"
            checked={state === 'on'}
            disabled={busy}
            onChange={(e) => void toggle(e.target.checked)}
            data-testid="proactive-toggle"
          />
          <span>
            <span className="font-medium text-ink block">Send me check-ins</span>
            <span className="text-xs text-ink-2 block">Turning it on sends one message right away to prove it works. Turning it off removes your address from the server.</span>
          </span>
        </label>
      ) : (
        <p className="meta mt-3" data-testid="proactive-note">{NOTE[state as keyof typeof NOTE]}</p>
      )}
      {failed && <p className="meta mt-2" style={{ color: 'var(--color-danger)' }} role="alert">Could not turn it on. Check your connection and try again.</p>}
    </section>
  );
}
