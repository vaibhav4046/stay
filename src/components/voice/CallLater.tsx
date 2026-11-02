'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { showNotification } from '@/lib/reminders';
import { CALL_ME_CHOICES, cancelScheduledCall, scheduleCall, scheduledCallAt, takeDueCall } from '@/lib/voice/callMode';
import { startTone } from '@/lib/voice/ringtone';

/**
 * A booked call that has come due: Stay "rings" until the person answers, dismisses, or 30 s pass (while the page is open).
 * The home screen shows the returned flag as an alert in the conversation.
 */
export function useIncomingCall(): { ringing: boolean; dismiss: () => void } {
  const [ringing, setRinging] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!takeDueCall()) return;
      setRinging(true);
      showNotification('Stay is calling', 'Open Stay to answer.');
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ringing) return;
    const stop = startTone('incoming');
    const missed = window.setTimeout(() => setRinging(false), 30_000);
    return () => {
      stop();
      window.clearTimeout(missed);
    };
  }, [ringing]);

  return { ringing, dismiss: () => setRinging(false) };
}

export function IncomingCallAlert({ onAnswer, onDismiss }: { onAnswer: () => void; onDismiss: () => void }) {
  return (
    <div role="alert" className="card flex w-full items-center justify-between gap-3 p-4" data-testid="incoming-call">
      <p className="text-sm font-semibold">Stay is calling</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary px-3 py-2 text-xs" onClick={onAnswer} data-testid="call-answer">Answer</button>
        <button type="button" className="btn btn-secondary px-3 py-2 text-xs" onClick={onDismiss}>Not now</button>
      </div>
    </div>
  );
}

/** "Have Stay call me in a few minutes": books one call (kept on this device) that rings while this page is open. */
export function CallLaterPanel({ onClose }: { onClose: () => void }) {
  const [ringAt, setRingAt] = useState<number | null>(null);
  useEffect(() => setRingAt(scheduledCallAt()), []);

  return (
    <Sheet title="Call me later" onClose={onClose}>
      <p className="meta">Stay rings you here, in this tab, while Stay is open. Nothing is booked off this device.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {ringAt ? (
          <>
            <span data-testid="call-booked">Stay will call you at {new Date(ringAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} if this page is still open.</span>
            <button type="button" className="underline" onClick={() => (cancelScheduledCall(), setRingAt(null))}>Cancel</button>
          </>
        ) : (
          <>
            <span>Call me in</span>
            {CALL_ME_CHOICES.map((m) => (
              <button key={m} type="button" className="btn btn-secondary px-2.5 py-1 text-xs" onClick={() => setRingAt(scheduleCall(m))} data-testid={`call-me-${m}`}>
                {m} min
              </button>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}
