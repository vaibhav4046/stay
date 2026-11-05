'use client';

import type { InboxItem } from '@/lib/push/inbox';

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/** "From Stay": what it said while the app was closed. A blue dot marks it as unread; Talk it through opens the voice, Dismiss clears it. */
export function CheckinInbox({ items, onDismiss }: { items: InboxItem[]; onDismiss: (at: number | 'all') => Promise<void> }) {
  if (items.length === 0) return null;
  const [latest, ...earlier] = items;
  return (
    <section className="card mb-4 flex flex-col gap-3 p-4 sm:p-5" aria-label="From Stay" data-testid="checkin-inbox" style={{ borderLeft: '3px solid var(--color-action)' }}>
      <div className="flex items-center gap-2 text-xs text-ink-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--color-action)' }} aria-hidden="true" data-testid="checkin-dot" />
        <span className="font-semibold text-ink">From Stay</span>
        <span className="tnum">{clock(latest.at)}</span>
        {earlier.length > 0 && <span>· {earlier.length} earlier</span>}
      </div>
      <p className="text-[1rem] leading-relaxed text-ink" data-testid="checkin-text">{latest.body}</p>
      <div className="flex flex-wrap gap-2">
        <a
          className="btn btn-primary text-sm"
          href="/app/today?voice=auto"
          onClick={(e) => {
            e.preventDefault(); // clear the stored copy first, then go: leaving at once could cut the clean-up short
            void onDismiss('all').then(() => window.location.assign('/app/today?voice=auto'));
          }}
          data-testid="checkin-talk"
        >
          Talk it through
        </a>
        <button type="button" className="btn btn-ghost text-sm" onClick={() => onDismiss('all')} data-testid="checkin-dismiss">
          Dismiss
        </button>
      </div>
    </section>
  );
}
