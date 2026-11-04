'use client';

import { useEffect, useRef, useState } from 'react';

type Line = { who: 'you' | 'stay'; text: string };

/**
 * Four short exchanges, word for word from real test calls (a synthetic speaker in a Gen Z voice against Stay on the real model;
 * docs/evidence/loop/soak-run6 and soak-run7). Stay's replies are the app's real replies; the speaker's lines are what the synthetic
 * voice said. Real replies are generated live and differ each time, which the caption says.
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
  doomscroll: { title: 'Timer · 5 min', detail: 'type the first paragraph of your paper’s introduction' }, // claims-lint-allow: minutes quoted from Stay's real replies (docs/evidence/loop/soak-run6, soak-run7); heroExample.test.ts checks them
  decide: { title: 'First step · 2 min', detail: 'open it and write the intro for two minutes' }, // claims-lint-allow: minutes quoted from Stay's real replies (docs/evidence/loop/soak-run6, soak-run7); heroExample.test.ts checks them
  rent: { title: 'First sentence', detail: 'Hey, I’m working on the rent payment and will have it sorted by tomorrow.' },
  study: { title: 'First block · 30 min', detail: 'Study for the first exam for 30 minutes right after breakfast tomorrow.' },
};

const LEAD = { you: 650, stay: 700 }; // the speaking wave or the thinking dots before the words
const PER_WORD = { you: 130, stay: 70 }; // words arrive as they are heard / as they are spoken
const GAP = 450;
const SOLVE_MS = 1000; // the ring turns while it is being worked out, then it is a tick
const HOLD = 3200;
const TICK = 60;
const MAX_VISIBLE = 4;

/** When each line starts, when its words start, when it ends, and how long the whole scene runs. */
export function plan(lines: Line[]) {
  let t = 0;
  const steps = lines.map((l) => {
    const words = l.text.split(' ').length;
    const start = t;
    const textStart = start + LEAD[l.who];
    const end = textStart + words * PER_WORD[l.who];
    t = end + GAP;
    return { start, textStart, end, words };
  });
  const outcomeAt = (steps[steps.length - 1]?.end ?? 0) + 500; // the solved card appears after the last reply
  return { steps, outcomeAt, total: outcomeAt + SOLVE_MS + HOLD };
}

/** The voice, before the words: a ring that turns around a small wave. */
function Orb() {
  return (
    <span className="hx-orb" aria-hidden="true">
      <span className="hx-wave hx-wave-sm"><i /><i /><i /></span>
    </span>
  );
}

function Wave() {
  return (
    <span className="hx-wave" aria-hidden="true">
      <i /><i /><i /><i /><i />
    </span>
  );
}

function Dots() {
  return (
    <span className="hx-dots" aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

export function HeroExample() {
  const [scene, setScene] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const ref = useRef<HTMLElement>(null);

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

  const current = SCENES[scene];
  const { steps, total, outcomeAt } = plan(current.lines);
  const outcome = OUTCOME[current.id];

  useEffect(() => {
    if (paused || reduced || !onScreen) return;
    const id = setInterval(() => setElapsed((e) => e + TICK), TICK);
    return () => clearInterval(id);
  }, [paused, reduced, onScreen]);

  useEffect(() => {
    if (elapsed >= total) {
      setScene((s) => (s + 1) % SCENES.length);
      setElapsed(0);
    }
  }, [elapsed, total]);

  const pick = (i: number) => {
    setScene(i);
    setElapsed(0);
  };

  // what is on screen now: every line that has started (all of them when motion is reduced), the last few
  const shown = current.lines
    .map((line, i) => ({ line, i, step: steps[i] }))
    .filter(({ step }) => reduced || elapsed >= step.start)
    .slice(reduced ? 0 : -MAX_VISIBLE);
  const live = reduced ? null : shown.find(({ step }) => elapsed >= step.start && elapsed < step.end);
  const status = reduced || paused ? (paused ? 'Paused' : 'Example') : live ? (live.line.who === 'you' ? 'Listening' : 'Stay is speaking') : 'Listening';

  return (
    <figure ref={ref} className="lp-hero-example card p-5 sm:p-6" data-testid="hero-example" aria-labelledby="hero-example-caption">
      <figcaption id="hero-example-caption" className="meta mb-3">
        An example exchange <span aria-hidden="true">·</span> word for word from real test calls with a synthetic speaker; real replies are generated live
      </figcaption>

      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Example conversations">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pick(i)}
              aria-pressed={i === scene}
              data-testid={`hero-scene-${s.id}`}
              className={`hx-chip ${i === scene ? 'hx-chip-on' : ''}`}
            >
              {s.chip}
            </button>
          ))}
        </div>
        {!reduced && (
          <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} className="hx-chip" data-testid="hero-pause">
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>

      <p className="hx-status meta mb-2" aria-hidden="true" data-testid="hero-status">
        <span className={`hx-live ${paused || reduced ? '' : 'hx-live-on'}`} /> {status}
      </p>

      {/* the whole exchange for people who read it with a screen reader; the animation below repeats it */}
      <ol className="sr-only">
        {current.lines.map((l, i) => (
          <li key={i}>{l.who === 'you' ? 'You' : 'Stay'}: {l.text}</li>
        ))}
        <li>Result: {outcome.title}, {outcome.detail}</li>
      </ol>

      <div className="hx-thread flex flex-col gap-3" aria-hidden="true">
        {shown.map(({ line, i, step }) => {
          const heard = reduced || elapsed >= step.textStart;
          const words = line.text.split(' ');
          const n = reduced ? words.length : Math.min(words.length, Math.floor((elapsed - step.textStart) / PER_WORD[line.who]) + 1);
          const speaking = !reduced && elapsed < step.end;
          return (
            <div key={`${scene}-${i}`} className={`hx-pop flex flex-col ${line.who === 'you' ? 'items-end' : 'items-start'}`}>
              <span className="mb-1 px-1 text-[0.78rem] font-medium text-ink-2">{line.who === 'you' ? 'You' : 'Stay'}</span>
              <p className={`bubble ${line.who === 'you' ? 'bubble-user' : 'bubble-agent'} max-w-[34ch] px-4 py-2.5 text-[1rem] leading-[1.5] ${heard && line.who === 'you' && !reduced ? 'hx-grow' : ''}`}>
                {heard ? words.slice(0, Math.max(1, n)).join(' ') : line.who === 'you' ? <Orb /> : <Dots />}
                {heard && speaking && <> <Wave /></>}
              </p>
            </div>
          );
        })}
      </div>

      <div className="hx-outcome-slot" aria-hidden="true">
        {(reduced || elapsed >= outcomeAt) && (
          <div className="hx-outcome hx-pop" data-testid="hero-outcome">
            <span className={`hx-solve ${reduced || elapsed >= outcomeAt + SOLVE_MS ? 'hx-solve-done' : ''}`} />
            <div>
              <p className="hx-outcome-title">{outcome.title}</p>
              <p className="hx-outcome-detail">{outcome.detail}</p>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
