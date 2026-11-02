'use client';
// evidence: docs/evidence/real-provider/measure-0f93339.json

import { useReveal } from './useReveal';
import { CURRENT } from './currentMeasured';
import { LANGS_NO, LANGS_OK } from './resultsData';

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
        <p className="lp-limits" data-testid="result-limits">
          Tested with a simulated speaker on one laptop; a test with a person speaking into a microphone is next. Not measured yet: {CURRENT.notMeasured.join('; ')}.
        </p>
      </div>

      <div className="lp-rhead lp-rhead-gap">
        <h3 className="sub-title">Languages checked in a live test</h3>
        <p className="lp-night-copy">
          On 18 October 2026 one synthesized sentence per language was streamed into a live session. A tick means it came back right on auto-detect; a cross means it was misheard, and for those Stay uses your browser&apos;s speech recognition instead. AssemblyAI documents six languages for its voice; the rest were seen working, not promised.
        </p>
      </div>
      <Languages />
    </div>
  );
}
