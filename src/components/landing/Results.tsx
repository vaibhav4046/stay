'use client';
// evidence: docs/bench-results/realproducts/

import { useReveal } from './useReveal';
import { CURRENT } from './currentMeasured';
import { LANGS_NO, LANGS_OK, PAUSE, SPAN_CARDS, STAY_BEHIND, TALKED_OVER, WHO_LABEL, type SpanCard, type Who } from './resultsData';

const pct = (v: number, scale: number) => `${Math.min(100, (v / scale) * 100)}%`;

function Legend() {
  return (
    <ul className="lp-legend" aria-label="Key">
      {(['stay', 'chatgpt', 'gemini'] as Who[]).map((w) => (
        <li key={w}>
          <i data-who={w} aria-hidden="true" />
          {WHO_LABEL[w]}
        </li>
      ))}
    </ul>
  );
}

function SpanChart({ card }: { card: SpanCard }) {
  return (
    <article className="lp-rcard" data-testid={`result-${card.id}`}>
      <h4 className="lp-rtitle">{card.title}</h4>
      {card.stayBehind && <span className="lp-behind">Stay is slower here</span>}
      <div className="lp-span" role="list">
        {card.rows.map((r) => (
          <div className="lp-span-row" role="listitem" key={r.who}>
            <span className="lp-span-who">{WHO_LABEL[r.who]}</span>
            <span className="lp-span-track">
              {card.ticks.map((t) => (
                <i key={t} className="lp-tick" style={{ left: pct(t, card.scale) }} aria-hidden="true" />
              ))}
              <b
                className="lp-span-range lp-grow lp-origin"
                data-who={r.who}
                style={{ left: pct(r.min, card.scale), width: `max(8px, calc(${pct(r.max, card.scale)} - ${pct(r.min, card.scale)}))` }}
              />
              {r.median !== undefined && <em className="lp-median" style={{ left: pct(r.median, card.scale) }} aria-hidden="true" />}
            </span>
            <span className="lp-span-text tnum">{r.text}</span>
          </div>
        ))}
        <div className="lp-axis" aria-hidden="true">
          <span />
          <span className="lp-axis-track">
            {card.ticks.map((t) => (
              <span key={t} style={{ left: pct(t, card.scale) }} className="tnum">
                {t}
              </span>
            ))}
          </span>
          <span className="lp-axis-unit">seconds</span>
        </div>
      </div>
      <p className="lp-rnote">{card.note}</p>
    </article>
  );
}

function PauseChart() {
  return (
    <article className="lp-rcard" data-testid="result-pause">
      <h4 className="lp-rtitle">You pause mid-thought for about 3.2 seconds</h4>
      <div className="lp-span" role="list">
        {PAUSE.rows.map((r) => (
          <div className="lp-span-row" role="listitem" key={r.who}>
            <span className="lp-span-who">{WHO_LABEL[r.who]}</span>
            <span className="lp-span-track lp-silence" data-who={r.who}>
              <b className="lp-silence-fill lp-grow lp-origin" />
              {r.jumpedIn.map((s) => (
                <em key={s} className="lp-jump" style={{ left: pct(s, PAUSE.seconds) }} title={`Started talking after ${s} s of silence`} />
              ))}
            </span>
            <span className="lp-span-text">{r.text}</span>
          </div>
        ))}
        <div className="lp-axis" aria-hidden="true">
          <span />
          <span className="lp-axis-track">
            {[0, 1, 2, 3].map((t) => (
              <span key={t} style={{ left: pct(t, PAUSE.seconds) }} className="tnum">
                {t}
              </span>
            ))}
          </span>
          <span className="lp-axis-unit">s of silence</span>
        </div>
      </div>
      <p className="lp-rnote">The bar is the silence. A dot is the moment a product started talking over the rest of your thought (ChatGPT after 1.75 s and 2.1 s, Gemini after 1.46 s and 1.57 s). Stay waited.</p>
      <div className="lp-over">
        <p className="lp-rsub">Talked over you in the middle of a sentence?</p>
        <ul>
          {TALKED_OVER.map((t) => (
            <li key={t.who} data-yes={t.yes}>
              <i data-who={t.who} aria-hidden="true" />
              <span className="font-medium">{WHO_LABEL[t.who]}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function Languages() {
  return (
    <div className="lp-langs" data-testid="languages">
      <ul className="lp-lang-grid" aria-label="Languages heard correctly">
        {LANGS_OK.map(([code, name]) => (
          <li key={code} className="lp-lang" data-ok="true" title={`${name}: heard correctly`}>
            <span className="lp-lang-code">{code}</span>
            <span className="lp-lang-cer" aria-hidden="true">✓</span>
            <span className="sr-only">{name}, heard correctly</span>
          </li>
        ))}
      </ul>
      <ul className="lp-lang-grid" aria-label="Languages misheard">
        {LANGS_NO.map(([code, name]) => (
          <li key={code} className="lp-lang" data-ok="false" title={`${name}: misheard`}>
            <span className="lp-lang-code">{code}</span>
            <span className="lp-lang-cer" aria-hidden="true">✕</span>
            <span className="sr-only">{name}, misheard</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Results() {
  const { ref, state } = useReveal<HTMLDivElement>(0.12);
  return (
    <div ref={ref} data-reveal={state}>
      <div className="lp-rhead" data-testid="measured-now">
        <h3 className="sub-title">Measured on this build, {CURRENT.date}</h3>
        <p className="lp-night-copy">
          Real AssemblyAI, run by <code>scripts/measure-voice.mjs</code> at commit {CURRENT.gitSha}: {CURRENT.clips} synthetic-speech clips streamed in real time through Universal-3.6 Pro. Numbers are read from the evidence file, not typed in.
        </p>
        <ul className="lp-behind-list">
          <li>Words wrong in {CURRENT.englishN} English sentences across American, British, Indian, Australian and Irish voices: {CURRENT.englishWer}.</li>
          <li>Language detected correctly: {CURRENT.langCorrect} (English, Spanish, French, German, Italian, Portuguese).</li>
          <li>First words on screen: {CURRENT.firstPartialMs} ms after speech starts (95th percentile {CURRENT.firstPartialP95} ms).</li>
          <li>Final transcript: {CURRENT.finalMs} ms after speech ends (95th percentile {CURRENT.finalP95} ms).</li>
          <li>Voice starts {CURRENT.ttsFirstAudioMs} ms after the text is sent (95th percentile {CURRENT.ttsFirstAudioP95} ms).</li>
          <li>Hard names ({CURRENT.namesN} sentences): {CURRENT.namesPlain} of words wrong, {CURRENT.namesBoosted} once they are in My words.</li>
        </ul>
        <p className="lp-limits">
          Limits: {CURRENT.limits.join('; ')}. Not measured: {CURRENT.notMeasured.join('; ')}.
        </p>
      </div>

      <div className="lp-rhead">
        <h3 className="sub-title" data-testid="vs-products">Next to ChatGPT voice and Gemini Live, same day, same script</h3>
        <p className="lp-night-copy">
          On 18 and 19 October 2026 we fed the same synthesized speaker, through the same fake-microphone path in the same browser, into ChatGPT voice (Free plan) and Gemini 3.8 Live (Google AI Studio), and timed each reply inside the page. Small samples, one laptop. Stay was not the fastest.
        </p>
        <Legend />
      </div>

      <div className="lp-rgrid">
        <SpanChart card={SPAN_CARDS[0]} />
        <PauseChart />
        <SpanChart card={SPAN_CARDS[1]} />
        <SpanChart card={SPAN_CARDS[2]} />
        <article className="lp-rcard lp-rcard-wide lp-behind-card" data-testid="result-behind">
          <h4 className="lp-rtitle">Where Stay lost, or got it wrong</h4>
          <ul className="lp-behind-list">
            {STAY_BEHIND.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </article>
      </div>

      <p className="lp-limits" data-testid="result-limits">
        Not a microphone test: this laptop&apos;s microphone reads silence, so the speaker was injected as the microphone stream. Free tiers and a playground, not paid products. Medians move by a few tenths of a second between runs. These runs used that week&apos;s build. Stay&apos;s voice pipeline has changed since (new speech and voice models, new turn handling) and these numbers have not been re-run, so treat them as history, not as today&apos;s performance. Method, raw reports and every limit: <code>docs/BENCHMARK_REAL_PRODUCTS_2026-10-19.md</code>.
      </p>


      <div className="lp-rhead lp-rhead-gap">
        <h3 className="sub-title">Languages checked in a live test</h3>
        <p className="lp-night-copy">
          On 18 October 2026 one synthesized sentence per language was streamed into a live session. A tick means it came back right on auto-detect; a cross means it was misheard, and for those Stay falls back to your browser&apos;s speech recognition, which was not tested here. The raw output of that older test was not saved, so no error rates are shown. The provider documents only six languages for its voice agent; the rest were seen working, not promised.
        </p>
      </div>
      <Languages />
    </div>
  );
}
