'use client';

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    title: 'You say it, badly',
    body: 'Talk, or type if you are somewhere quiet. One task is enough, said however it comes out: the ums, the restarts, the half sentences.',
  },
  {
    title: 'It waits through the pause',
    body: 'You trail off. Stay holds the thought instead of answering half a sentence, and stops talking the moment you do. In our run it waited through a 3.2 second hole that two other voice products talked into.',
  },
  {
    title: 'It shrinks the task',
    body: 'It names what is making it hard (too big, no clear first move, fear of getting it wrong) and turns the task into one step you can start in about two minutes.',
  },
  {
    title: 'You start, with company',
    body: 'A short timer, ten minutes by default, longer when you are in flow. Check-ins are soft and fire from the browser tab, even in the background, while Stay is open.',
  },
  {
    title: 'You log what happened',
    body: 'Started, partly, not yet. All three are fine and all three are data. Stay keeps exact counts so next time it can suggest what has worked for you, and never a streak to lose.',
  },
];

function Wave({ on }: { on: boolean }) {
  return (
    <div className="lp-wave" data-on={on} aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <i key={i} style={{ '--i': i, '--h': 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) } as React.CSSProperties} />
      ))}
    </div>
  );
}

function Visual({ i, on }: { i: number; on: boolean }) {
  if (i === 0)
    return (
      <div className="lp-vis" data-on={on}>
        <Wave on={on} />
        <p className="lp-bubble lp-bubble-user">&ldquo;Um, I keep putting off replying to my landlord about the renewal.&rdquo;</p>
        <p className="lp-vis-foot">You, talking</p>
      </div>
    );
  if (i === 1)
    return (
      <div className="lp-vis" data-on={on}>
        <p className="lp-bubble lp-bubble-user">&ldquo;I need to, um, send that email, and, uh&hellip;&rdquo;</p>
        <div className="lp-hold" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="50" className="lp-ring-bg" />
            <circle cx="60" cy="60" r="50" className="lp-ring-fill" pathLength="100" />
          </svg>
          <span>holding</span>
        </div>
        <p className="lp-bubble lp-bubble-user lp-late">&ldquo;&hellip;and I keep thinking about how to even start it.&rdquo;</p>
        <p className="lp-vis-foot">Stay answers only now</p>
      </div>
    );
  if (i === 2)
    return (
      <div className="lp-vis" data-on={on}>
        <p className="lp-task-old">Reply to my landlord about the renewal</p>
        <div className="lp-shrink" aria-hidden="true">
          <i /><i /><i />
        </div>
        <div className="lp-task-new">
          <span className="eyebrow">Your first step</span>
          <p>Open the email. Type only the greeting.</p>
          <span className="lp-tags"><b>Unclear first step</b><b>If-then step</b><b>2 minutes</b></span>
        </div>
        <p className="lp-vis-foot">Illustration of a plan card</p>
      </div>
    );
  if (i === 3)
    return (
      <div className="lp-vis" data-on={on}>
        <div className="lp-clock" aria-hidden="true">
          <svg viewBox="0 0 200 200" width="200" height="200">
            <circle cx="100" cy="100" r="86" className="lp-ring-bg" />
            <circle cx="100" cy="100" r="86" className="lp-ring-fill" pathLength="100" />
          </svg>
          <span className="tnum">10:00</span>
        </div>
        <p className="lp-vis-foot">A ten minute block</p>
      </div>
    );
  return (
    <div className="lp-vis" data-on={on}>
      <p className="lp-ask">How did it go?</p>
      <div className="lp-outcomes" aria-hidden="true">
        <span data-pick="true">Started</span>
        <span>Partly</span>
        <span>Not yet</span>
      </div>
      <p className="lp-logged">Logged. Next time, the if-then step comes up a little sooner.</p>
      <p className="lp-vis-foot">Illustration of the check-in</p>
    </div>
  );
}

export function Story() {
  const [active, setActive] = useState(0);
  const list = useRef<HTMLOListElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const ol = list.current;
    if (!ol) return;
    const items = Array.from(ol.querySelectorAll<HTMLElement>('[data-step]'));
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.innerHeight * 0.5;
      let best = 0;
      let dist = Infinity;
      items.forEach((el, idx) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < dist) {
          dist = d;
          best = idx;
        }
      });
      setActive(best);
      const box = ol.getBoundingClientRect();
      setProgress(Math.min(1, Math.max(0, (mid - box.top) / box.height)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="lp-flow" style={{ '--progress': progress } as React.CSSProperties} data-testid="story">
      <ol ref={list} className="lp-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} data-step={i} data-active={active === i} aria-current={active === i ? 'step' : undefined}>
            <span className="lp-step-n tnum" aria-hidden="true">{i + 1}</span>
            <h3 className="sub-title">{s.title}</h3>
            <p className="text-ink-2">{s.body}</p>
            <div className="lp-inline" aria-hidden="true">
              <Visual i={i} on={active === i} />
            </div>
          </li>
        ))}
      </ol>
      <div className="lp-stage-col" aria-hidden="true">
        <div className="lp-stage" data-step={active}>
          <span className="lp-stage-tag">Illustration</span>
          {STEPS.map((s, i) => (
            <div key={s.title} className="lp-stage-pane" data-on={active === i}>
              <Visual i={i} on={active === i} />
            </div>
          ))}
          <div className="lp-pips">
            {STEPS.map((s, i) => (
              <i key={s.title} data-on={i <= active} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
