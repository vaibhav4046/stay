'use client';

import { useEffect, useState } from 'react';
import { loadInstructions, MAX_NOTES, PRESETS, saveInstructions, type PresetKey } from '@/lib/coach/customInstructions';

/** "How should Stay talk to you?": a preset and a few words of your own. Stored on this device; never changes safety rules. */
export function StyleSettings() {
  const [preset, setPreset] = useState<PresetKey>('none');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  useEffect(() => {
    const ci = loadInstructions();
    setPreset(ci.preset);
    setNotes(ci.notes);
  }, []);

  const save = (nextPreset = preset) => {
    const { saved, error } = saveInstructions({ preset: nextPreset, notes });
    setPreset(saved.preset);
    if (error) {
      setNotes(saved.notes);
      setMsg({ kind: 'error', text: error });
    } else setMsg({ kind: 'ok', text: 'Saved on this device. Stay uses it from the next time you start talking.' });
  };

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="style-title" data-testid="style-settings">
      <h2 id="style-title" className="card-title">How Stay talks to you</h2>
      <p className="mt-2 text-[0.95rem] text-ink-2">Pick a style, then add anything in your own words: how long, what to call you, what never to say, which language. You can also just say &ldquo;talk to me more briefly&rdquo;.</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Style">
        {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
          <button key={k} type="button" className="chip" aria-pressed={preset === k} onClick={() => (setPreset(k), save(k))} title={PRESETS[k].hint} data-testid={`style-preset-${k}`}>
            {PRESETS[k].label}
          </button>
        ))}
      </div>
      <p className="meta mt-2">{PRESETS[preset].hint}</p>
      <label className="label mt-4 block" htmlFor="style-notes">In your own words</label>
      <textarea
        id="style-notes"
        className="field mt-1 min-h-[5.5rem] w-full resize-y p-3"
        value={notes}
        maxLength={MAX_NOTES}
        placeholder="Call me Sam. Keep it short. Please don't say sweetie."
        onChange={(e) => (setNotes(e.target.value), setMsg(null))}
        data-testid="style-notes"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="meta tnum">{notes.length}/{MAX_NOTES}</span>
        <button type="button" className="btn btn-primary" onClick={() => save()} data-testid="style-save">Save</button>
      </div>
      {msg && <p className={msg.kind === 'error' ? 'notice mt-2' : 'meta mt-2'} role="status" data-testid="style-msg">{msg.text}</p>}
      <p className="meta mt-3">This only changes how Stay sounds. It never changes the safety, crisis or medication rules, and notes that try to are refused.</p>
    </section>
  );
}
