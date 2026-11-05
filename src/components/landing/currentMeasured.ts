/**
 * Numbers for the landing page, read straight from the evidence file written by `node scripts/measure-voice.mjs`.
 * Nothing here is typed in by hand; to change it, re-run the script and update the import below.
 * `node scripts/check-claims.mjs` fails when the file imported here is not the newest measure-*.json in docs/evidence/real-provider.
 */
import measure from '../../../docs/evidence/real-provider/measure-bdcd654.json';

interface Row { category: string; wer: number | null; langOk: boolean | null }
const rows = measure.results as Row[];
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pct = (x: number | null) => (x === null ? 'not measured' : `${(x * 100).toFixed(1)}%`);

const english = rows.filter((r) => r.category.startsWith('english-') && r.wer !== null);
const plain = rows.filter((r) => r.category === 'names-without-keyterms' && r.wer !== null);
const boosted = rows.filter((r) => r.category === 'names-with-keyterms' && r.wer !== null);
const langChecked = rows.filter((r) => r.langOk !== null);

/** What this speech test does not cover. Two of those (a human microphone, noisy rooms) have not been measured anywhere; the rest is timed elsewhere. */
const NOT_MEASURED_ANYWHERE = /human|noisy/i;
const notMeasured = measure.notMeasured as string[];

export const CURRENT = {
  date: measure.timestamp.slice(0, 10),
  gitSha: measure.gitSha.slice(0, 7),
  /** true when the working tree had uncommitted changes while the script ran: then the stamp is the commit it started from, not an exact build */
  dirty: measure.dirty === true,
  clips: measure.completed,
  englishWer: pct(mean(english.map((r) => r.wer as number))),
  englishN: english.length,
  langCorrect: `${langChecked.filter((r) => r.langOk).length} of ${langChecked.length}`,
  firstPartialMs: measure.firstPartialMs.p50,
  firstPartialP95: measure.firstPartialMs.p95,
  finalMs: measure.endOfSpeechToFinalMs.p50,
  finalP95: measure.endOfSpeechToFinalMs.p95,
  ttsFirstAudioMs: measure.ttsFirstAudioMs.p50,
  ttsFirstAudioP95: measure.ttsFirstAudioMs.p95,
  namesPlain: pct(mean(plain.map((r) => r.wer as number))),
  namesBoosted: pct(mean(boosted.map((r) => r.wer as number))),
  namesN: plain.length,
  byGroup: Object.entries(measure.werByCategory as Record<string, { n: number; meanWer: number | null }>).map(([k, v]) => ({ key: k, n: v.n, wer: v.meanWer })),
  limits: measure.limits as string[],
  notMeasured,
  notCovered: notMeasured.filter((x) => !NOT_MEASURED_ANYWHERE.test(x)),
  notMeasuredAnywhere: notMeasured.filter((x) => NOT_MEASURED_ANYWHERE.test(x)),
};
