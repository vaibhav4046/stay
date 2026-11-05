'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, loadChoices, readPushState, saveChoices, type CheckinChoices, type PushState } from '@/lib/push/client';
import { clearNudgeData, publishNudgeContext } from '@/lib/push/context';

const NOTE: Record<Exclude<PushState, 'loading' | 'on' | 'off'>, string> = {
  unsupported: 'This browser cannot receive background notifications. Chrome, Edge, Firefox and Safari on a Mac can.',
  'needs-install': 'On iPhone, notifications work for apps on your Home Screen. Tap Share, then Add to Home Screen, open Stay from there, and come back to this switch.',
  unconfigured: 'Check-ins are not switched on for this copy of Stay.',
  denied: 'Notifications are blocked for this site. Allow them in the browser settings, then come back.',
};

/** Stay speaking first, with the app closed: opt-in, two soft windows a day, off in one tap. */
export function ProactiveSettings() {
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [choices, setChoices] = useState<CheckinChoices>({ morning: true, evening: true, pausedUntil: 0 });
  useEffect(() => {
    readPushState().then(setState, () => setState('unsupported'));
    setChoices(loadChoices());
  }, []);

  /** One change at a time; the screen shows the new choice only once the server has it. */
  const change = async (next: Parameters<typeof saveChoices>[0]) => {
    setBusy(true);
    setFailed(false);
    const saved = await saveChoices(next);
    if (saved) setChoices(saved);
    else setFailed(true);
    setBusy(false);
  };
  const paused = choices.pausedUntil > Date.now();

  const toggle = async (on: boolean) => {
    setBusy(true);
    setFailed(false);
    if (on) {
      const next = await enablePush();
      if (next === 'error') setFailed(true);
      else if (next === 'on') void publishNudgeContext(); // so the very first check-in can already be about their list
      setState(next === 'error' ? 'off' : next);
    } else {
      await disablePush();
      await clearNudgeData();
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
      {state === 'on' && (
        <div className="mt-3 border-t border-line pt-3" data-testid="checkin-choices">
          <p className="text-sm font-medium text-ink">When</p>
          <div className="mt-1 flex flex-wrap gap-x-6">
            {(['morning', 'evening'] as const).map((slot) => (
              <label key={slot} className="flex min-h-11 cursor-pointer items-center gap-2 text-[0.95rem]">
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#8FD3FF]"
                  checked={choices[slot]}
                  // one window always stays on: to stop everything, use the main switch
                  disabled={busy || (choices[slot] && !choices[slot === 'morning' ? 'evening' : 'morning'])}
                  onChange={(e) => void change({ [slot]: e.target.checked })}
                  data-testid={`checkin-${slot}`}
                />
                {slot === 'morning' ? 'Morning (about 9 to 11)' : 'Evening (about 6:30 to 8:30)'}
              </label>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {paused ? (
              <>
                <span className="meta" data-testid="checkin-paused">Paused until {new Date(choices.pausedUntil).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}.</span>
                <button type="button" className="btn btn-ghost text-sm" disabled={busy} onClick={() => void change({ pauseHours: 0 })} data-testid="checkin-resume">Resume</button>
              </>
            ) : (
              <button type="button" className="btn btn-secondary text-sm" disabled={busy} onClick={() => void change({ pauseHours: 24 })} data-testid="checkin-pause">Pause for a day</button>
            )}
          </div>
        </div>
      )}
      {failed && <p className="meta mt-2" style={{ color: 'var(--color-danger)' }} role="alert">Could not turn it on. Check your connection and try again.</p>}
    </section>
  );
}
