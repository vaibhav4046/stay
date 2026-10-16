'use client';

import { useState } from 'react';
import type { TakenStatus, TreatmentCheckinRecord } from '@/types/domain';
import { detectCrisisSignal, detectMedicationAdviceRequest, MEDICAL_BOUNDARY_FIXED_MESSAGE } from '@/lib/safety/crisis';
import { useCrisisPanel } from '@/components/CrisisHelpPanel';

const TAKEN_OPTIONS: Array<{ key: TakenStatus; label: string }> = [
  { key: 'taken', label: 'Taken as prescribed' },
  { key: 'skipped', label: 'Missed or skipped' },
  { key: 'not_applicable', label: 'Not on medication' },
  { key: 'prefer_not_to_say', label: 'Prefer not to say' },
];

function Rating({ label, value, onChange, id }: { label: string; value: number | null; onChange: (n: number) => void; id: string }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="mt-2 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="chip tnum w-11 justify-center"
            aria-pressed={value === n}
            aria-label={`${label}: ${n} of 5`}
            onClick={() => onChange(n)}
            data-testid={`${id}-${n}`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TreatmentCheckinForm({
  onSubmit,
}: {
  onSubmit: (rec: Omit<TreatmentCheckinRecord, 'id' | 'userId' | 'createdAt'>) => Promise<unknown>;
}) {
  const { openCrisisPanel } = useCrisisPanel();
  const [taken, setTaken] = useState<TakenStatus | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [sideEffects, setSideEffects] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [boundary, setBoundary] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taken) return;
    const crisis = detectCrisisSignal(note);
    if (crisis.triggered) {
      openCrisisPanel(crisis.message);
      return;
    }
    setBoundary(detectMedicationAdviceRequest(note).triggered ? MEDICAL_BOUNDARY_FIXED_MESSAGE : null);
    await onSubmit({
      takenStatus: taken,
      focusRating: focus,
      sleepQuality: sleep,
      sideEffectsNoted: sideEffects,
      sideEffectNote: note.trim() ? note.trim().slice(0, 280) : null,
    });
    setSaved(true);
    setTaken(null);
    setFocus(null);
    setSleep(null);
    setSideEffects(false);
    setNote('');
  };

  return (
    <form className="card p-5 sm:p-6" onSubmit={submit} aria-labelledby="checkin-title" data-testid="checkin-form">
      <h2 id="checkin-title" className="card-title">Today&apos;s check-in</h2>
      <p className="meta mt-1">About 30 seconds. Stay logs this for you and your clinician. It never gives dosing advice.</p>

      <fieldset className="mt-5">
        <legend className="label">Treatment today</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAKEN_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className="chip"
              aria-pressed={taken === o.key}
              onClick={() => setTaken(o.key)}
              data-testid={`taken-${o.key}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Rating id="focus" label="Focus today" value={focus} onChange={setFocus} />
        <Rating id="sleep" label="Sleep last night" value={sleep} onChange={setSleep} />
      </div>

      <label className="mt-5 flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[#006A67]"
          checked={sideEffects}
          onChange={(e) => setSideEffects(e.target.checked)}
          data-testid="side-effects-toggle"
        />
        <span className="label">I noticed something I want to mention to my clinician</span>
      </label>

      <label htmlFor="note" className="label mt-4 block">
        Note for your clinician (optional)
      </label>
      <textarea
        id="note"
        className="field mt-2 min-h-[72px]"
        maxLength={280}
        placeholder="e.g. Dry mouth around midday"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        data-testid="checkin-note"
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={!taken} data-testid="checkin-submit">
          Save check-in
        </button>
        {saved && (
          <span className="meta" role="status" style={{ color: '#236B48' }}>
            Saved.
          </span>
        )}
      </div>
      {boundary && <p className="notice mt-4" data-testid="checkin-boundary">{boundary}</p>}
      <p className="meta mt-4">
        Questions about doses or side effects? Ask your prescriber or pharmacist. Feeling unwell: NHS 111. Emergency: 999.
      </p>
    </form>
  );
}
