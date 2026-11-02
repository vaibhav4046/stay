// evidence: docs/evidence/real-provider/measure-0f93339.json
// evidence: docs/evidence/real-e2e/run-ba6a337.json
import { CURRENT } from './currentMeasured';
import { LIVE } from './liveRun';

const css = (v: Record<string, string | number>) => v as React.CSSProperties;
const sec = (ms: number) => `${(ms / 1000).toFixed(2)} s`;
const nice = (k: string) =>
  k.replace(/^english-/, 'English, ').replace('names-without-keyterms', 'Hard names, no hints').replace('names-with-keyterms', 'Hard names, with hints');
const SCALE_MAX = 0.15; // bars run to 15% of words wrong

/** The numbers, drawn. Two sources: the recorded call (liveRun.ts) and the speech test (currentMeasured.ts). Limits sit under each chart. */
export function BenchmarkBoard() {
  const stages =
    LIVE.endOfTurn !== null && LIVE.firstWord !== null && LIVE.firstSound !== null
      ? [
          { label: 'You stop talking', from: 0, to: 0 },
          { label: 'AssemblyAI says you are done', from: 0, to: LIVE.endOfTurn },
          { label: 'The answer starts to arrive', from: LIVE.endOfTurn, to: LIVE.firstWord },
          { label: 'The first piece of Stay’s voice arrives', from: LIVE.firstWord, to: LIVE.firstSound },
        ]
      : [];
  const total = LIVE.firstSound ?? 1;
  const lang = CURRENT.langCorrect.split(' of ').map(Number);
  const langP = lang[1] ? lang[0] / lang[1] : 0;

  return (
    <div id="benchmarks" data-testid="benchmarks">
      <div>
        <p className="eyebrow lp-eyebrow-night">Benchmarks</p>
        <h2 id="bench-title" className="section-title lp-night-title max-w-[28ch]">Measured, not claimed</h2>
        <p className="lp-night-copy mt-3 max-w-[64ch]">
          Real AssemblyAI speech-to-text and voice. The speakers are synthetic voices, the machine is one laptop, and nobody has tested a human microphone yet. The limits are under each chart.
        </p>

        <div className="bench mt-9">
          <article className="facet bench-card bench-wide" data-testid="bench-waterfall">
            <h3 className="bench-title">Where the time goes after you stop talking</h3>
            {stages.length > 0 && (
              <ol className="wf" aria-label="Time after you stop talking, in milliseconds">
                {stages.map((s, i) => (
                  <li key={s.label} className="wf-row" style={css({ '--i': i })}>
                    <span className="wf-label">{s.label}</span>
                    <span className="wf-track">
                      <b className="wf-bar" style={{ left: `${(s.from / total) * 100}%`, width: `${Math.max(((s.to - s.from) / total) * 100, i === 0 ? 0.8 : 2)}%` }} />
                    </span>
                    <span className="wf-ms tnum">{i === 0 ? '0 ms' : `${s.to} ms`}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="bench-note">
              <strong className="tnum">{LIVE.firstSound} ms</strong> from the end of your speech to the first piece of Stay&rsquo;s voice reaching the browser (packet arrival, before it is played), in one recorded call
              {LIVE.toSpeaking !== null && <> (the screen showed &ldquo;Speaking&rdquo; at {LIVE.toSpeaking} ms)</>}. Source: <code>{LIVE.file}</code>. Stay is not the fastest on every measure; the comparison below says where it is slower.
            </p>
          </article>

          <article className="facet bench-card" data-testid="bench-words">
            <h3 className="bench-title">Words heard wrong</h3>
            <ul className="wer">
              {CURRENT.byGroup
                .filter((g) => g.wer !== null && !g.key.startsWith('lang-'))
                .map((g, i) => (
                  <li key={g.key} style={css({ '--i': i })}>
                    <span>{nice(g.key)}</span>
                    <span className="wer-track">
                      <b style={{ width: `${Math.max(((g.wer as number) / SCALE_MAX) * 100, 1.5)}%` }} />
                    </span>
                    <span className="tnum">{((g.wer as number) * 100).toFixed(1)}%</span>
                  </li>
                ))}
            </ul>
            <p className="bench-note">{CURRENT.clips} clips. Hard names improve when Stay passes your own words as hints.</p>
          </article>

          <article className="facet bench-card" data-testid="bench-languages">
            <h3 className="bench-title">Language recognised</h3>
            <div className="donut" style={css({ '--p': langP })}>
              <svg viewBox="0 0 120 120" aria-hidden="true">
                <circle className="donut-bg" cx="60" cy="60" r="52" />
                <circle className="donut-fg" cx="60" cy="60" r="52" pathLength="100" />
              </svg>
              <p className="donut-num tnum">{CURRENT.langCorrect.replace(' of ', ' / ')}</p>
            </div>
            <p className="bench-note">clips where the language was named correctly.</p>
          </article>

          <article className="facet bench-card" data-testid="bench-speed">
            <h3 className="bench-title">Speed of the parts</h3>
            <dl className="tiles">
              <div>
                <dt>First words on screen</dt>
                <dd className="tnum">{sec(CURRENT.firstPartialMs)}</dd>
                <dd className="tiny">median; slowest 1 in 20: {sec(CURRENT.firstPartialP95)}</dd>
              </div>
              <div>
                <dt>Reply text to voice</dt>
                <dd className="tnum">{sec(CURRENT.ttsFirstAudioMs)}</dd>
                <dd className="tiny">median; slowest 1 in 20: {sec(CURRENT.ttsFirstAudioP95)}</dd>
              </div>
            </dl>
          </article>

          <article className="facet bench-card" data-testid="bench-audio">
            <h3 className="bench-title">Does the sound break up?</h3>
            <p className="bench-big tnum">{LIVE.underflows === null ? 'n/a' : LIVE.underflows}</p>
            <p className="bench-note">
              gaps in Stay&rsquo;s voice during the recorded call. Microphone audio left the browser every {LIVE.frameEveryMs} ms. A busy network or a human ear may tell a different story.
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}
