import { LIVE } from './liveRun';

const css = (v: Record<string, string | number>) => v as React.CSSProperties;
const sec = (v: number | null) => (v === null ? null : `${(v / 1000).toFixed(1)} s`);

/** What Stay does, as six cards. Every number is read from the recorded call (liveRun.ts); a card without one carries none. */
export function FeatureBento() {
  const cards = [
    {
      id: 'pauses',
      title: 'Waits through your pauses',
      body: 'Most voice assistants answer the moment you go quiet. Stay waits about a second, and longer when your sentence trails off, because people with ADHD stop to think.',
      vis: 'wave',
      wide: true,
    },
    {
      id: 'interrupt',
      title: 'Talk over it',
      body:
        LIVE.bargeInStop !== null
          ? `Cut in and it stops and listens. In the recorded call it stopped ${LIVE.bargeInStop} ms after the other voice started.`
          : 'Cut in and it stops and listens.',
      vis: 'ring',
    },
    {
      id: 'call',
      title: 'Call Stay',
      body: 'A phone-style call in your browser: it rings, connects, shows captions, and lasts up to ten minutes. Stay can ring you back at a time you pick, while the page is open.',
      vis: 'phone',
    },
    {
      id: 'panels',
      title: 'Ask the screen',
      body: 'Say or type "show my history", "open brain dump" or "what do you remember". The panel opens inside the conversation, not over it.',
      vis: 'panels',
      wide: true,
    },
    {
      id: 'languages',
      title: 'Switches language with you',
      body:
        LIVE.spanishFirstSound !== null
          ? `Start in English, continue in Spanish: the voice follows. The first piece of the Spanish voice arrived ${sec(LIVE.spanishFirstSound)} after the sentence ended in the recorded call.`
          : 'Start in English, continue in Spanish: the voice follows.',
      vis: 'langs',
    },
    {
      id: 'private',
      title: 'Yours, on your device',
      body: 'Your history, memory and list stay in this browser. Your voice goes to AssemblyAI to be heard and answered, and Stay says so before it starts.',
      vis: 'lock',
      wide: true,
    },
  ];
  return (
    <div id="features" className="mt-20" data-testid="features">
      <p className="eyebrow">What it does</p>
      <h3 id="bento-title" className="section-title max-w-[24ch]">A friend on the line, not a form to fill in</h3>
      <ul className="bento mt-9">
        {cards.map((c) => (
          <li key={c.id} className={`facet bento-card${c.wide ? ' bento-wide' : ''}`} data-testid={`feature-${c.id}`}>
            <div className={`bento-vis bento-${c.vis}`} aria-hidden="true">
              {c.vis === 'wave' && Array.from({ length: 26 }, (_, i) => <i key={i} style={css({ '--i': i, '--h': i > 13 && i < 19 ? '6%' : `${24 + ((i * 41) % 62)}%` })} />)}
              {c.vis === 'ring' && (
                <svg viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="24" />
                  <circle cx="32" cy="32" r="14" />
                  <circle cx="32" cy="32" r="4" />
                </svg>
              )}
              {c.vis === 'phone' && (
                <svg viewBox="0 0 64 64">
                  <path d="M20 10h8l4 12-6 4a30 30 0 0 0 12 12l4-6 12 4v8a6 6 0 0 1-6 6C30 50 14 34 14 16a6 6 0 0 1 6-6z" />
                </svg>
              )}
              {c.vis === 'panels' && (
                <>
                  <b />
                  <b />
                  <b />
                </>
              )}
              {c.vis === 'langs' && (
                <>
                  <em>Hi</em>
                  <em>Hola</em>
                  <em>Salut</em>
                  <em>Hallo</em>
                </>
              )}
              {c.vis === 'lock' && (
                <svg viewBox="0 0 64 64">
                  <rect x="14" y="28" width="36" height="26" rx="6" />
                  <path d="M22 28v-6a10 10 0 0 1 20 0v6" />
                </svg>
              )}
            </div>
            <h4 className="bento-title">{c.title}</h4>
            <p className="bento-body">{c.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
