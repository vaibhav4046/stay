'use client';

import { useEffect, useState } from 'react';
import { describePatience, emptyPatience, loadPatience, patienceEnabled, resetPatience, setPatienceEnabled, type PatienceState } from '@/lib/voice/patience';

/** What Stay has learned about how long this person pauses mid-thought. Kept on this device; one sentence, one switch, one reset. */
export function PacingSettings() {
  const [state, setState] = useState<PatienceState>(emptyPatience());
  const [on, setOn] = useState(true);
  useEffect(() => {
    setState(loadPatience());
    setOn(patienceEnabled());
  }, []);

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="pace-title" data-testid="pacing-settings">
      <h2 id="pace-title" className="card-title">How long Stay waits for you</h2>
      <p className="mt-2 text-[0.95rem] text-ink-2" data-testid="pacing-text">{describePatience(state, on)}</p>
      <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-[#8FD3FF]"
          checked={on}
          onChange={(e) => {
            setPatienceEnabled(e.target.checked);
            setOn(e.target.checked);
          }}
          data-testid="pacing-toggle"
        />
        <span>
          <span className="block font-medium text-ink">Learn how long I pause</span>
          <span className="block text-xs text-ink-2">Stay notes whether you pick a sentence up again or the wait runs out, and adjusts. It stays on this device.</span>
        </span>
      </label>
      <button
        type="button"
        className="btn btn-secondary mt-2 text-xs"
        disabled={state.events.length === 0}
        onClick={() => {
          resetPatience();
          setState(emptyPatience());
        }}
        data-testid="pacing-reset"
      >
        Start again
      </button>
    </section>
  );
}
