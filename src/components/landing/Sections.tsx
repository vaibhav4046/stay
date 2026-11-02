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

export type PlatformStatus = 'available' | 'installable' | 'not-built';

const PLATFORMS: Array<{ id: string; shape: string; name: string; status: PlatformStatus; badge: string; body: string }> = [
  { id: 'web', shape: 'globe', name: 'Web', status: 'available', badge: 'Available now', body: 'Open it in a current browser, nothing to install. Voice needs a microphone permission and a connection.' },
  {
    id: 'pwa',
    shape: 'phone',
    name: 'Installed web app',
    status: 'installable',
    badge: 'Installable now',
    body: 'Add it to your home screen or install it from the browser menu. It opens in its own window with shortcuts for Talk, a 20 minute block and Ground me. The app shell opens offline; voice and plans need the network. We have not tested installing on every device.', // claims-lint-allow: a timer length in the app, not a measurement
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
