/**
 * What the voice should be given: the words as a person would say them (T1.4). Markdown marks, emoji, quotation marks,
 * symbols and line breaks are removed or turned into the pause or word they stand for; numbers and units are written out
 * ("7 min" becomes "seven minutes"); a long sentence is broken where a person would breathe. The text shown in the chat is
 * left as the model wrote it.
 *
 * The number, unit, comma and sentence rules are English only. For other languages only the cleanup runs, because a rule
 * that is right in English can be wrong in another language.
 */
import { romanizeDevanagari } from './devanagari';

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORDINALS: Record<number, string> = {
  1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth',
  13: 'thirteenth', 14: 'fourteenth', 15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth', 19: 'nineteenth', 20: 'twentieth',
  21: 'twenty-first', 22: 'twenty-second', 23: 'twenty-third', 24: 'twenty-fourth', 25: 'twenty-fifth', 26: 'twenty-sixth', 27: 'twenty-seventh',
  28: 'twenty-eighth', 29: 'twenty-ninth', 30: 'thirtieth', 31: 'thirty-first',
};

/** 0 to 999,999 as words. Larger numbers are left as digits. */
export function intToWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${intToWords(n % 100)}` : ''}`;
  return `${intToWords(Math.floor(n / 1000))} thousand${n % 1000 ? ` ${intToWords(n % 1000)}` : ''}`;
}

/** 1100 to 2099 said the way a year is said: 1999 "nineteen ninety-nine", 2026 "twenty twenty-six", 2005 "two thousand five". */
function yearToWords(n: number): string {
  if (n >= 2000 && n < 2010) return n === 2000 ? 'two thousand' : `two thousand ${ONES[n - 2000]}`;
  const hi = Math.floor(n / 100);
  const lo = n % 100;
  if (lo === 0) return `${intToWords(hi)} hundred`;
  return `${intToWords(hi)} ${lo < 10 ? `oh ${ONES[lo]}` : intToWords(lo)}`;
}

function numberToWords(raw: string): string | null {
  const digits = raw.replace(/,/g, '');
  const [whole, frac] = digits.split('.');
  if (whole.length > 1 && whole.startsWith('0') && !frac) return null; // 007, an id
  if (whole.length > 6) return null; // too long to be a quantity: a phone number or id
  let n = Number(whole);
  if (!Number.isFinite(n)) return null;
  let out: string;
  if (!frac && !raw.includes(',') && whole.length === 4 && n >= 1100 && n <= 2099) out = yearToWords(n);
  else out = intToWords(n);
  if (frac) out += ` point ${frac.split('').map((d) => ONES[Number(d)]).join(' ')}`;
  return out;
}

const UNITS: Array<[RegExp, string, string]> = [
  [/^(?:min|mins|minute|minutes)$/i, 'minute', 'minutes'],
  [/^(?:sec|secs|second|seconds)$/i, 'second', 'seconds'],
  [/^(?:hr|hrs|hour|hours)$/i, 'hour', 'hours'],
  [/^ms$/i, 'millisecond', 'milliseconds'],
  [/^(?:km)$/i, 'kilometer', 'kilometers'],
  [/^(?:kg)$/i, 'kilogram', 'kilograms'],
  [/^(?:cm)$/i, 'centimeter', 'centimeters'],
  [/^(?:mg)$/i, 'milligram', 'milligrams'],
  [/^(?:ml)$/i, 'milliliter', 'milliliters'],
  [/^(?:lb|lbs)$/i, 'pound', 'pounds'],
];
const UNIT_WORD = '(?:mins?|minutes?|secs?|seconds?|hrs?|hours?|ms|km|kg|cm|mg|ml|lbs?)';

function unitWords(unit: string, singular: boolean): string | null {
  for (const [re, one, many] of UNITS) if (re.test(unit)) return singular ? one : many;
  return null;
}

const CURRENCY: Record<string, [string, string]> = { $: ['dollar', 'dollars'], '£': ['pound', 'pounds'], '€': ['euro', 'euros'] };

/** Said clauses: the connecting words where a long sentence is cut into two. */
const SPLIT_BEFORE = /\s+(?=(?:and|but|so|then|because|which|while|although|though|until|before|after|when|if)\b)/i;

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

const capital = (s: string) => s.replace(/^(\W*)([a-z])/, (_m, p: string, c: string) => p + c.toUpperCase());

/** Breaks one sentence longer than `max` words at a comma, or else before a joining word, near the middle. */
function breakSentence(sentence: string, max: number): string[] {
  if (wordCount(sentence) <= max) return [sentence];
  const words = sentence.split(/\s+/);
  const mid = Math.floor(words.length / 2);
  let best = -1;
  // a comma is the natural place; take the one closest to the middle that leaves at least 4 words on each side
  words.forEach((w, i) => {
    if (/[,;:]$/.test(w) && i >= 3 && words.length - i - 1 >= 4 && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  });
  if (best >= 0) {
    const head = words.slice(0, best + 1).join(' ').replace(/[,;:]$/, '.');
    return [...breakSentence(head, max), ...breakSentence(capital(words.slice(best + 1).join(' ')), max)];
  }
  // no comma: cut before a joining word
  let cut = -1;
  words.forEach((w, i) => {
    if (i >= 4 && words.length - i >= 4 && /^(?:and|but|so|then|because|which|while|although|though|until|before|after|when|if)$/i.test(w) && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
  });
  if (cut < 0) return [sentence];
  if (cut > 4 && /^(?:and|but|so|or)$/i.test(words[cut - 1])) cut -= 1; // "and then": keep the pair together, so no sentence ends on "and"
  const head = `${words.slice(0, cut).join(' ').replace(/[,;:]$/, '')}.`;
  return [...breakSentence(head, max), ...breakSentence(capital(words.slice(cut).join(' ')), max)];
}

/** Sentences of at most `max` words (default 20), broken where a person would breathe. */
export function limitSentences(text: string, max = 20): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .flatMap((s) => breakSentence(s, max))
    .join(' ');
}

/** A comma after a lead-in a person pauses on: "First, open the mail." */
function addBreathingCommas(text: string): string {
  return text
    .replace(/(^|[.!?]\s+)(however|anyway|honestly|actually|meanwhile|finally|alright)\s+(?=[A-Za-z])/gi, '$1$2, ')
    .replace(/(^|[.!?]\s+)(okay|ok)\s+(?=(?:so|let|let's|here|first|now|then|you|we|i)\b)/gi, '$1$2, ')
    .replace(/(^|[.!?]\s+)(first|next|then)\s+(?=(?:open|write|type|click|tap|take|grab|pick|set|start|put|make|go|say|send|call|check|close|find|read|add|try|stand|sit|breathe)\b)/gi, '$1$2, ');
}

function spokenEnglish(input: string): string {
  let t = input;
  // symbols a voice would read badly
  t = t.replace(/\s*(?:->|→|=>|⇒)\s*/g, ', ').replace(/\s*&\s*/g, ' and ').replace(/\s*@\s*/g, ' at ').replace(/≈/g, 'about ').replace(/…/g, '...');
  t = t.replace(/°\s?C\b/g, ' degrees Celsius').replace(/°\s?F\b/g, ' degrees Fahrenheit').replace(/°/g, ' degrees');
  // money: $5, £12.50, €3
  t = t.replace(/([$£€])(\d[\d,]*)(?:\.(\d{2}))?(?![\d\w])/g, (_m, cur: string, whole: string, cents?: string) => {
    const w = numberToWords(whole);
    if (!w) return _m;
    const n = Number(whole.replace(/,/g, ''));
    const [one, many] = CURRENCY[cur];
    return `${w} ${n === 1 ? one : many}${cents && cents !== '00' ? ` ${numberToWords(String(Number(cents))) ?? cents}` : ''}`;
  });
  // percent: 50% -> fifty percent
  t = t.replace(/(\d[\d,]*(?:\.\d+)?)\s?%/g, (_m, n: string) => `${numberToWords(n) ?? n} percent`);
  // times: 10:30 -> ten thirty, 9:00 -> nine o'clock, 9:05 -> nine oh five
  t = t.replace(/(?<![\w:.])(\d{1,2}):(\d{2})(?![\w:])/g, (m, h: string, mm: string) => {
    const hh = Number(h);
    const mn = Number(mm);
    if (hh > 24 || mn > 59) return m;
    const minutes = mn === 0 ? "o'clock" : mn < 10 ? `oh ${ONES[mn]}` : intToWords(mn);
    return `${intToWords(hh)} ${minutes}`;
  });
  // ranges with a unit: 5-10 min -> five to ten minutes
  t = t.replace(new RegExp(`(?<![\\w.])(\\d{1,3})\\s?[-–]\\s?(\\d{1,3})\\s?(${UNIT_WORD})\\b`, 'gi'), (_m, a: string, b: string, u: string) => {
    const unit = unitWords(u, false);
    return unit ? `${intToWords(Number(a))} to ${intToWords(Number(b))} ${unit}` : _m;
  });
  // a number and its unit: 7 min -> seven minutes, 1 hr -> one hour, 90s is left alone
  t = t.replace(new RegExp(`(?<![\\w.:/])(\\d[\\d,]*(?:\\.\\d+)?)\\s?(${UNIT_WORD})\\b`, 'gi'), (m, n: string, u: string, offset: number, whole: string) => {
    const words = numberToWords(n);
    // "a 7 min timer" is an adjective, so the unit stays singular: "a seven minute timer"
    const adjective = /\b(?:a|an)\s$/i.test(whole.slice(Math.max(0, offset - 3), offset));
    const unit = unitWords(u, adjective || Number(n.replace(/,/g, '')) === 1);
    return words && unit ? `${words} ${unit}` : m;
  });
  // ordinals: 1st -> first (days of the month and small counts only)
  t = t.replace(/(?<![\w.])(\d{1,2})(?:st|nd|rd|th)\b/gi, (m, n: string) => ORDINALS[Number(n)] ?? m);
  // any other plain number: 25 -> twenty-five, 3.5 -> three point five, 2026 -> twenty twenty-six
  t = t.replace(/(?<![\w.:/#-])(\d[\d,]*(?:\.\d+)?)(?![\w:/]|\.\d|-\d)/g, (m, n: string) => numberToWords(n) ?? m);
  // a number that opens a sentence is capitalised like any other first word ("50% done" -> "Fifty percent done")
  t = t.replace(new RegExp(`(^|[.!?]\\s+)(${[...ONES, ...TENS.filter(Boolean)].join('|')})\\b`, 'g'), (_m, lead: string, word: string) => lead + word[0].toUpperCase() + word.slice(1));
  t = addBreathingCommas(t);
  return limitSentences(t);
}

export function toSpeech(rawText: string, language = 'english'): string {
  const text = romanizeDevanagari(rawText); // the voice cannot say Devanagari in any of its languages; the chat keeps the original
  const english = language.toLowerCase() === 'english';
  const cleaned = (english ? text.replace(/~(?=\s?\d)/g, 'about ') : text) // "~5 min" is "about five minutes"; the cleanup below would drop the mark
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]{1,40})\]/g, '$1') // "Hi [Landlord's name]": a placeholder is said as the words inside, never as brackets
    .replace(/\s*\([^()]{1,60}\)/g, '') // a short aside in brackets ("(Ctrl F)", "(or any date)") is for a screen, not a voice
    .replace(/…+/g, '.') // a trailing-off mark is not a sound
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '') // list markers
    .replace(/[*_`#>~|]+/g, '')
    .replace(/[\p{Extended_Pictographic}️‍]/gu, '')
    .replace(/[“”„«»"]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
  if (!cleaned || !english) return cleaned;
  return spokenEnglish(cleaned).replace(/\s{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1').trim();
}
