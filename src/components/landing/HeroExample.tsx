'use client';

import { useEffect, useRef, useState } from 'react';
import { FoldBody, FoldEdges, FoldSpine, foldVars } from './FoldFrame';

type Line = { who: 'you' | 'stay'; text: string };

/**
 * Four short exchanges, word for word from real test calls (a synthetic speaker in a Gen Z voice against Stay on the real model;
 * docs/evidence/loop/soak-run6 and soak-run7). Stay's replies are the app's real replies; the speaker's lines are what the synthetic
 * voice said. The caption says so: a recorded test call, a synthetic caller, real replies.
 */
export const SCENES: Array<{ id: string; chip: string; lines: Line[] }> = [
  {
    id: 'doomscroll',
    chip: 'Doom-scrolling',
    lines: [
      { who: 'you', text: "I have been on Instagram for two hours and I don't even remember what I looked at." },
      { who: 'stay', text: 'Close the Instagram app now. Then open the task you actually want to do.' },
      { who: 'you', text: "Okay but I have a paper due at nine tomorrow and I'm just scrolling reels." },
      { who: 'stay', text: 'Set a timer for fifteen minutes and work on the paper until it rings. Want me to start it?' },
      { who: 'you', text: "Ugh, fine. Phone goes face down. What's the next step after that?" },
      { who: 'stay', text: 'Set a timer for five minutes and type the first paragraph of your paper’s introduction.' },
    ],
  },
  {
    id: 'decide',
    chip: "Can't decide",
    lines: [
      { who: 'you', text: "Should I do the assignment first or reply to my group chat? I can't decide." },
      { who: 'stay', text: 'Pick the task with the sooner deadline, then set a two‑minute timer to start it.' },
      { who: 'you', text: 'Just pick for me. Seriously. Pick one.' },
      { who: 'stay', text: 'Start the assignment now; set a two‑minute timer and write the first paragraph.' },
      { who: 'you', text: 'Okay but what if the group chat is mad at me? Ugh.' },
      { who: 'stay', text: 'The assignment is the safest choice; open it and write the intro for two minutes.' },
    ],
  },
  {
    id: 'rent',
    chip: 'Rent text',
    lines: [
      { who: 'you', text: 'I just avoid it. Every time I open the text my stomach drops.' },
      { who: 'stay', text: 'That physical reaction is real for you. Want to break this down into tiny steps to make it feel less big?' },
      { who: 'you', text: 'Okay, what do I even say? Give me the first sentence.' },
      { who: 'stay', text: 'Hey, I’m working on the rent payment and will have it sorted by tomorrow.' },
    ],
  },
  {
    id: 'study',
    chip: 'Study block',
    lines: [
      { who: 'you', text: 'Explain how to build a study schedule for finals. Like all of it.' },
      { who: 'stay', text: 'First, list each exam date, then assign study blocks for each subject leading up to those dates. Want a detailed step‑by‑step plan?' },
      { who: 'you', text: 'Wait wait, stop. Too long. Just give me the first block.' },
      { who: 'stay', text: 'Study for the first exam for 30 minutes right after breakfast tomorrow.' },
      { who: 'you', text: 'Fine. That works. What do I do after the first block?' },
      { who: 'stay', text: 'Take a 5‑minute stretch break, then start the next subject.' },
    ],
  },
];

/**
 * What each exchange solved, taken from Stay's own words in that scene (a test checks every detail is a quote from one of its replies).
 * It is shown last, as the step the person walks away with.
 */
export const OUTCOME: Record<string, { title: string; detail: string }> = {
  doomscroll: { title: 'Timer, 5 min', detail: 'type the first paragraph of your paper’s introduction' }, // claims-lint-allow: minutes quoted from Stay's real replies (docs/evidence/loop/soak-run6, soak-run7); heroExample.test.ts checks them
  decide: { title: 'First step, 2 min', detail: 'open it and write the intro for two minutes' }, // claims-lint-allow: minutes quoted from Stay's real replies (docs/evidence/loop/soak-run6, soak-run7); heroExample.test.ts checks them
  rent: { title: 'First sentence', detail: 'Hey, I’m working on the rent payment and will have it sorted by tomorrow.' },
  study: { title: 'First block, 30 min', detail: 'Study for the first exam for 30 minutes right after breakfast tomorrow.' },
};

// Pace. Real speech runs near 150 words a minute; the words here arrive a little quicker than that so the call does not drag, with the
// pauses a voice makes at a comma and at the end of a sentence. Every word fades in.
const LEAD = { you: 600, stay: 850 }; // the voice wave before the words / the thinking dots before Stay's words
const PER_WORD = { you: 170, stay: 200 };
const PAUSE_SENTENCE = 300;
const PAUSE_CLAUSE = 150;
const GAP = 650;
const HOLD = 3800;
const SOLVE_MS = 1100; // the ring turns while it is being worked out, then it is a tick
const TICK = 60;
// The fold: the second screen swings shut over the first (CLOSE_MS), lies shut a beat while the next call is swapped in (SHUT_MS),
// then unfolds (OPEN_MS, the last part of it a short settle) and the new call begins the moment it is open. About 1.2 s in all.
// fold.css animates the same numbers. Nothing on the screens moves while they fold, so the blur is not recomputed on every frame.
const CLOSE_MS = 540;
const SHUT_MS = 60;
const OPEN_MS = 600;

/** The moment each word appears, in ms from the first word. */
export function wordOffsets(text: string, who: 'you' | 'stay'): number[] {
  let t = 0;
  return text.split(' ').map((w) => {
    const at = t;
    t += PER_WORD[who] + (/[.?!]["”’)]?$/.test(w) ? PAUSE_SENTENCE : /[,;:]$/.test(w) ? PAUSE_CLAUSE : 0);
    return at;
  });
}

/** When each line starts, when its words start, when it ends, and how long the whole scene runs. */
export function plan(lines: Line[]) {
  let t = 0;
  const steps = lines.map((l) => {
    const offsets = wordOffsets(l.text, l.who);
    const start = t;
    const textStart = start + LEAD[l.who];
    const end = textStart + offsets[offsets.length - 1] + PER_WORD[l.who];
    t = end + GAP;
    return { start, textStart, end, offsets };
  });
  const outcomeAt = (steps[steps.length - 1]?.end ?? 0) + 600; // the solved card appears after the last reply
  return { steps, outcomeAt, total: outcomeAt + SOLVE_MS + HOLD };
}

/** The first screen holds the first half of the call (always the first exchange); the rest, and the solved card, continue on the second. */
export const onSecondScreen = (index: number, count: number) => index >= Math.ceil(count / 2);

const PLANS = SCENES.map((s) => plan(s.lines));
/** Where the first scene starts: the first line and Stay's reply are already on screen, then the call carries on. */
const OPENING = PLANS[0].steps[1].end;

type Phase = 'play' | 'closing' | 'opening';
/** t: ms into the call (frozen while the screens close, and negative while they open: the new call starts as they finish); p: ms into the fold; next: the scene that will be showing after the fold. */
type Clock = { scene: number; next: number; phase: Phase; t: number; p: number };

function advance(c: Clock): Clock {
  const p = c.p + TICK;
  if (c.phase === 'closing') {
    return p >= CLOSE_MS + SHUT_MS ? { scene: c.next, next: c.next, phase: 'opening', t: -OPEN_MS, p: 0 } : { ...c, p };
  }
  const t = c.t + TICK;
  if (c.phase === 'opening') {
    if (p < OPEN_MS) return { ...c, t, p };
    return c.next === c.scene ? { ...c, t, phase: 'play', p } : { ...c, t, phase: 'closing', p: 0 }; // a scene was chosen while opening
  }
  const { total } = PLANS[c.scene];
  return t >= total ? { ...c, t: total, phase: 'closing', p: 0, next: (c.scene + 1) % SCENES.length } : { ...c, t };
}

function Wave() {
  return (
    <span className="fd-wave" aria-hidden="true">
      <i /><i /><i /><i /><i />
    </span>
  );
}

function Dots() {
  return (
    <span className="fd-dots" aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

type Row = { line: Line; i: number; step: ReturnType<typeof plan>['steps'][number] };

function Bubble({ row, t, reduced }: { row: Row; t: number; reduced: boolean }) {
  const { line, step } = row;
  const words = line.text.split(' ');
  const heard = reduced || t >= step.textStart;
  const n = reduced ? words.length : step.offsets.filter((o) => o <= t - step.textStart).length;
  const talking = !reduced && t < step.end;
  const you = line.who === 'you';
  return (
    <p className={`bubble fd-bubble fd-pop ${you ? 'fd-bubble-you' : 'fd-bubble-stay'}`}>
      {heard
        ? words.slice(0, Math.max(1, n)).map((w, k) => (
            <span key={k} className={reduced ? undefined : 'fd-word'}>{w}{' '}</span>
          ))
        : you ? <Wave /> : <Dots />}
      {heard && talking && you && <Wave />}
    </p>
  );
}

type ScreenProps = { id: 'a' | 'b'; rows: Row[]; scene: number; t: number; reduced: boolean; status: string | null; speaking: boolean; children?: React.ReactNode };

function Screen({ id, rows, scene, t, reduced, status, speaking, children }: ScreenProps) {
  return (
    <>
    <div className="fd-screen" data-screen={id}>
      <div className="fd-bar">
        <span className="fd-face" data-mode={speaking ? 'speaking' : 'idle'}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/stay-mark.svg" alt="" width={24} height={24} />
        </span>
        {status !== null && <span className="fd-status" data-testid="hero-status">{status}</span>}
      </div>
      <div className="fd-thread">
        {rows.map((row) => (
          <Bubble key={`${scene}-${row.i}`} row={row} t={t} reduced={reduced} />
        ))}
      </div>
      {children}
    </div>
    <div className="fd-glare">
      <i className="fd-sheen"><i className="fd-sheen-i" /></i>
      <i className="fd-crease" />
    </div>
    </>
  );
}

const TILT_MAX = 8; // degrees: the most the device turns to follow the pointer
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function HeroExample() {
  const [clock, setClock] = useState<Clock>({ scene: 0, next: 0, phase: 'play', t: OPENING, p: 0 });
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const ref = useRef<HTMLElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const halted = paused || !onScreen;

  useEffect(() => {
    if (halted || reduced) return;
    const id = setInterval(() => setClock(advance), TICK);
    return () => clearInterval(id);
  }, [halted, reduced]);

  // The device leans toward the pointer, up to TILT_MAX degrees. Mouse and pen only, never touch, never with reduced motion, and only while it is playing on screen.
  // The tilt is two custom properties; fold.css turns them into an eased transform, so this code never animates anything.
  useEffect(() => {
    const el = deviceRef.current;
    if (!el || halted || reduced || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty('--tilt-ry', (x * TILT_MAX).toFixed(2));
      el.style.setProperty('--tilt-rx', (-y * TILT_MAX).toFixed(2));
    };
    const aim = (nx: number, ny: number) => {
      x = nx;
      y = ny;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      aim(clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1), clamp((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2), -1, 1));
    };
    const rest = () => aim(0, 0);
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', rest);
    window.addEventListener('blur', rest);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', rest);
      window.removeEventListener('blur', rest);
      if (frame) cancelAnimationFrame(frame);
      el.style.removeProperty('--tilt-ry');
      el.style.removeProperty('--tilt-rx');
    };
  }, [halted, reduced]);

  // asking for reduced motion mid-call: land on the scene that was on its way, fully drawn, with no fold
  useEffect(() => {
    if (reduced) setClock((c) => ({ ...c, scene: c.next, phase: 'play' }));
  }, [reduced]);

  const pick = (i: number) => {
    setPaused(false);
    setClock((c) => {
      if (reduced) return { scene: i, next: i, phase: 'play', t: 0, p: 0 };
      return c.phase === 'play' ? { ...c, next: i, phase: 'closing', p: 0 } : { ...c, next: i };
    });
  };

  const { scene, next, t } = clock;
  const phase = reduced ? 'play' : clock.phase;
  const current = SCENES[scene];
  const { steps, outcomeAt } = PLANS[scene];
  const outcome = OUTCOME[current.id];
  const count = current.lines.length;

  // what is on screen now: every line that has started (all of them when motion is reduced), each on its own screen
  const rows: Row[] = current.lines.map((line, i) => ({ line, i, step: steps[i] })).filter(({ step }) => reduced || t >= step.start);
  const live = reduced || phase === 'closing' ? undefined : rows.find(({ step }) => t >= step.start && t < step.end);
  const speaking = live?.line.who === 'stay' && t >= live.step.textStart;
  const status = paused ? 'Paused' : reduced ? 'Example' : live ? (live.line.who === 'you' ? 'Listening' : 'Speaking') : 'Listening';
  const lastOnB = !reduced && rows.length > 0 && onSecondScreen(rows[rows.length - 1].i, count);
  const rowsA = rows.filter(({ i }) => !onSecondScreen(i, count));
  const rowsB = rows.filter(({ i }) => onSecondScreen(i, count));
  const solvedShown = reduced || t >= outcomeAt;
  const solved = reduced || t >= outcomeAt + SOLVE_MS;

  return (
    <figure ref={ref} className="lp-hero-example fd-figure" data-testid="hero-example" aria-labelledby="hero-example-caption">
      {/* the device is a picture of the call; the same words are in the list below for a screen reader */}
      <div ref={deviceRef} className="fd" data-phase={phase} data-halt={halted ? 'true' : 'false'} style={foldVars()} aria-hidden="true">
        <div className="fd-light" />
        <div className="fd-shadows">
          <i className="fd-shadow fd-shadow-a"><i /></i>
          <i className="fd-shadow fd-shadow-b"><i /></i>
        </div>
        <div className="fd-stage">
          <div className="fd-tilt">
            <div className="fd-float">
              <div className="fd-half fd-a">
                <FoldEdges role="a" />
                <div className="fd-front">
                  <FoldBody role="a" />
                  <Screen id="a" rows={rowsA} scene={scene} t={t} reduced={reduced} status={lastOnB ? null : status} speaking={!!speaking && !lastOnB}>
                    <i className="fd-cam fd-only-tall" />
                  </Screen>
                  <i className="fd-ring" />
                </div>
              </div>
              <FoldSpine />
              <div className="fd-half fd-b">
                <FoldEdges role="b" />
                <div className="fd-front">
                  <FoldBody role="b" />
                  <Screen id="b" rows={rowsB} scene={scene} t={t} reduced={reduced} status={lastOnB ? status : null} speaking={!!speaking && lastOnB}>
                    <i className="fd-cam fd-only-wide" />
                    <div className="fd-outcome-slot">
                      {solvedShown && (
                        <div className="fd-outcome fd-pop" data-testid="hero-outcome">
                          <span className={`fd-solve ${solved ? 'fd-solve-done' : ''}`} />
                          <div>
                            <p className="fd-outcome-title">{outcome.title}</p>
                            <p className="fd-outcome-detail">{outcome.detail}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Screen>
                  <i className="fd-ring" />
                </div>
                <i className="fd-back" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fd-controls">
        <div className="fd-chips" role="group" aria-label="Example conversations">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={i === next}
              data-testid={`hero-scene-${s.id}`}
              className={`fd-chip ${i === next ? 'fd-chip-on' : ''}`}
            >
              {s.chip}
            </button>
          ))}
        </div>
        {!reduced && (
          <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} className="fd-chip fd-pause" data-testid="hero-pause">
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>

      {/* the whole exchange for people who read it with a screen reader, first screen then second; the picture above repeats it */}
      <ol className="sr-only">
        {SCENES[next].lines.map((l, i) => (
          <li key={i}>{l.who === 'you' ? 'You' : 'Stay'}: {l.text}</li>
        ))}
        <li>Result: {OUTCOME[SCENES[next].id].title}, {OUTCOME[SCENES[next].id].detail}</li>
      </ol>

      <figcaption id="hero-example-caption" className="meta fd-caption">
        A recorded test call. The caller is synthetic; Stay&apos;s replies are real.
      </figcaption>
    </figure>
  );
}
