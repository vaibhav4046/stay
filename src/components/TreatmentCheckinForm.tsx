'use client';

import { useRef, useState } from 'react';
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
  showTreatment = true,
  initialCheckin,
}: {
  onSubmit: (rec: Omit<TreatmentCheckinRecord, 'id' | 'userId' | 'createdAt'>) => Promise<unknown>;
  /** The medication question is only for people who said they take prescribed medication. */
  showTreatment?: boolean;
  initialCheckin?: TreatmentCheckinRecord | null;
}) {
  const { openCrisisPanel } = useCrisisPanel();
  const [taken, setTaken] = useState<TakenStatus | null>(
    initialCheckin?.takenStatus ?? (showTreatment ? null : 'not_applicable')
  );
  const [focus, setFocus] = useState<number | null>(initialCheckin?.focusRating ?? null);
  const [sleep, setSleep] = useState<number | null>(initialCheckin?.sleepQuality ?? null);
  const [sideEffects, setSideEffects] = useState(initialCheckin?.sideEffectsNoted ?? false);
  const [note, setNote] = useState(initialCheckin?.sideEffectNote ?? '');
  const [saved, setSaved] = useState(false);
  const [boundary, setBoundary] = useState<string | null>(null);
  const [needTaken, setNeedTaken] = useState(false);
  const treatmentRef = useRef<HTMLFieldSetElement>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taken) {
      // the button stays a real button: an empty click says what is missing and puts the cursor there
      setNeedTaken(true);
      treatmentRef.current?.querySelector('button')?.focus();
      return;
    }
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
  };

  return (
    <form className="card p-5 sm:p-6" onSubmit={submit} aria-label="Today's check-in" data-testid="checkin-form">
      <p className="meta">About 30 seconds. Stay logs this for you and your clinician. It never gives dosing advice.</p>
      {initialCheckin && (
        <p className="meta mt-2 text-primary font-medium" data-testid="checkin-existing-note">
          You already recorded today&apos;s check-in. Any changes here will update today&apos;s entry.
        </p>
      )}

      {showTreatment && <fieldset ref={treatmentRef} className="mt-5">
        <legend className="label">Treatment today</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {TAKEN_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className="chip"
              aria-pressed={taken === o.key}
              onClick={() => (setTaken(o.key), setNeedTaken(false))}
              data-testid={`taken-${o.key}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {needTaken && <p className="meta mt-2" role="status" data-testid="checkin-need-taken">Pick one for treatment today first.</p>}
      </fieldset>}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Rating id="focus" label="Focus today" value={focus} onChange={setFocus} />
        <Rating id="sleep" label="Sleep last night" value={sleep} onChange={setSleep} />
      </div>

      <label className="mt-5 flex min-h-11 items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[#8FD3FF]"
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
        <button type="submit" className="btn btn-primary" data-testid="checkin-submit">
          {initialCheckin ? "Update today's check-in" : 'Save check-in'}
        </button>
        {saved && (
          <span className="meta" role="status" style={{ color: 'var(--color-success)' }} data-testid="checkin-saved-msg">
            {initialCheckin ? "Saved (updated today's check-in)." : 'Saved.'}
          </span>
        )}
      </div>
      {boundary && <p className="notice mt-4" data-testid="checkin-boundary">{boundary}</p>}
      <p className="meta mt-4">
        Questions about doses or side effects? Ask your prescriber or pharmacist. Feeling unwell? Contact a doctor or pharmacist. In an emergency, call your local emergency number.
      </p>
    </form>
  );
}
