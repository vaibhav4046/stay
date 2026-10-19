'use client';

import { useState } from 'react';
import { openToday, winsToday, type TodayItem } from '@/lib/coach/todayList';

/** The short list for today: open items first (the one to start on top), tick to finish, and a quiet count of wins. */
export function TodayCard({ items, onToggle, onStart, onOpenDump, onMove }: { items: TodayItem[]; onToggle: (id: string) => void; onStart: (item: TodayItem) => void; onOpenDump: () => void; onMove: (id: string) => void }) {
  const [showLater, setShowLater] = useState(false);
  const open = openToday(items);
  const wins = winsToday(items);
  const laterItems = items.filter((i) => !i.done && i.bucket === 'later');
  const later = laterItems.length;
  if (open.length === 0 && wins === 0 && later === 0) return null;
  return (
    <section className="card w-full p-5" aria-labelledby="today-card-title" data-testid="today-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today-card-title" className="card-title">Today</h2>
        <span className="meta tnum" data-testid="wins-count">{wins === 0 ? 'No wins yet, that is fine' : wins === 1 ? '1 win today' : `${wins} wins today`}</span>
      </div>
      {open.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {open.slice(0, 5).map((i) => (
            <li key={i.id} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onToggle(i.id)}
                aria-label={`Mark done: ${i.text}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface hover:border-accent"
                data-testid="today-check"
              >
                <span className="h-4 w-4 rounded-full border-2 border-line-strong" />
              </button>
              <button type="button" onClick={() => onStart(i)} className="min-h-[44px] flex-1 py-2 text-left" aria-label={`Start: ${i.text}`}>
                <span className={i.bucket === 'now' ? 'font-semibold' : ''}>{i.text}</span>
                {i.bucket === 'now' && <span className="meta ml-2">start here</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-ink-2">Nothing open for today.</p>
      )}
      {open.length > 0 && <p className="meta mt-2">Tap a task to start it. Tap the circle when it is done.</p>}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-secondary" onClick={onOpenDump} data-testid="open-dump">Brain dump</button>
        {later > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setShowLater((v) => !v)} aria-expanded={showLater} data-testid="later-toggle">
            {showLater ? 'Hide' : 'Show'} {later} saved for later
          </button>
        )}
      </div>
      {showLater && (
        <ul className="mt-2 space-y-1" data-testid="later-list">
          {laterItems.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-recessed px-3 py-2">
              <span>{i.text}</span>
              <button type="button" className="btn btn-ghost !px-2" onClick={() => onMove(i.id)} aria-label={`Move to today: ${i.text}`}>
                Move to today
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
