import { LIVE } from './liveRun';
import { DotIcon } from './Sections';

const css = (v: Record<string, string | number>) => v as React.CSSProperties;
const sec = (v: number | null) => (v === null ? null : `${(v / 1000).toFixed(1)} s`);

/** What Stay does, as six cards. Every number is read from the recorded call (liveRun.ts); a card without one carries none. A card draws a `vis` (wave, languages) or a dot shape. */
export function FeatureBento() {
  const cards = [
    {
      id: 'pauses',
      title: 'Waits through your pauses',
      body: 'Stay waits about a second after you go quiet, and longer when your sentence trails off, because people with ADHD stop to think.',
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
      shape: 'bolt',
    },
    {
      id: 'call',
      title: 'Call Stay',
      body: 'A phone-style call in your browser: it rings, connects, shows captions, and lasts up to ten minutes. Stay can ring you back at a time you pick, while the page is open.',
      shape: 'phone',
    },
    {
      id: 'panels',
      title: 'Ask the screen',
      body: 'Say or type "show my history", "open brain dump" or "what do you remember". The panel opens inside the conversation.',
      shape: 'list',
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
      body: 'Your history, memory and list stay in this browser. Your voice goes to AssemblyAI to be heard, and the words go to a Groq language model to write the reply. Stay says so before it starts.',
      shape: 'key',
      wide: true,
    },
  ];
  return (
    <div id="features" className="mt-20" data-testid="features">
      <h3 id="bento-title" className="section-title max-w-[24ch]">Talk it out, get the next step</h3>
      <ul className="bento mt-9">
        {cards.map((c, n) => (
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
            <h4 className="bento-title">{c.title}</h4>
            <p className="bento-body">{c.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
