'use client';

import { useEffect, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { addReminder, askNotificationPermission, loadReminders, minutesUntil, notificationState, removeReminder, type Reminder } from '@/lib/reminders';

/** Check-ins: "remind me in 20 minutes". Works while Stay is open, including in the background. */
export function ReminderSheet({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [list, setList] = useState<Reminder[]>([]);
  const [text, setText] = useState('');
  const [perm, setPerm] = useState<ReturnType<typeof notificationState>>('default');
  useEffect(() => {
    setList(loadReminders());
    setPerm(notificationState());
  }, []);
  const add = (m: number) => {
    setList(addReminder(m, text).list);
    setText('');
    onChanged();
  };
  return (
    <Sheet title="Check-ins" onClose={onClose}>
      <p className="meta">Stay will nudge you, softly, when the time is up. Say &ldquo;check in with me in 20 minutes&rdquo; any time.</p>
      <label className="mt-3 block">
        <span className="label">What for (optional)</span>
        <input className="field mt-1 w-full" value={text} maxLength={100} onChange={(e) => setText(e.target.value)} placeholder="Is the laundry on?" data-testid="reminder-text" />
      </label>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Check in after">
        {[5, 10, 20, 30, 60].map((m) => (
          <button key={m} type="button" className="chip" onClick={() => add(m)} data-testid={`remind-${m}`}>
            {m} min
          </button>
        ))}
      </div>
      {list.length > 0 && (
        <ul className="mt-4 space-y-2" data-testid="reminder-list">
          {list.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-recessed p-3">
              <span>{r.text} <span className="meta">in {minutesUntil(r)} min</span></span>
              <button type="button" className="btn btn-ghost !px-2 !py-1" aria-label={`Cancel ${r.text}`} onClick={() => { setList(removeReminder(r.id)); onChanged(); }}>Cancel</button>
            </li>
          ))}
        </ul>
      )}
      {perm !== 'granted' && perm !== 'unsupported' && (
        <div className="mt-4">
          <button type="button" className="btn btn-secondary" disabled={perm === 'denied'} onClick={async () => setPerm(await askNotificationPermission())} data-testid="allow-notifications">
            {perm === 'denied' ? 'Notifications are blocked in your browser' : 'Also show a notification'}
          </button>
          <p className="meta mt-2">Without it, Stay still chimes and speaks if the tab is open.</p>
        </div>
      )}
    </Sheet>
  );
}
