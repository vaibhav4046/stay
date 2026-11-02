/** How a turn works, as a loop that plays by itself: five stages, plain words, no jargon. Motion stops for reduced motion. */
const BARS = Array.from({ length: 14 }, (_, i) => i);
const css = (v: Record<string, string | number>) => v as React.CSSProperties;

export function PipelineMotion() {
  return (
    <div id="how-it-works" data-testid="pipeline">
      <p className="eyebrow">How a turn works</p>
      <h2 id="pipe-title" className="section-title max-w-[26ch]">You talk. Stay waits. Stay answers. You can cut in at any time.</h2>
      <p className="mt-3 max-w-[62ch] text-ink-2">Everything below runs in your browser tab, with AssemblyAI doing the listening and the speaking.</p>

      <ol className="pipe mt-9">
        <li className="facet pipe-node" style={css({ '--i': 0 })}>
          <span className="pipe-step">1</span>
          <div className="pipe-vis pipe-wave" aria-hidden="true">
            {BARS.map((i) => (
              <i key={i} style={css({ '--i': i, '--h': `${28 + ((i * 37) % 58)}%` })} />
            ))}
          </div>
          <h3 className="pipe-name">You say it, badly</h3>
          <p className="pipe-copy">Ums, restarts and half sentences are fine. Your microphone goes straight to AssemblyAI.</p>
        </li>
        <li className="facet pipe-node" style={css({ '--i': 1 })}>
          <span className="pipe-step">2</span>
          <div className="pipe-vis" aria-hidden="true">
            <p className="pipe-type">I keep putting off replying to my landlord</p>
          </div>
          <h3 className="pipe-name">Your words appear as you speak</h3>
          <p className="pipe-copy">Live speech-to-text, in many accents and six spoken languages.</p>
        </li>
        <li className="facet pipe-node" style={css({ '--i': 2 })}>
          <span className="pipe-step">3</span>
          <div className="pipe-vis pipe-hold" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <circle className="pipe-ring-bg" cx="24" cy="24" r="19" />
              <circle className="pipe-ring" cx="24" cy="24" r="19" pathLength="100" />
            </svg>
          </div>
          <h3 className="pipe-name">Stay waits for you to finish</h3>
          <p className="pipe-copy">It does not talk into your pause. If you trail off with &ldquo;and&hellip;&rdquo;, it gives you longer.</p>
        </li>
        <li className="facet pipe-node" style={css({ '--i': 3 })}>
          <span className="pipe-step">4</span>
          <div className="pipe-vis pipe-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <h3 className="pipe-name">It answers in a few words</h3>
          <p className="pipe-copy">One small step, not a lecture. The reply starts speaking before it has finished being written.</p>
        </li>
        <li className="facet pipe-node" style={css({ '--i': 4 })}>
          <span className="pipe-step">5</span>
          <div className="pipe-vis pipe-wave pipe-wave-out" aria-hidden="true">
            {BARS.map((i) => (
              <i key={i} style={css({ '--i': i, '--h': `${22 + ((i * 53) % 64)}%` })} />
            ))}
          </div>
          <h3 className="pipe-name">AssemblyAI speaks it back</h3>
          <p className="pipe-copy">Talk over it and it stops and listens.</p>
        </li>
      </ol>
    </div>
  );
}
