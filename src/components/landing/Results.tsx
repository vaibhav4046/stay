'use client';
// evidence: docs/evidence/real-provider/measure-bdcd654.json

import { useReveal } from './useReveal';
import { CURRENT } from './currentMeasured';
import { LANGS_NO, LANGS_OK } from './resultsData';

function Languages() {
  return (
    <div className="lp-langs" data-testid="languages">
      <ul className="lp-lang-grid" aria-label="Languages heard correctly">
        {LANGS_OK.map(([code, name]) => (
          <li key={code} className="lp-lang" data-ok="true">
            {name}
          </li>
        ))}
      </ul>
      <p className="lp-limits">
        Languages not listed were not heard reliably in this test. Stay&apos;s voice, from AssemblyAI, speaks six: English, Spanish, French,
        German, Italian and Portuguese.
      </p>
    </div>
  );
}

export function Results() {
  const { ref, state } = useReveal<HTMLDivElement>(0.12);
  return (
    <div ref={ref} data-reveal={state}>
      <div className="lp-rhead" data-testid="measured-now">
        <h3 className="sub-title">Speech test of {CURRENT.date}</h3>
        <p className="lp-night-copy">
          Real AssemblyAI, run by <code>scripts/measure-voice.mjs</code> at commit {CURRENT.gitSha}{CURRENT.dirty ? ' (the working tree had uncommitted changes)' : ''}: {CURRENT.clips} synthetic-speech clips streamed in real time through AssemblyAI's Universal-3.6 Pro model. Numbers are read from the evidence file in docs/evidence.
        </p>
        <ul className="lp-behind-list">
          <li>Words wrong in {CURRENT.englishN} English sentences across American, British, Indian, Australian and Irish voices: {CURRENT.englishWer}.</li>
          <li>Right language picked: {CURRENT.langCorrect} clips (English, Spanish, French, German, Italian, Portuguese).</li>
          <li>First words on screen: {CURRENT.firstPartialMs} ms after speech starts (slowest 1 in 20: {CURRENT.firstPartialP95} ms).</li>
          <li>Final transcript: {CURRENT.finalMs} ms after speech ends (slowest 1 in 20: {CURRENT.finalP95} ms).</li>
          <li>Voice starts {CURRENT.ttsFirstAudioMs} ms after the text is sent (slowest 1 in 20: {CURRENT.ttsFirstAudioP95} ms).</li>
          <li>Hard names ({CURRENT.namesN} sentences): {CURRENT.namesPlain} of words wrong, {CURRENT.namesBoosted} once they are in My words.</li>
        </ul>
        <p className="lp-limits" data-testid="result-limits">
          Tested with a simulated speaker on one laptop; a test with a person speaking into a microphone is next. This speech test leaves out: {CURRENT.notCovered.join('; ')}. Reply timing is in the benchmarks above. Not measured anywhere yet: {CURRENT.notMeasuredAnywhere.join('; ')}.
        </p>
      </div>

      <div className="lp-rhead lp-rhead-gap">
        <h3 className="sub-title">Languages checked in a live test</h3>
        <p className="lp-night-copy">
          On 18 October 2026 we played one spoken sentence in each language into a live session and checked what came back. The languages below came back right on auto-detect. Beyond the six it speaks, they were worked in this one test.
        </p>
      </div>
      <Languages />
    </div>
  );
}
