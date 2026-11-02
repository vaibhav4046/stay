'use client';

import { useState, useEffect } from 'react';
import type { CareContext, InteractionMode, UserProfile } from '@/types/domain';

export const CARE_OPTIONS: Array<{ key: CareContext; label: string; hint: string }> = [
  { key: 'waitlisted', label: "I'm waiting for an assessment or care", hint: 'Daily support while you wait.' },
  { key: 'medicated', label: "I'm taking prescribed ADHD medication", hint: 'Adds a quick treatment check-in.' },
  { key: 'in_therapy', label: "I work with a coach or counsellor", hint: 'Practise skills between sessions.' },
  { key: 'self_managing', label: "I'm managing on my own", hint: 'Practical help starting tasks.' },
  { key: 'prefer_not_to_say', label: "I'd rather not say", hint: 'That works too.' },
];

export function Onboarding({ onDone }: { onDone: (patch: Partial<UserProfile>) => void }) {
  const [care, setCare] = useState<CareContext | null>(null);
  const [mode, setMode] = useState<InteractionMode>('voice_and_text');
  const [proactive, setProactive] = useState(true);
  const [ack, setAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const p =
        new URLSearchParams(window.location.search).get('prompt') ||
        sessionStorage.getItem('stay_handoff_task') ||
        localStorage.getItem('stay_pending_prompt');
      if (p) setPendingPrompt(p);
    } catch {
      // storage blocked
    }
  }, []);

  const handleStart = () => {
    if (!care) {
      setError('Please select where you are with ADHD care.');
      return;
    }
    if (!ack) {
      setError('Please check the safety agreement: understand Stay is a support tool, not medical care.');
      return;
    }
    setError(null);
    onDone({
      careContext: care,
      interactionMode: mode,
      proactiveCheckins: proactive,
      onboardingCompleted: true,
    });
  };

  return (
    <section className="card mx-auto max-w-2xl p-6 sm:p-8" aria-labelledby="onb-title" data-testid="onboarding">
      {pendingPrompt && (
        <div
          className="mb-5 flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs sm:text-sm text-primary shadow-sm"
          data-testid="onboarding-saved-prompt"
        >
          <span className="font-semibold shrink-0">Saved your task:</span>
          <span className="truncate italic font-medium">&quot;{pendingPrompt}&quot;</span>
          <span className="ml-auto shrink-0 text-[11px] text-ink-3 hidden sm:inline">
            Will break down automatically once you click Start
          </span>
        </div>
      )}

      <h1 id="onb-title" className="section-title">Two quick questions</h1>
      <p className="text-ink-2 mt-2">This sets Stay&apos;s tone. You can change it later in Settings.</p>

      <fieldset className={`mt-6 ${error && !care ? 'rounded-xl p-2 ring-2 ring-amber-500/50' : ''}`}>
        <legend className="label">Where are you with ADHD care?</legend>
        <div className="mt-3 grid gap-2">
          {CARE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className="chip w-full justify-start py-3"
              aria-pressed={care === o.key}
              onClick={() => {
                setCare(o.key);
                if (error && !care) setError(null);
              }}
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
          <input type="checkbox" className="h-5 w-5 accent-[#8FD3FF]" checked={proactive} onChange={(e) => setProactive(e.target.checked)} />
          <span className="text-[0.95rem]">Check in with me when a focus block ends</span>
        </label>
      </fieldset>

      <p className="meta mt-6" data-testid="onboarding-age">
        Stay is for adults aged 18 or over. It is an AI, not a person.
      </p>

      <label
        className={`notice mt-3 flex items-start gap-3 cursor-pointer transition-all ${
          error && !ack ? 'border-red-500/60 bg-red-500/10 ring-2 ring-red-500/30' : ''
        }`}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#8FD3FF]"
          checked={ack}
          onChange={(e) => {
            setAck(e.target.checked);
            if (error && !ack) setError(null);
          }}
          data-testid="onboarding-ack"
        />
        <span>
          I understand Stay is a support tool, not medical care. It won&apos;t diagnose me or advise on medication, and it is
          not for emergencies.
        </span>
      </label>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs sm:text-sm text-red-600 dark:text-red-400 font-medium animate-shake" data-testid="onboarding-error" role="alert">
          {error}
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary mt-6 cursor-pointer"
        onClick={handleStart}
        data-testid="onboarding-done"
      >
        Start
      </button>
    </section>
  );
}
