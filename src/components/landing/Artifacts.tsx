'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { computeBarrierBreakdown, computeOverallMetrics, computeStrategyStats } from '@/lib/coach/patterns';
import { DEFAULT_ROUTINES } from '@/lib/routines/routines';
import { SAMPLE_SESSIONS } from './sampleWeek';

/* ---------------------------------------------------------------- brain dump */

interface DumpItem {
  id: string;
  text: string;
  firstStep?: string;
  minutes?: number;
}
const DUMP_TEXT = 'email the landlord, pay the council tax, call mum someday, the bins, book the dentist, reply to Sam when I have the energy';
const DUMP_START: DumpItem = { id: 'a', text: 'Email the landlord', firstStep: 'Open the email and type only the greeting', minutes: 5 };
const DUMP_TODAY: DumpItem[] = [
  { id: 'b', text: 'Pay the council tax' },
  { id: 'c', text: 'The bins' },
  { id: 'd', text: 'Book the dentist' },
];
const DUMP_LATER: DumpItem[] = [
  { id: 'e', text: 'Call mum someday' },
  { id: 'f', text: 'Reply to Sam' },
];

function BrainDumpCard() {
  const [today, setToday] = useState(DUMP_TODAY);
  const [later, setLater] = useState(DUMP_LATER);
  const move = (id: string) => {
    const it = later.find((x) => x.id === id);
    if (!it) return;
    setLater(later.filter((x) => x.id !== id));
    setToday([...today, it]);
  };
  const reset = () => {
    setToday(DUMP_TODAY);
    setLater(DUMP_LATER);
  };
  return (
    <article className="lp-art lp-art-dump" data-testid="art-dump">
      <header className="lp-art-head">
        <h3 className="card-title">Brain dump, sorted</h3>
        <span className="sample-badge">Sample</span>
      </header>
      <p className="lp-dump-in"><span className="meta block">You said, in no order</span>&ldquo;{DUMP_TEXT}&rdquo;</p>
      <div className="lp-sorted">
        <section aria-label="Start with this">
          <p className="label">Start with this</p>
          <div className="lp-start-item">
            <b>{DUMP_START.text}</b>
            <span>First step: {DUMP_START.firstStep}</span>
            <small className="tnum">{DUMP_START.minutes} minutes</small>
          </div>
        </section>
        <section aria-label="Today">
          <p className="label">Today</p>
          <ul>
            {today.map((i) => (
              <li key={i.id} data-moved={i.id === 'e' || i.id === 'f'}>{i.text}</li>
            ))}
          </ul>
        </section>
        <section aria-label="Later, no pressure">
          <p className="label">Later, no pressure</p>
          {later.length === 0 ? (
            <p className="meta">Nothing parked.</p>
          ) : (
            <ul>
              {later.map((i) => (
                <li key={i.id}>
                  <span>{i.text}</span>
                  <button type="button" className="btn btn-ghost !min-h-9 !px-2 !py-0 text-[0.82rem]" onClick={() => move(i.id)} aria-label={`Move to today: ${i.text}`}>
                    Move to today
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <footer className="lp-art-foot">
        <span className="meta">Nothing is overdue. Try moving one.</span>
        <button type="button" className="btn btn-ghost !min-h-9" onClick={reset}>Reset</button>
      </footer>
    </article>
  );
}

/* ---------------------------------------------------------------- routine */

const ROUTINE = DEFAULT_ROUTINES.find((r) => r.id === 'leaving') ?? DEFAULT_ROUTINES[0];

function RoutineCard() {
  const [i, setI] = useState(0);
  const [skipped, setSkipped] = useState<number[]>([]);
  const done = i >= ROUTINE.steps.length;
  const step = ROUTINE.steps[i];
  return (
    <article className="lp-art" data-testid="art-routine">
      <header className="lp-art-head">
        <h3 className="card-title">{ROUTINE.name}</h3>
        <span className="sample-badge">Built-in routine</span>
      </header>
      <ol className="lp-rsteps" aria-label="Steps">
        {ROUTINE.steps.map((s, n) => (
          <li key={s.text} data-state={n < i ? (skipped.includes(n) ? 'skipped' : 'done') : n === i ? 'now' : 'next'}>
            <i aria-hidden="true" />
          </li>
        ))}
      </ol>
      {done ? (
        <div className="lp-rnow">
          <p className="font-display text-xl font-semibold">That is the lot.</p>
          <p className="text-ink-2">{ROUTINE.steps.length - skipped.length} of {ROUTINE.steps.length} steps done, {skipped.length} skipped. Both are fine.</p>
        </div>
      ) : (
        <div className="lp-rnow" aria-live="polite">
          <span className="meta tnum">Step {i + 1} of {ROUTINE.steps.length}{step.minutes ? `, about ${step.minutes} min` : ''}</span>
          <p className="font-display text-xl font-semibold leading-snug" data-testid="routine-step">{step.text}</p>
        </div>
      )}
      <footer className="lp-art-foot">
        {done ? (
          <button type="button" className="btn btn-secondary" onClick={() => { setI(0); setSkipped([]); }}>Run it again</button>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)} data-testid="routine-next">Done, next</button>
            <button type="button" className="btn btn-ghost" onClick={() => { setSkipped([...skipped, i]); setI(i + 1); }}>Skip</button>
          </>
        )}
      </footer>
    </article>
  );
}

/* ---------------------------------------------------------------- reminder */

const MINUTES = [5, 10, 20] as const;
function ReminderCard() {
  const [m, setM] = useState<(typeof MINUTES)[number]>(20);
  const [set, setSet] = useState(false);
  return (
    <article className="lp-art" data-testid="art-reminder">
      <header className="lp-art-head">
        <h3 className="card-title">Check-ins that find you</h3>
        <span className="sample-badge">Sample</span>
      </header>
      <p className="text-ink-2">Say &ldquo;check in with me in {m} minutes&rdquo; any time, or set one here.</p>
      <div className="lp-chip-row" role="group" aria-label="Check in after">
        {MINUTES.map((x) => (
          <button key={x} type="button" className="chip" aria-pressed={m === x} onClick={() => { setM(x); setSet(false); }}>
            {x} min
          </button>
        ))}
      </div>
      <div className="lp-notif" data-on={set} aria-live="polite">
        <span className="lp-notif-dot" aria-hidden="true" />
        <div>
          <b>{set ? 'Stay' : 'Preview'}</b>
          <p>{set ? 'How is the email going? No rush, a line is enough.' : 'This is how the nudge looks when the time is up.'}</p>
          <small className="tnum">{set ? `in ${m} min` : 'not set'}</small>
        </div>
      </div>
      <footer className="lp-art-foot">
        <button type="button" className="btn btn-primary" onClick={() => setSet(!set)} aria-pressed={set} data-testid="reminder-set">{set ? 'Cancel check-in' : `Check in with me in ${m} min`}</button>
      </footer>
      <p className="meta">Fires from the browser tab while Stay is open, including in the background. A closed tab cannot wake itself.</p>
    </article>
  );
}

/* ---------------------------------------------------------------- clinician summary */

type Sec = 'care' | 'initiation' | 'strategies' | 'barriers';
const SECS: Array<[Sec, string]> = [
  ['care', 'Care context'],
  ['initiation', 'Task-initiation overview'],
  ['strategies', 'Strategy table'],
  ['barriers', 'Common barriers'],
];

function ReportCard() {
  const [on, setOn] = useState<Record<Sec, boolean>>({ care: true, initiation: true, strategies: true, barriers: true });
  const m = useMemo(() => computeOverallMetrics(SAMPLE_SESSIONS), []);
  const strategies = useMemo(() => computeStrategyStats(SAMPLE_SESSIONS), []);
  const barriers = useMemo(() => computeBarrierBreakdown(SAMPLE_SESSIONS).slice(0, 4), []);
  let n = 0;
  const num = () => ++n;
  return (
    <article className="lp-art lp-art-report" data-testid="art-report">
      <header className="lp-art-head">
        <h3 className="card-title">Summary for your appointment</h3>
        <span className="sample-badge">Sample</span>
      </header>
      <fieldset className="lp-toggles">
        <legend className="sr-only">Sections to include</legend>
        {SECS.map(([k, label]) => (
          <label key={k} className="lp-check">
            <input type="checkbox" checked={on[k]} onChange={(e) => setOn({ ...on, [k]: e.target.checked })} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <div className="lp-paper" aria-label="Preview of the PDF, with invented data">
        <p className="lp-paper-title">STAY: Patient Self-Tracked Appointment Summary</p>
        <p className="lp-paper-sub">Window: last 28 days</p>
        <p className="lp-paper-sample">SAMPLE DATA PREVIEW: synthetic demonstration records, not a real patient or clinical record.</p>
        <p className="lp-paper-box">Clinical boundary notice: this summary contains observational self-tracking logged by the user in Stay. Stay is not a medical device, diagnostic screener, or prescribing guide. All counts include exact sample denominators.</p>
        {on.care && (
          <>
            <p className="lp-paper-h">{num()}. Care context</p>
            <p>Reported status: Self-managing without formal clinical care</p>
          </>
        )}
        {on.initiation && (
          <>
            <p className="lp-paper-h">{num()}. Task-initiation overview</p>
            <p>Start rate: {m.overallStartRatePercent}% ({m.overallDenominatorLabel})</p>
            <p>Breakdown: {m.startedCount} started, {m.partlyStartedCount} partly started, {m.notStartedCount} not started, {m.pausedCount} paused</p>
          </>
        )}
        {on.strategies && (
          <>
            <p className="lp-paper-h">{num()}. Strategies (observational self-log)</p>
            <ul>
              {strategies.map((s) => (
                <li key={s.strategyKey}>{s.label}: {s.startRatePercent}% ({s.denominatorLabel})</li>
              ))}
            </ul>
          </>
        )}
        {on.barriers && (
          <>
            <p className="lp-paper-h">{num()}. Barriers reported</p>
            <ul>
              {barriers.map((b) => (
                <li key={b.barrierType}>{b.label}: {b.count} sessions ({b.sharePercent}%)</li>
              ))}
            </ul>
          </>
        )}
        {n === 0 && <p className="meta">Pick at least one section.</p>}
      </div>
      <footer className="lp-art-foot">
        <span className="meta">Built in your browser. You choose every section, nothing is sent.</span>
        <Link href="/app/reports" className="btn btn-secondary">Open the report builder</Link>
      </footer>
    </article>
  );
}

export function Artifacts() {
  return (
    <div className="lp-artifacts">
      <BrainDumpCard />
      <ReportCard />
      <RoutineCard />
      <ReminderCard />
    </div>
  );
}
