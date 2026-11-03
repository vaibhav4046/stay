/**
 * How a step is said out loud. The screen can show "Step one (2m): Get ready: open or fetch what you need for b…"; a voice cannot: it read the
 * brackets and the cut-off aloud (3 Nov 2026, found in the silent microphone run). Spoken steps use words for numbers, cut only between
 * words, and never trail off with "…".
 */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

export function minutesInWords(n: number): string {
  const m = Math.max(1, Math.round(n));
  const w = m <= 20 ? WORDS[m] : m === 25 ? 'twenty-five' : m === 30 ? 'thirty' : String(m);
  return `${w} ${m === 1 ? 'minute' : 'minutes'}`;
}

/** The first `max` characters, ended at a word and a sentence-like stop: no half words, no ellipsis. */
export function wholeWords(text: string, max = 90): string {
  const t = text.replace(/\s+/g, ' ').trim().replace(/[….]+$/, '');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > 20 ? cut.slice(0, at) : cut).replace(/[,;:\-–—\s]+$/, '');
}

const ORDINAL = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

/** "First step, two minutes: open what you need for the email." */
export function sayStep(index: number, total: number, minutes: number, text: string): string {
  const which = index === 0 ? 'First step' : index === total - 1 && total > 2 ? 'Last step' : `${ORDINAL[index] ?? `Step ${index + 1}`} step`;
  const body = wholeWords(text);
  return `${which}, ${minutesInWords(minutes)}: ${body.charAt(0).toLowerCase()}${body.slice(1)}.`;
}
