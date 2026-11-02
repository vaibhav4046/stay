'use client';

import { Sheet } from '@/components/Sheet';
import { weekTally, weekTallyLine } from '@/lib/coach/weekTally';
import type { CoachSessionRecord } from '@/types/domain';

const OUTCOME_LABEL: Record<string, string> = {
  started: 'Started',
  partly_started: 'Partly started',
  not_started: 'Not started',
  paused_or_stopped: 'Paused',
};

const SHOWN = 6;

/** The last few blocks, in the conversation. The full list with delete and undo stays on the History page. */
export function HistoryPanel({ sessions, onClose, onOpenFull }: { sessions: CoachSessionRecord[]; onClose: () => void; onOpenFull: () => void }) {
  const recent = sessions.slice(0, SHOWN);
  return (
    <Sheet title="History" onClose={onClose}>
      <p className="text-ink-2" data-testid="history-panel-tally">{weekTallyLine(weekTally(sessions))}</p>
      {recent.length === 0 ? (
        <p className="mt-3 text-ink-2">Nothing here yet. Start one small thing and it will show up here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line" data-testid="history-panel-list">
          {recent.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <span className="font-medium">{s.taskText}</span>
              <span className="meta">
                {s.outcome ? OUTCOME_LABEL[s.outcome] : 'Open'}
                {s.completedAt ? ` · ${new Date(s.completedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-secondary mt-4" onClick={onOpenFull} data-testid="history-open-full">
        Open full history
      </button>
    </Sheet>
  );
}
