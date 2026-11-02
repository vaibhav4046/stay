/**
 * Hindi written in Devanagari, turned into plain Roman letters for the voice only (AssemblyAI TTS speaks none of its six languages in
 * Devanagari; given "धन्यवाद" it skips or garbles it). The chat still shows what the model wrote. Simple on purpose: a Hunterian-style
 * spelling an English voice reads well ("dhanyavaad", "aapke", "sandesh"), with the silent "a" dropped at the end of a word and between
 * syllables, the way Hindi is spoken. ponytail: rule-based, not a dictionary; rare words can come out slightly off.
 */

const VOWELS: Record<string, string> = {
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऑ': 'o',
};
const SIGNS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॉ': 'o',
};
const CONSONANTS: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n', 'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n', 'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm', 'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v',
  'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l',
};
const NUKTA_FORMS: Record<string, string> = { 'क': 'q', 'ख': 'kh', 'ग': 'gh', 'ज': 'z', 'ड': 'r', 'ढ': 'rh', 'फ': 'f' };
const DIGITS = '०१२३४५६७८९';
const VIRAMA = '्';
const NUKTA = '़';
const ANUSVARA = 'ं';
const CHANDRABINDU = 'ँ';
const VISARGA = 'ः';
const DANDA = /[।॥]/g;

const DEVANAGARI = /[ऀ-ॿ]/;

/** One syllable unit: a consonant (with its vowel, or none after a virama) or a free vowel, plus any nasal mark. */
interface Unit {
  cons: string; // '' for a free vowel
  vowel: string; // '' when the consonant has a virama
  inherent: boolean; // the vowel is the unwritten "a"
  nasal: string;
}

function units(word: string): Unit[] {
  const out: Unit[] = [];
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (CONSONANTS[c] !== undefined) {
      let cons = CONSONANTS[c];
      if (chars[i + 1] === NUKTA) {
        cons = NUKTA_FORMS[c] ?? cons;
        i++;
      }
      const next = chars[i + 1];
      if (next === VIRAMA) {
        out.push({ cons, vowel: '', inherent: false, nasal: '' });
        i++;
      } else if (next !== undefined && SIGNS[next] !== undefined) {
        out.push({ cons, vowel: SIGNS[next], inherent: false, nasal: '' });
        i++;
      } else {
        out.push({ cons, vowel: 'a', inherent: true, nasal: '' });
      }
    } else if (VOWELS[c] !== undefined) {
      out.push({ cons: '', vowel: VOWELS[c], inherent: false, nasal: '' });
    } else if ((c === ANUSVARA || c === CHANDRABINDU) && out.length) {
      out[out.length - 1].nasal = 'n';
    } else if (c === VISARGA && out.length) {
      out[out.length - 1].nasal = 'h';
    } else if (DIGITS.includes(c)) {
      out.push({ cons: String(DIGITS.indexOf(c)), vowel: '', inherent: false, nasal: '' });
    } else {
      out.push({ cons: c, vowel: '', inherent: false, nasal: '' });
    }
  }
  return out;
}

const hasVowel = (u: Unit | undefined) => Boolean(u && u.vowel);

function romanizeWord(word: string): string {
  const us = units(word);
  // the silent "a": at the end of a word (of more than one syllable), and between a vowel and a consonant that carries a vowel
  const last = us.length - 1;
  if (us.length > 1 && us[last].inherent && !us[last].nasal) us[last].vowel = '';
  for (let i = us.length - 2; i >= 1; i--) {
    if (us[i].inherent && !us[i].nasal && hasVowel(us[i - 1]) && us[i + 1].cons && hasVowel(us[i + 1])) {
      us[i].vowel = '';
      us[i].inherent = false;
    }
  }
  let s = '';
  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    // a free vowel straight after a vowel sound ("लिए") reads better with a y: "liye"
    if (!u.cons && i > 0 && us[i - 1].vowel && /^[ei]/.test(u.vowel)) s += 'y';
    s += u.cons + u.vowel + u.nasal;
  }
  return s;
}

/** Text with any Devanagari turned into Roman letters; text without Devanagari comes back unchanged. */
export function romanizeDevanagari(text: string): string {
  if (!DEVANAGARI.test(text)) return text;
  return text.replace(DANDA, '.').replace(/[ऀ-ॿ]+/g, (w) => romanizeWord(w));
}
