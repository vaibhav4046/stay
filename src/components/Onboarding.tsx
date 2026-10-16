'use client';

import { useState } from 'react';
import type { CareContext, InteractionMode, UserProfile } from '@/types/domain';

export const CARE_OPTIONS: Array<{ key: CareContext; label: string; hint: string }> = [
  { key: 'waitlisted', label: "I'm waiting for an assessment or care", hint: 'Daily support while you wait.' },
  { key: 'medicated', label: "I'm taking prescribed ADHD medication", hint: 'Adds a quick treatment check-in.' },
  { key: 'in_therapy', label: "I'm in therapy or coaching", hint: 'Practise skills between sessions.' },
  { key: 'self_managing', label: "I'm managing on my own", hint: 'Practical help starting tasks.' },
  { key: 'prefer_not_to_say', label: "I'd rather not say", hint: 'That works too.' },
];

export function Onboarding({ onDone }: { onDone: (patch: Partial<UserProfile>) => void }) {
  const [care, setCare] = useState<CareContext | null>(null);
  const [mode, setMode] = useState<InteractionMode>('voice_and_text');
  const [proactive, setProactive] = useState(true);
  const [ack, setAck] = useState(false);

  return (
    <section className="card mx-auto max-w-2xl p-6 sm:p-8" aria-labelledby="onb-title" data-testid="onboarding">
      <h1 id="onb-title" className="section-title">Two quick questions</h1>
      <p className="text-ink-2 mt-2">This sets Stay&apos;s tone. You can change it later in Settings.</p>

      <fieldset className="mt-6">
        <legend className="label">Where are you with ADHD care?</legend>
        <div className="mt-3 grid gap-2">
          {CARE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className="chip w-full justify-start py-3"
              aria-pressed={care === o.key}
              onClick={() => setCare(o.key)}
              data-testid={`care-${o.key}`}
            >
              <span>
                <span className="block font-medium">{o.label}</span>
                <span className="meta block mt-0.5">{o.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="label">How do you want to use Stay?</legend>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={mode === 'voice_and_text'} onClick={() => setMode('voice_and_text')}>
            Voice and text
          </button>
          <button type="button" className="chip" aria-pressed={mode === 'quiet_text_only'} onClick={() => setMode('quiet_text_only')}>
            Text only (quiet)
          </button>
        </div>
        <label className="mt-4 flex items-center gap-3 cursor-pointer">
          <input type="checkbox" className="h-5 w-5 accent-[#006A67]" checked={proactive} onChange={(e) => setProactive(e.target.checked)} />
          <span className="text-[0.95rem]">Check in with me when a focus block ends</span>
        </label>
      </fieldset>

      <label className="notice mt-6 flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#006A67]"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
          data-testid="onboarding-ack"
        />
        <span>
          I understand Stay is a support tool, not medical care. It won&apos;t diagnose me or advise on medication, and it is
          not for emergencies.
        </span>
      </label>

      <button
        type="button"
        className="btn btn-primary mt-6"
        disabled={!care || !ack}
        onClick={() =>
          care &&
          onDone({ careContext: care, interactionMode: mode, proactiveCheckins: proactive, onboardingCompleted: true })
        }
        data-testid="onboarding-done"
      >
        Start
      </button>
    </section>
  );
}
