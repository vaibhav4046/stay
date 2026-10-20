'use client';

import type { DailyGreeting, OptionId } from '@/lib/coach/dailyGreeting';

/** The calm first-open-of-the-day card: a few warm lines and two or three soft ways to begin. Easy to wave away, never nagging. */
export function DailyGreetingCard({ greeting, onPick, onDismiss }: { greeting: DailyGreeting; onPick: (id: OptionId) => void; onDismiss: () => void }) {
  return (
    <section className="card w-full p-5" aria-label="Good to see you" data-testid="daily-greeting">
      <p className="font-display text-lg font-medium leading-snug" data-testid="daily-greeting-text">{greeting.text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Ways to begin">
        {greeting.options.map((o) => (
          <button key={o.id} type="button" className="chip" onClick={() => onPick(o.id)} data-testid={`greeting-option-${o.id}`}>
            {o.label}
          </button>
        ))}
        <button type="button" className="btn btn-ghost !px-2 !py-1" onClick={onDismiss} data-testid="greeting-dismiss">
          Not now
        </button>
      </div>
    </section>
  );
}
