import Link from 'next/link';
import { dotGlyph } from './personaDots';

/* Server components: no script ships for any of this. */

export function DotIcon({ shape, size = 44 }: { shape: string; size?: number }) {
  const g = dotGlyph(shape, 110);
  if (!g) return null;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="lp-glyph" aria-hidden="true" focusable="false">
      <path d={g.a} />
      <path d={g.b} />
    </svg>
  );
}

const COMPARE = [
  { who: 'A typed task breaker', is: 'A list to read, then start by yourself.', stay: 'Spoken, with a timer running while you work and a check-in at the end.' },
  { who: 'A planner or calendar app', is: 'A visual day you have to set up and keep up.', stay: 'No setup. You say what is in the way and it gives you the next step.' },
  { who: 'Body-doubling with a person', is: 'A real human, at a time you booked.', stay: 'Available at 11pm and on a bad day. It does not replace people.' },
  { who: 'A general voice assistant', is: 'Answers anything.', stay: 'Built around getting you started. It also answers questions, and it remembers what helped.' },
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
  { shape: 'person', title: 'Stay does not diagnose', body: 'Stay is a self-help companion. It never diagnoses, and it does not replace treatment or a clinician.' },
  { shape: 'heart', title: 'If you are in danger, it stops coaching', body: 'Crisis wording pauses everything and shows emergency and helpline numbers for where you are (UK, US or Canada), and findahelpline.com for anywhere else.' },
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
  'Anyone in crisis. Press Urgent help for numbers in your country, or call your local emergency number. Stay is not a crisis service.',
  'Anyone who wants a calendar or a full planner. A planner is the right tool for that.',
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
