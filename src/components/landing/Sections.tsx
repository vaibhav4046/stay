import Link from 'next/link';
import { dotGlyph } from './personaDots';

/* Server components: no script ships for any of this. */

export function DotIcon({ shape, size = 44 }: { shape: string; size?: number }) {
  const g = dotGlyph(shape, 110);
  if (!g) return null;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="lp-glyph" aria-hidden="true" focusable="false">
      <path d={g.a} stroke={g.colors[0]} />
      <path d={g.b} stroke={g.colors[1]} />
    </svg>
  );
}

const DAYS = [
  { shape: 'wave', title: 'It waits through your pauses', body: 'You trail off. You say um. You restart. Stay holds the thought for a couple of seconds instead of answering half a sentence, and stops talking the moment you do.' },
  { shape: 'list', title: 'Brain dump', body: 'Say everything at once, in any order. Stay picks the one thing to start, a few for today, and puts the rest away. Nothing is ever overdue.' },
  { shape: 'stairs', title: 'Routines, one step at a time', body: 'Morning, leaving the house, winding down, or your own. One big step on screen, its own small timer, skip any of it.' },
  { shape: 'clock', title: 'Check-ins that find you', body: '"Check in with me in 20 minutes." A soft chime and a line from Stay, even if the tab is in the background.' },
  { shape: 'target', title: 'Short blocks first', body: 'Ten minutes by default, longer when you are in flow. All-day mode keeps Stay beside you for hours, not minutes.' },
  { shape: 'bulb', title: 'Park it', body: '"Park it: call the dentist." The thought is saved, out of your head, and you are back on the task.' },
];

export function Days() {
  return (
    <ul className="lp-days-grid">
      {DAYS.map((d) => (
        <li key={d.title} className="card lp-feature">
          <DotIcon shape={d.shape} />
          <h3 className="card-title">{d.title}</h3>
          <p className="text-ink-2">{d.body}</p>
        </li>
      ))}
    </ul>
  );
}

const COMPARE = [
  { who: 'Goblin Tools', is: 'A free, typed task breaker.', stay: 'Spoken, with a timer and someone beside you while you do it.' },
  { who: 'Tiimo and planners', is: 'A visual day you have to set up and keep up.', stay: 'No setup. You say what is in the way and it gives you the next step.' },
  { who: 'Body-doubling with a person', is: 'A real human, at a time you booked.', stay: 'There at 11pm and on a bad day. Not a replacement for people.' },
  { who: 'A general voice assistant', is: 'Answers anything.', stay: 'Does one job: getting you started, and it remembers what helped. How it compares on speed, with the numbers where it loses, is in the measured results above.' },
];

export function Compare() {
  return (
    <>
      <ul className="mt-8 space-y-4 md:hidden">
        {COMPARE.map((c) => (
          <li key={c.who} className="card p-4">
            <p className="font-display text-lg font-semibold">{c.who}</p>
            <p className="mt-2 text-ink-2"><span className="meta block">That is</span>{c.is}</p>
            <p className="mt-2 text-ink-2"><span className="meta block">Stay is</span>{c.stay}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8 hidden overflow-x-auto md:block">
        <table className="lp-light-table">
          <caption className="sr-only">How Stay differs from other tools</caption>
          <thead>
            <tr>
              <th scope="col">Instead of</th>
              <th scope="col">That is</th>
              <th scope="col">Stay is</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE.map((c) => (
              <tr key={c.who}>
                <th scope="row">{c.who}</th>
                <td>{c.is}</td>
                <td>{c.stay}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const PROMISES = [
  { shape: 'house', title: 'Your history stays on your device', body: 'Sessions and memory are stored in your browser. Download or delete all of it in Settings, in one tap.' },
  { shape: 'shield', title: 'No medication advice', body: 'Ask about a dose and Stay says it cannot help and points you to your prescriber or pharmacist.' },
  { shape: 'person', title: 'Not a diagnosis, not a clinician', body: 'Stay is a self-help companion. It never diagnoses and does not replace treatment.' },
  { shape: 'heart', title: 'If you are in danger, it stops coaching', body: 'Crisis wording pauses everything and shows UK emergency numbers (999, NHS 111, Samaritans 116 123) and findahelpline.com for anywhere else.' },
];

export function Promises() {
  return (
    <ul className="lp-promises">
      {PROMISES.map((p) => (
        <li key={p.title}>
          <DotIcon shape={p.shape} size={40} />
          <div>
            <h3 className="card-title">{p.title}</h3>
            <p className="mt-1 text-ink-2">{p.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

const NOT_FOR = [
  'Anyone in crisis. Press Urgent help, call 999, or Samaritans on 116 123. Stay is not a crisis service.',
  'Anyone who wants a calendar or a full planner. Use Tiimo for that.',
  'Anyone who wants advice about medication. Stay will always send you to a prescriber.',
  'Anyone who needs proof it works. It has not been trialled. See above.',
];

export function NotFor() {
  return (
    <>
      <ul className="lp-notfor">
        {NOT_FOR.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <h3 className="sub-title mt-12">Where it goes next</h3>
      <p className="mt-2 max-w-[62ch] text-ink-2">
        Free to use today. Running it costs real money per hour of talking (speech-to-text, speech and a language model), which is why you can bring your own keys. The next step is a small pilot with a university disability service or ADHD coaches, to measure what matters: whether people actually start.
      </p>
    </>
  );
}

const RECEIPTS = [
  {
    date: '18 Oct 2026',
    title: 'A verification pass found nine things wrong',
    body: 'The crisis detector missed 25 of 27 genuine phrasings and every non-English one. Six of eight offered voices did not exist. New users were shown made-up memories. All rewritten or removed, with tests that include ordinary sentences that must not trigger.',
  },
  {
    date: '18 Oct 2026',
    title: 'Voice lag, found and cut',
    body: 'Sending a partial turn-detection setting raised reply lag from about 1.4 s to about 3.5 s, so it was removed. The greeting went from 11 s of speech to about 2.2 s, and 18 tools became one. That day no latency figure was claimed, because the provider’s response time was too uneven to quote.',
  },
  {
    date: '19 Oct 2026',
    title: 'The face',
    body: 'While Stay speaks, the dots can gather into a calm, dot-drawn person whose mouth follows the real reply audio. Headless Chromium held 60 fps in every phase. Design and limits: docs/THERAPIST_ORB.md.',
  },
  {
    date: '19 Oct 2026',
    title: 'Side by side with ChatGPT voice and Gemini Live',
    body: 'Stay came out slowest on typical reply time and best at waiting through a pause. The run also caught the memory feature saving facts nobody said; that is fixed.',
  },
];

export function Receipts() {
  return (
    <ol className="lp-timeline" data-testid="receipts">
      {RECEIPTS.map((r) => (
        <li key={r.title}>
          <time className="eyebrow tnum">{r.date}</time>
          <h3 className="card-title">{r.title}</h3>
          <p className="text-ink-2">{r.body}</p>
        </li>
      ))}
    </ol>
  );
}

export type PlatformStatus = 'available' | 'installable' | 'not-built';

const PLATFORMS: Array<{ id: string; shape: string; name: string; status: PlatformStatus; badge: string; body: string }> = [
  { id: 'web', shape: 'globe', name: 'Web', status: 'available', badge: 'Available now', body: 'Open it in a current browser, nothing to install. Voice needs a microphone permission and a connection.' },
  {
    id: 'pwa',
    shape: 'phone',
    name: 'Installed web app',
    status: 'installable',
    badge: 'Installable now',
    body: 'Add it to your home screen or install it from the browser menu. It opens in its own window with shortcuts for Talk, a 20 minute block and Ground me. The app shell opens offline; voice and plans need the network. We have not tested installing on every device.',
  },
  { id: 'desktop', shape: 'laptop', name: 'Desktop app', status: 'not-built', badge: 'Not available yet', body: 'A desktop wrapper is being built but is not released, and there is nothing to download. On desktop Chrome or Edge, the installed web app is the closest thing today.' },
  { id: 'mobile', shape: 'rocket', name: 'iPhone and Android app', status: 'not-built', badge: 'Not available yet', body: 'A phone wrapper is being built but is not released: no store listing, nothing to download. The installed web app is the mobile version today.' },
];

export function Platforms() {
  return (
    <ul className="lp-platforms" data-testid="platforms">
      {PLATFORMS.map((p) => (
        <li key={p.id} className="card lp-platform" data-status={p.status} data-testid={`platform-${p.id}`}>
          <DotIcon shape={p.shape} size={48} />
          <h3 className="card-title">{p.name}</h3>
          <span className="lp-status">{p.badge}</span>
          <p className="text-ink-2">{p.body}</p>
          {p.id === 'web' && (
            <Link href="/app/today" className="btn btn-primary mt-auto">
              Open Stay
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
