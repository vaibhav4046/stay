'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

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

// Pace. Real speech runs near 150 words a minute; the words here arrive a little quicker than that so the card does not drag, with the
// pauses a voice makes at a comma and at the end of a sentence. Every word fades in.
const LEAD = { you: 600, stay: 850 }; // the voice wave before the words / the thinking dots before Stay's words
const PER_WORD = { you: 170, stay: 200 };
const PAUSE_SENTENCE = 300;
const PAUSE_CLAUSE = 150;
const GAP = 650;
const HOLD = 3800;
const SOLVE_MS = 1100; // the ring turns while it is being worked out, then it is a tick
const INTRO_MS = 1800; // once, when the card first plays: a big face settles into the header
const FACE_BIG_MS = 900;
const TICK = 60;
const MAX_VISIBLE = 4;

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
  const [elapsed, setElapsed] = useState(-INTRO_MS); // below zero only the first time: the face settles in, then the call begins
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [onScreen, setOnScreen] = useState(true);
  const [shift, setShift] = useState<{ dx: number; dy: number } | null>(null);
  const ref = useRef<HTMLElement>(null);
  const slotRef = useRef<HTMLSpanElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    if (mq.matches) setElapsed((e) => Math.max(0, e));
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  // where the big face starts: the middle of the thread, measured once
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const thread = threadRef.current;
    if (!slot || !thread) return;
    const a = slot.getBoundingClientRect();
    const t = thread.getBoundingClientRect();
    setShift({ dx: t.left + t.width / 2 - (a.left + a.width / 2), dy: t.top + 110 - (a.top + a.height / 2) });
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
    setElapsed((e) => (e < 0 ? e : 0)); // a choice made during the opening does not skip it
  };

  // what is on screen now: every line that has started (all of them when motion is reduced), the last few
  const shown = current.lines
    .map((line, i) => ({ line, i, step: steps[i] }))
    .filter(({ step }) => reduced || elapsed >= step.start)
    .slice(reduced ? 0 : -MAX_VISIBLE);
  const live = reduced ? null : shown.find(({ step }) => elapsed >= step.start && elapsed < step.end);
  const speaking = live?.line.who === 'stay' && elapsed >= live.step.textStart;
  const status = paused ? 'Paused' : reduced ? 'Example' : elapsed < 0 ? 'Stay' : live ? (live.line.who === 'you' ? 'Listening' : 'Speaking') : 'Listening';
  const big = !reduced && shift !== null && elapsed < -INTRO_MS + FACE_BIG_MS;
  const faceStyle = big && shift ? { transform: `translate(${shift.dx}px, ${shift.dy}px) scale(3.4)` } : undefined;

  return (
    <figure ref={ref} className="lp-hero-example card hx-card p-5 sm:p-6" data-testid="hero-example" aria-labelledby="hero-example-caption">
      <figcaption id="hero-example-caption" className="meta mb-3">
        An example exchange <span aria-hidden="true">·</span> word for word from real test calls with a synthetic speaker; real replies are generated live
      </figcaption>

      <div className="hx-bar">
        <span className="hx-face-slot" ref={slotRef} aria-hidden="true">
          <span className="hx-face" data-mode={speaking ? 'speaking' : 'idle'} data-big={big ? 'true' : 'false'} style={faceStyle} />
        </span>
        <span className="hx-status" aria-hidden="true" data-testid="hero-status">{status}</span>
        {!reduced && (
          <button type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused} className="hx-chip hx-pause" data-testid="hero-pause">
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
      </div>

      <div className="hx-chips" role="group" aria-label="Example conversations">
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

      {/* the whole exchange for people who read it with a screen reader; the animation below repeats it */}
      <ol className="sr-only">
        {current.lines.map((l, i) => (
          <li key={i}>{l.who === 'you' ? 'You' : 'Stay'}: {l.text}</li>
        ))}
        <li>Result: {outcome.title}, {outcome.detail}</li>
      </ol>

      <div className="hx-thread" ref={threadRef} aria-hidden="true">
        {shown.map(({ line, i, step }) => {
          const words = line.text.split(' ');
          const heard = reduced || elapsed >= step.textStart;
          const n = reduced ? words.length : step.offsets.filter((o) => o <= elapsed - step.textStart).length;
          const talking = !reduced && elapsed < step.end;
          return (
            <div key={`${scene}-${i}`} className={`hx-row hx-pop ${line.who === 'you' ? 'hx-row-you' : 'hx-row-stay'}`}>
              <span className="hx-who">{line.who === 'you' ? 'You' : 'Stay'}</span>
              <p className={`bubble hx-bubble ${line.who === 'you' ? 'hx-bubble-you' : 'hx-bubble-stay'}`}>
                {heard
                  ? words.slice(0, Math.max(1, n)).map((w, k) => (
                      <span key={k} className={reduced ? undefined : 'hx-word'}>{w}{' '}</span>
                    ))
                  : line.who === 'you' ? <Wave /> : <Dots />}
                {heard && talking && line.who === 'you' && <Wave />}
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
