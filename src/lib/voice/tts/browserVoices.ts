import type { BrowserVoiceInfo } from './types';

/**
 * Choosing among the device's speechSynthesis voices. Browsers expose a name, a BCP-47 language and a local/online flag,
 * and nothing else: no gender, no quality. Gender is therefore a best effort from well-known voice names, and an
 * unknown gender is reported as unknown rather than guessed.
 */
const FEMALE = /\b(heera|neerja|veena|kalpana|swara|sabina|dalia|paulina|angelica|marisol|elvira|carlota|beatriz|renata|nuria|larissa|candela|female|woman)\b/i;
const MALE = /\b(ravi|prabhat|rishi|hemant|raul|raúl|jorge|juan|diego|alvaro|cecilio|gerardo|liberto|luciano|pelayo|yago|male|man)\b/i;

export type Gender = 'female' | 'male';

export function voiceGender(name: string): Gender | null {
  // "female" contains "male", so test the female list first
  if (FEMALE.test(name)) return 'female';
  if (MALE.test(name)) return 'male';
  return null;
}

const normLocale = (l: string) => l.replace(/_/g, '-').toLowerCase();

export interface BrowserVoiceMatch {
  voice: BrowserVoiceInfo;
  /** True when the voice is known to be the wanted gender; false when the gender is unknown or differs. */
  genderMatched: boolean;
  /** The voice's gender when the name tells us; null when it does not. */
  gender: Gender | null;
}

/**
 * The best installed voice for an exact locale (en-IN, es-MX). No fallback to a neighbouring locale: an en-US voice is
 * not an Indian-English voice, and saying it is would be the inaccuracy this module exists to remove.
 */
export function pickBrowserVoice(voices: readonly BrowserVoiceInfo[], locale: string, gender: Gender): BrowserVoiceMatch | null {
  const want = normLocale(locale);
  const ranked = voices
    .filter((v) => normLocale(v.lang) === want)
    .map((v) => {
      const g = voiceGender(v.name);
      let score = 0;
      if (g === gender) score += 10;
      else if (g === null) score += 2;
      else score -= 5;
      if (/natural|neural|online/i.test(v.name)) score += 3;
      else if (/google/i.test(v.name)) score += 1;
      if (v.localService) score += 0.5;
      return { v, g, score };
    })
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  return best ? { voice: best.v, genderMatched: best.g === gender, gender: best.g } : null;
}

/** speechSynthesis voices, waiting briefly for the browser to load them (Chrome fills the list asynchronously). */
export async function loadBrowserVoices(timeoutMs = 1500): Promise<BrowserVoiceInfo[]> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const synth = window.speechSynthesis;
  const read = () => synth.getVoices().map((v) => ({ name: v.name, lang: v.lang, localService: v.localService }));
  if (synth.getVoices().length > 0) return read();
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener('voiceschanged', done);
      clearTimeout(t);
      resolve(read());
    };
    const t = setTimeout(done, timeoutMs);
    synth.addEventListener('voiceschanged', done);
  });
}
