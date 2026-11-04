'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { addRoutine, findRoutine, loadRoutines, parseSteps, removeRoutine, type Routine } from '@/lib/routines/routines';

const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

const EXAMPLE_ROUTINE = {
  name: 'Study session',
  steps: 'Water and healthy snack - 3\nPhone in another room\nOpen the notes - 2\nReview first section - 15',
};

/**
 * Routines, one step at a time. The current step is big, has its own short timer, and is read out when the voice is live.
 * Finishing a step moves on; skipping is always fine; nothing is scored.
 */
export function RoutineSheet({ initialId, onClose, onSpeak, onComplete }: { initialId?: string | null; onClose: () => void; onSpeak: (line: string) => void; onComplete: (r: Routine) => void }) {
  const [list, setList] = useState<Routine[]>([]);
  const [running, setRunning] = useState<{ routine: Routine; index: number; endsAt: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [name, setName] = useState('');
  const [steps, setSteps] = useState('');
  const [error, setError] = useState<string | null>(null);
  const speakRef = useRef(onSpeak);
  speakRef.current = onSpeak;

  const begin = (routine: Routine, index = 0) => {
    const step = routine.steps[index];
    setRunning({ routine, index, endsAt: Date.now() + (step.minutes || 0) * 60_000 });
    setLeft((step.minutes || 0) * 60);
    speakRef.current(`${index === 0 ? `${routine.name}. ` : ''}Step ${index + 1} of ${routine.steps.length}: ${step.text}`);
  };

  useEffect(() => {
    const all = loadRoutines();
    setList(all);
    if (initialId) {
      const r = all.find((x) => x.id === initialId) ?? findRoutine(initialId, all);
      if (r) begin(r);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running || !running.routine.steps[running.index].minutes) return;
    const id = window.setInterval(() => setLeft(Math.max(0, Math.round((running.endsAt - Date.now()) / 1000))), 500);
    return () => window.clearInterval(id);
  }, [running]);

  const next = () => {
    if (!running) return;
    const i = running.index + 1;
    if (i >= running.routine.steps.length) {
      onComplete(running.routine);
      setRunning(null);
      onClose();
      return;
    }
    begin(running.routine, i);
  };

  const loadExample = () => {
    setName(EXAMPLE_ROUTINE.name);
    setSteps(EXAMPLE_ROUTINE.steps);
    setError(null);
  };

  const handleSaveRoutine = () => {
    const trimmedName = name.trim();
    const parsed = parseSteps(steps);
    if (!trimmedName) {
      setError('Please provide a name for your routine (or click "Use example template").');
      return;
    }
    if (parsed.length === 0) {
      setError('Please type at least one step (e.g. "open notes - 2") or click "Use example template".');
      return;
    }
    setError(null);
    setList(addRoutine(trimmedName, parsed));
    setName('');
    setSteps('');
    setMode('list');
  };

  if (running) {
    const step = running.routine.steps[running.index];
    return (
      <Sheet title={running.routine.name} onClose={onClose}>
        <div data-testid="routine-run">
          <p className="meta" aria-live="polite">Step {running.index + 1} of {running.routine.steps.length}</p>
          <div className="mt-1 flex gap-1" aria-hidden="true">
            {running.routine.steps.map((_, i) => (
              <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= running.index ? 'var(--color-accent)' : 'var(--color-line)' }} />
            ))}
          </div>
          <p className="mt-5 font-display text-2xl font-semibold leading-snug" data-testid="routine-step">{step.text}</p>
          {step.minutes > 0 && <p className="tnum mt-3 font-display text-4xl font-semibold" aria-label="Time left for this step">{clock(left)}</p>}
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={next} data-testid="routine-next">
              {running.index + 1 === running.routine.steps.length ? 'Finish' : 'Done, next'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={next} data-testid="routine-skip">Skip this one</button>
            <button type="button" className="btn btn-ghost" onClick={() => setRunning(null)}>Stop</button>
          </div>
        </div>
      </Sheet>
    );
  }

  if (mode === 'new') {
    const parsed = parseSteps(steps);
    return (
      <Sheet title="New routine" onClose={onClose}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-ink-3">Your own steps, each with its own timer.</span>
          <button
            type="button"
            onClick={loadExample}
            className="text-xs font-medium text-primary hover:underline cursor-pointer"
            data-testid="routine-load-template"
          >
            Use example template
          </button>
        </div>

        <label className="block">
          <span className="label">Name</span>
          <input
            className="field mt-1 w-full placeholder:italic placeholder:text-ink-4/60"
            value={name}
            maxLength={40}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Study session"
            data-testid="routine-name"
          />
        </label>

        <label className="mt-3 block">
          <span className="label">Steps, one per line (add minutes like &ldquo;tidy desk - 5&rdquo;)</span>
          <textarea
            className="field mt-1 min-h-[8rem] w-full p-3 font-sans placeholder:italic placeholder:text-ink-4/60"
            value={steps}
            onChange={(e) => {
              setSteps(e.target.value);
              if (error) setError(null);
            }}
            placeholder={'e.g.\nwater and snack - 3\nphone in another room\nopen the notes - 2'}
            data-testid="routine-steps"
          />
        </label>

        <div className="mt-2 flex items-center justify-between text-xs text-ink-3">
          <span className="meta">{parsed.length} step{parsed.length === 1 ? '' : 's'}</span>
          <span>Minutes: {parsed.reduce((acc, s) => acc + s.minutes, 0)}m</span>
        </div>

        {error && (
          <div
            className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger font-medium"
            data-testid="routine-error"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn btn-primary cursor-pointer"
            onClick={handleSaveRoutine}
            data-testid="routine-save"
          >
            Save routine
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setMode('list')}>
            Back
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Routines" onClose={onClose}>
      <p className="meta">One step at a time, each with its own timer. Say &ldquo;start my morning routine&rdquo; any time.</p>
      <ul className="mt-3 space-y-2" data-testid="routine-list">
        {list.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-recessed p-3">
            <span>
              <span className="block font-medium">{r.name}</span>
              <span className="meta">{r.steps.length} steps, about {r.steps.reduce((a, s) => a + s.minutes, 0)} min</span>
            </span>
            <span className="flex shrink-0 gap-1">
              <button type="button" className="btn btn-primary" onClick={() => begin(r)} data-testid={`routine-start-${r.id}`}>Start</button>
              {!r.builtIn && <button type="button" className="btn btn-ghost" aria-label={`Delete ${r.name}`} onClick={() => setList(removeRoutine(r.id))}>Delete</button>}
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-secondary mt-4" onClick={() => setMode('new')} data-testid="routine-new">New routine</button>
    </Sheet>
  );
}
