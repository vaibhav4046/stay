'use client';

import { useEffect, useState } from 'react';
import { describePatience, emptyPatience, loadPatience, patienceEnabled, resetPatience, setPatienceEnabled, type PatienceState } from '@/lib/voice/patience';
import { describeStyle, emptyStyle, loadStyle, resetStyle, type ReplyStyleState } from '@/lib/voice/replyStyle';

/** What Stay has learned about how long this person pauses mid-thought. Kept on this device; one sentence, one switch, one reset. */
export function PacingSettings() {
  const [state, setState] = useState<PatienceState>(emptyPatience());
  const [style, setStyle] = useState<ReplyStyleState>(emptyStyle());
  const [on, setOn] = useState(true);
  useEffect(() => {
    setState(loadPatience());
    setStyle(loadStyle());
    setOn(patienceEnabled());
  }, []);

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="pace-title" data-testid="pacing-settings">
      <h2 id="pace-title" className="card-title">Stay learns your pace</h2>
      <p className="mt-2 text-[0.95rem] text-ink-2" data-testid="pacing-text">{describePatience(state, on)}</p>
      <p className="mt-1 text-[0.95rem] text-ink-2" data-testid="pacing-style">{describeStyle(style, on)}</p>
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
          <span className="block font-medium text-ink">Learn my pace</span>
          <span className="block text-xs text-ink-2">Stay notes whether you pick a sentence up again after a pause, and whether you cut in while it talks, and adjusts. It stays on this device.</span>
        </span>
      </label>
      <button
        type="button"
        className="btn btn-secondary mt-2 text-xs"
        disabled={state.events.length === 0 && style.events.length === 0}
        onClick={() => {
          resetPatience();
          resetStyle();
          setState(emptyPatience());
          setStyle(emptyStyle());
        }}
        data-testid="pacing-reset"
      >
        Start again
      </button>
    </section>
  );
}
