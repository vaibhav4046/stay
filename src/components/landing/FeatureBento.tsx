import { DotIcon } from './Sections';

const css = (v: Record<string, string | number>) => v as React.CSSProperties;

/** What Stay does for the person, as six cards, in plain words. Measurements and method live on /proof, not here. A card draws a `vis` (wave, languages) or a dot shape. */
const CARDS = [
  {
    id: 'pauses',
    title: 'Waits while you think',
    body: 'Stop mid-sentence, trail off, start again. Stay waits, and waits a little longer when it sounds like you are not done.',
    vis: 'wave',
    wide: true,
  },
  {
    id: 'interrupt',
    title: 'Talk over it',
    body: 'Cut in whenever you like. It stops talking and listens.',
    shape: 'bolt',
  },
  {
    id: 'call',
    title: 'Call Stay',
    body: 'A phone-style call in your browser, for up to ten minutes. Stay can ring you back at a time you pick, while the page is open.',
    shape: 'phone',
  },
  {
    id: 'checkins',
    title: 'Checks in on you',
    body: 'If you switch it on, Stay sends a short, calm message in the morning and the evening, even when the app is closed. Two a day at most, never at night.',
    shape: 'heart',
    wide: true,
  },
  {
    id: 'languages',
    title: 'Switches language with you',
    body: 'Start in English, continue in Spanish: the voice follows.',
    vis: 'langs',
  },
  {
    id: 'private',
    title: 'Yours, on your device',
    body: 'Your history, memory and list stay on this device. Your voice and words are sent to be understood and answered, and Stay tells you so before it starts.',
    shape: 'key',
    wide: true,
  },
];

export function FeatureBento() {
  return (
    <div id="features" data-testid="features">
      <h2 id="bento-title" className="section-title max-w-[24ch]">Talk it out, get the next step</h2>
      <ul className="bento mt-9">
        {CARDS.map((c, n) => (
          <li key={c.id} className={`facet bento-card${c.wide ? ' bento-wide' : ''}`} style={css({ '--i': n % 3 })} data-testid={`feature-${c.id}`}>
            <div className={`bento-vis${c.vis ? ` bento-${c.vis}` : ''}`} aria-hidden="true">
              {c.shape && <DotIcon shape={c.shape} size={64} />}
              {c.vis === 'wave' && Array.from({ length: 26 }, (_, i) => <i key={i} style={css({ '--i': i, '--h': i > 13 && i < 19 ? '6%' : `${24 + ((i * 41) % 62)}%` })} />)}
              {c.vis === 'langs' && (
                <>
                  <em>Hi</em>
                  <em>Hola</em>
                  <em>Salut</em>
                  <em>Hallo</em>
                </>
              )}
            </div>
            <h3 className="bento-title">{c.title}</h3>
            <p className="bento-body">{c.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
