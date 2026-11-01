'use client';

import { useEffect, useState } from 'react';
import { showNotification } from '@/lib/reminders';
import { CALL_ME_CHOICES, cancelScheduledCall, scheduleCall, scheduledCallAt, takeDueCall } from '@/lib/voice/callMode';
import { startTone } from '@/lib/voice/ringtone';

interface Props {
  inCall: boolean;
  onCall: () => void;
  /** real number, only when configured; never invented */
  phone?: string;
}

/** The Call Stay entry point: call now, or have Stay ring you in a few minutes (while this page is open). */
export function CallStayCard({ inCall, onCall, phone }: Props) {
  const [ringAt, setRingAt] = useState<number | null>(null);
  const [ringing, setRinging] = useState(false);

  useEffect(() => setRingAt(scheduledCallAt()), []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!takeDueCall()) return;
      setRingAt(null);
      setRinging(true);
      showNotification('Stay is calling', 'Open Stay to answer.');
    }, 2000);
    return () => window.clearInterval(id);
  }, []);

  // an incoming call rings until it is answered, dismissed, or missed after 30 s
  useEffect(() => {
    if (!ringing) return;
    const stop = startTone('incoming');
    const missed = window.setTimeout(() => setRinging(false), 30_000);
    return () => {
      stop();
      window.clearTimeout(missed);
    };
  }, [ringing]);

  const book = (m: number) => setRingAt(scheduleCall(m));
  const cancel = () => (cancelScheduledCall(), setRingAt(null));
  const answer = () => (setRinging(false), onCall());

  return (
    <aside className="card mt-3 p-4 sm:p-5" data-testid="call-stay-card" aria-label="Call Stay">
      {ringing && (
        <div role="alert" className="mb-3 flex items-center justify-between gap-3" data-testid="incoming-call">
          <p className="text-sm font-semibold">Stay is calling</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary px-3 py-2 text-xs" onClick={answer} data-testid="call-answer">Answer</button>
            <button type="button" className="btn btn-secondary px-3 py-2 text-xs" onClick={() => setRinging(false)}>Not now</button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Call Stay</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-2)' }}>
            Talk in your browser with AssemblyAI voice. Up to 10 minutes.
            {phone && (
              <> Phone (US, inbound only): <a href={`tel:${phone}`} className="font-mono font-semibold underline">{phone}</a>. Carrier rates apply outside the US.</>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-primary px-4 py-2 text-sm" onClick={onCall} disabled={inCall} data-testid="call-direct-stay-btn">
          Call Stay
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--ink-2)' }}>
        {ringAt ? (
          <>
            <span data-testid="call-booked">Stay will call you at {new Date(ringAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} if this page is still open.</span>
            <button type="button" className="underline" onClick={cancel}>Cancel</button>
          </>
        ) : (
          <>
            <span>Have Stay call me in</span>
            {CALL_ME_CHOICES.map((m) => (
              <button key={m} type="button" className="btn btn-secondary px-2.5 py-1 text-xs" onClick={() => book(m)} data-testid={`call-me-${m}`}>
                {m} min
              </button>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
