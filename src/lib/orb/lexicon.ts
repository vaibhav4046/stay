import { LIBRARY } from './library';

export interface ConceptMatch {
  id: string;
  score: number;
  word: string;
}

const NON_LATIN = /[^\u0000-ɏ]/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Pre-compiled matchers: Latin words on word boundaries (plural-tolerant), other scripts by substring.
const MATCHERS = LIBRARY.flatMap((entry) =>
  entry.words.map((word) => ({
    id: entry.id,
    word,
    re: NON_LATIN.test(word) ? null : new RegExp(`(?<![a-z])${escape(word.toLowerCase())}(?:s|es|ing|ed)?(?![a-z])`, 'i'),
    plain: NON_LATIN.test(word) ? word : null,
  })),
);

/** Best library concept for a piece of conversation: longer, more specific words win. */
export function matchConcept(text: string): ConceptMatch | null {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return null;
  let best: ConceptMatch | null = null;
  for (const m of MATCHERS) {
    const hit = m.re ? m.re.test(t) : t.includes(m.plain as string);
    if (!hit) continue;
    const score = m.word.length + (m.word.includes(' ') ? 4 : 0);
    if (!best || score > best.score) best = { id: m.id, score, word: m.word };
  }
  return best;
}

const STOP = new Set(
  'a an the and or but so to of in on at for with from by about as is are was were be been being am i me my mine you your we our they them their he she it its this that these those there here do does did done have has had having will would can could should may might must not no yes just really very too also then than if when while what which who whom how why where want need like get got going gonna wanna let lets please okay ok um uh yeah hey hi hello thanks thank maybe still even more some any all one two much many lot lots thing things stuff something anything everything today tomorrow tonight now ill im ive dont cant wont isnt arent wasnt didnt doesnt'
    .split(' '),
);

/** Up to three content words worth turning into a picture. Sends no sentences anywhere. */
export function extractVisualKeywords(text: string): string[] {
  const words = (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter((w) => w.length >= 3 && w.length <= 24 && !STOP.has(w));
  // prefer later, longer words (nouns tend to land late in English sentences)
  const ranked = words
    .map((w, i) => ({ w, s: w.length + i * 0.6 }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.w);
  return Array.from(new Set(ranked));
}

export function normalizeConceptKey(text: string): string {
  return (text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().slice(0, 60);
}
