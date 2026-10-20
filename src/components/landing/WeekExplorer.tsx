'use client';

import Link from 'next/link';
import { useMemo, useState, type CSSProperties, type KeyboardEvent } from 'react';
import type { CoachSessionRecord, StrategyKey } from '@/types/domain';
import { computeOverallMetrics, computeStrategyStats } from '@/lib/coach/patterns';
import { BARRIER_DEFINITIONS, STRATEGY_DEFINITIONS } from '@/lib/coach/strategies';
import { weekTally, weekTallyLine } from '@/lib/coach/weekTally';
import { BANDS, SAMPLE_DAYS, SAMPLE_NOW, SAMPLE_SESSIONS, WEEKDAYS, bandOf, dayOf, hourOf, wonOutcome } from './sampleWeek';
import { useReveal } from './useReveal';

const RANGES = [7, 14, 28] as const;
type Range = (typeof RANGES)[number];
const STRATEGIES: StrategyKey[] = ['task_shrinking', 'implementation_intention', 'reframing', 'timeboxing'];
const OUTCOME_TEXT: Record<string, string> = { started: 'Started', partly_started: 'Partly started', not_started: 'Not started', paused_or_stopped: 'Paused' };

type Pick = { kind: 'day'; day: number } | { kind: 'cell'; dow: number; band: number } | null;

const dayName = (d: number) => `${WEEKDAYS[d % 7]}, week ${Math.floor(d / 7) + 1}`;
const timeText = (s: CoachSessionRecord) => `${String(hourOf(s)).padStart(2, '0')}:${String(new Date(s.createdAt).getUTCMinutes()).padStart(2, '0')}`;

/** Arrow-key movement for a roving tabindex group of buttons. */
function rove(e: KeyboardEvent<HTMLElement>, next: (dx: number, dy: number) => void) {
  const map: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const m = map[e.key];
  if (!m) return;
  e.preventDefault();
  next(m[0], m[1]);
}

export function WeekExplorer() {
  const [range, setRange] = useState<Range>(14);
  const [strategy, setStrategy] = useState<StrategyKey | 'all'>('all');
  const [pick, setPick] = useState<Pick>({ kind: 'day', day: SAMPLE_DAYS - 2 });
  const { ref, state } = useReveal<HTMLDivElement>(0.15);

  const first = SAMPLE_DAYS - range;
  const inRange = useMemo(() => SAMPLE_SESSIONS.filter((s) => dayOf(s) >= first), [first]);
  const shown = useMemo(() => (strategy === 'all' ? inRange : inRange.filter((s) => s.strategyKey === strategy)), [inRange, strategy]);
  const overall = useMemo(() => computeOverallMetrics(shown), [shown]);
  const stats = useMemo(() => computeStrategyStats(inRange), [inRange]);
  const tally = useMemo(() => weekTally(shown, SAMPLE_NOW), [shown]);

  const days = useMemo(() => {
    const rows = Array.from({ length: SAMPLE_DAYS }, (_, d) => ({ d, started: 0, partly: 0, other: 0, list: [] as CoachSessionRecord[] }));
    for (const s of SAMPLE_SESSIONS) {
      if (strategy !== 'all' && s.strategyKey !== strategy) continue;
      const row = rows[dayOf(s)];
      row.list.push(s);
      if (s.outcome === 'started') row.started++;
      else if (s.outcome === 'partly_started') row.partly++;
      else row.other++;
    }
    return rows;
  }, [strategy]);
  const visibleDays = days.slice(first);
  const maxBlocks = Math.max(4, ...visibleDays.map((r) => r.list.length));

  const heat = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => Array.from({ length: BANDS.length }, () => ({ n: 0, won: 0, list: [] as CoachSessionRecord[] })));
    for (const s of shown) {
      const b = bandOf(s);
      if (b < 0) continue;
      const cell = grid[dayOf(s) % 7][b];
      cell.n++;
      if (wonOutcome(s.outcome)) cell.won++;
      cell.list.push(s);
    }
    return grid;
  }, [shown]);

  const best = [...stats].filter((s) => s.attempts >= 3).sort((a, b) => (b.startRatePercent ?? 0) - (a.startRatePercent ?? 0))[0];

  const inspector = (() => {
    if (!pick) return { title: 'Pick a day or a time of day', body: 'Select a bar, a square or a dot to see the blocks behind it.', list: [] as CoachSessionRecord[] };
    if (pick.kind === 'day') {
      const row = days[pick.day];
      const won = row.started + row.partly;
      return {
        title: dayName(pick.day),
        body: row.list.length === 0 ? 'No blocks. A quiet day is just a quiet day; nothing resets.' : `${won} of ${row.list.length} block${row.list.length === 1 ? '' : 's'} got started${row.partly ? ` (${row.partly} partly)` : ''}.`,
        list: row.list,
      };
    }
    const cell = heat[pick.dow][pick.band];
    const band = BANDS[pick.band];
    return {
      title: `${WEEKDAYS[pick.dow]}s, ${band.hours}h`,
      body: cell.n === 0 ? 'No blocks in this slot in the chosen range.' : `${cell.won} of ${cell.n} block${cell.n === 1 ? '' : 's'} got started (fully or partly).${cell.n < 3 ? ' Too few to read anything into.' : ''}`,
      list: cell.list,
    };
  })();

  const rovingDay = (from: number, dx: number) => {
    const next = Math.min(SAMPLE_DAYS - 1, Math.max(first, from + dx));
    setPick({ kind: 'day', day: next });
    document.getElementById(`lp-day-${next}`)?.focus();
  };
  const rovingCell = (dow: number, band: number, dx: number, dy: number) => {
    const nd = Math.min(6, Math.max(0, dow + dy));
    const nb = Math.min(BANDS.length - 1, Math.max(0, band + dx));
    setPick({ kind: 'cell', dow: nd, band: nb });
    document.getElementById(`lp-cell-${nd}-${nb}`)?.focus();
  };
  const dayTab = pick?.kind === 'day' && pick.day >= first ? pick.day : SAMPLE_DAYS - 1;
  const cellTab = pick?.kind === 'cell' ? pick : { dow: 0, band: 1 };

  return (
    <div ref={ref} data-reveal={state} className="lp-explorer" data-testid="week-explorer">
      <div className="lp-explorer-head">
        <div>
          <span className="sample-badge" data-testid="sample-badge">Sample: seeded, made-up blocks</span>
          <p className="meta mt-2 max-w-[60ch]">
            Four weeks of invented focus blocks, generated once from a fixed seed. The charts below run through the same code as your real History page.
          </p>
        </div>
        <Link href="/app/history" className="btn btn-secondary" data-testid="week-real-link">
          Open your real History
        </Link>
      </div>

      <div className="lp-controls">
        <div role="radiogroup" aria-label="Time range" className="lp-seg">
          {RANGES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={range === r} data-testid={`range-${r}`} onClick={() => setRange(r)}>
              {r} days
            </button>
          ))}
        </div>
        <div className="lp-chip-row" role="group" aria-label="Strategy filter">
          <button type="button" className="chip" aria-pressed={strategy === 'all'} onClick={() => setStrategy('all')}>
            All strategies
          </button>
          {STRATEGIES.map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={strategy === k} data-testid={`filter-${k}`} onClick={() => setStrategy(strategy === k ? 'all' : k)}>
              {STRATEGY_DEFINITIONS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="lp-explorer-grid">
        <section className="card lp-panel lp-kpi" aria-label="Summary">
          <p className="meta">{strategy === 'all' ? `Last ${range} days` : `Last ${range} days, ${STRATEGY_DEFINITIONS[strategy].label}`}</p>
          <p className="lp-big tnum" data-testid="explorer-rate">
            {overall.overallStartRatePercent === null ? 'No data' : `${overall.overallStartRatePercent}%`}
          </p>
          <p className="meta" data-testid="explorer-denominator">{overall.overallDenominatorLabel}</p>
          <p className="mt-4 text-[0.95rem]" data-testid="explorer-tally">{weekTallyLine(tally).replace('this week', 'in the final week')}</p>
          <p className="meta mt-1 tnum">{overall.totalFocusedMinutes} minutes of logged focus time.</p>
          {best && strategy === 'all' && (
            <p className="mt-4 text-[0.95rem]">
              <span className="font-medium">{best.label}</span> is ahead so far ({best.denominatorLabel}). Stay suggests it a little more often.
            </p>
          )}
        </section>

        <section className="card lp-panel lp-days" aria-labelledby="lp-days-title">
          <h3 id="lp-days-title" className="card-title">Blocks started, day by day</h3>
          <p className="meta">Each bar is one day. Dark is started, light is partly, grey did not start.</p>
          <div className="lp-bars" role="group" aria-label="Blocks per day" style={{ '--cols': visibleDays.length } as CSSProperties}>
            {visibleDays.map((row) => {
              const total = row.list.length;
              const active = pick?.kind === 'day' && pick.day === row.d;
              return (
                <button
                  key={row.d}
                  id={`lp-day-${row.d}`}
                  type="button"
                  className="lp-col"
                  aria-pressed={active}
                  tabIndex={row.d === dayTab ? 0 : -1}
                  aria-label={`${dayName(row.d)}: ${total} block${total === 1 ? '' : 's'}, ${row.started} started, ${row.partly} partly`}
                  data-testid="day-bar"
                  onClick={() => setPick({ kind: 'day', day: row.d })}
                  onKeyDown={(e) => rove(e, (dx) => rovingDay(row.d, dx))}
                >
                  <span className="lp-stack lp-growy" style={{ height: `${(total / maxBlocks) * 100}%` }}>
                    <span className="lp-seg-other" style={{ flexGrow: row.other }} />
                    <span className="lp-seg-partly" style={{ flexGrow: row.partly }} />
                    <span className="lp-seg-started" style={{ flexGrow: row.started }} />
                  </span>
                  <span className="lp-col-label" aria-hidden="true">{range === 28 ? (row.d % 7 === 0 ? `w${Math.floor(row.d / 7) + 1}` : '') : WEEKDAYS[row.d % 7].slice(0, 1)}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="card lp-panel" aria-labelledby="lp-strat-title">
          <h3 id="lp-strat-title" className="card-title">What helps you start</h3>
          <p className="meta">Start rate per strategy, with the exact count. Faded bars have fewer than 3 tries.</p>
          <ul className="lp-strats">
            {stats.map((s) => (
              <li key={s.strategyKey}>
                <button type="button" className="lp-strat" aria-pressed={strategy === s.strategyKey} onClick={() => setStrategy(strategy === s.strategyKey ? 'all' : s.strategyKey)}>
                  <span className="lp-strat-top">
                    <span>{s.label}</span>
                    <span className="meta tnum" data-testid="strategy-denominator">{s.denominatorLabel}</span>
                  </span>
                  <span className="bar-track">
                    <span className="bar-fill lp-grow lp-origin" style={{ width: `${s.startRatePercent ?? 0}%`, opacity: s.isPreliminary ? 0.45 : 1, display: 'block' }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="card lp-panel" aria-labelledby="lp-heat-title">
          <h3 id="lp-heat-title" className="card-title">When you tend to start</h3>
          <p className="meta">Darker means more blocks got started. The number is how many blocks there were. Columns are the hour a block began, in three-hour bands.</p>
          <div className="lp-heat" role="grid" aria-label="Start rate by weekday and time of day">
            <div className="lp-heat-head" role="row" aria-hidden="true">
              <span />
              {BANDS.map((b) => (
                <span key={b.label} className="tnum">{b.from}h</span>
              ))}
            </div>
            {heat.map((row, dow) => (
              <div className="lp-heat-row" role="row" key={WEEKDAYS[dow]}>
                <span className="lp-heat-day" role="rowheader">{WEEKDAYS[dow]}</span>
                {row.map((c, band) => {
                  const active = pick?.kind === 'cell' && pick.dow === dow && pick.band === band;
                  return (
                    <button
                      key={band}
                      id={`lp-cell-${dow}-${band}`}
                      type="button"
                      role="gridcell"
                      className="lp-cell"
                      data-empty={c.n === 0}
                      aria-pressed={active}
                      tabIndex={dow === cellTab.dow && band === cellTab.band ? 0 : -1}
                      aria-label={`${WEEKDAYS[dow]} ${BANDS[band].hours}h: ${c.n === 0 ? 'no blocks' : `${c.won} of ${c.n} started`}`}
                      style={{ '--v': c.n ? c.won / c.n : 0 } as CSSProperties}
                      onClick={() => setPick({ kind: 'cell', dow, band })}
                      onKeyDown={(e) => rove(e, (dx, dy) => rovingCell(dow, band, dx, dy))}
                    >
                      <span className="tnum">{c.n || ''}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>

        <section className="card lp-panel" aria-labelledby="lp-wins-title">
          <h3 id="lp-wins-title" className="card-title">Wins, without a streak</h3>
          <p className="meta">One dot per day. Bigger means more blocks started. There is no counter to protect and nothing to lose by skipping a day.</p>
          <div className="lp-dots" role="group" aria-label="Wins per day">
            {days.map((row) => {
              const won = row.started + row.partly;
              const faded = row.d < first;
              return (
                <button
                  key={row.d}
                  type="button"
                  className="lp-dot"
                  data-faded={faded}
                  tabIndex={-1}
                  aria-label={`${dayName(row.d)}: ${won} started`}
                  onClick={() => !faded && setPick({ kind: 'day', day: row.d })}
                >
                  <span style={{ '--s': won === 0 ? 0 : 0.34 + Math.min(won, 4) * 0.16 } as CSSProperties} data-empty={won === 0} />
                </button>
              );
            })}
          </div>
        </section>

        <section className="card lp-panel lp-inspector" aria-live="polite" data-testid="explorer-inspector">
          <h3 className="card-title">{inspector.title}</h3>
          <p className="mt-1 text-ink-2">{inspector.body}</p>
          {inspector.list.length > 0 && (
            <ul className="lp-ilist">
              {inspector.list.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{s.taskText}</span>
                  <span className="meta block">
                    {OUTCOME_TEXT[s.outcome ?? 'not_started']} · {timeText(s)} · {BARRIER_DEFINITIONS[s.barrierType].label} · {STRATEGY_DEFINITIONS[s.strategyKey].label}
                  </span>
                </li>
              ))}
              {inspector.list.length > 5 && <li className="meta">and {inspector.list.length - 5} more</li>}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
