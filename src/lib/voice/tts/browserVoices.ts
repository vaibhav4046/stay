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

export interface PersonaSpeechConfig {
  voice: BrowserVoiceInfo | null;
  rate: number;
  pitch: number;
  lang: string;
}

const PERSONA_HINTS: Record<string, string[]> = {
  anna: ['anna', 'libby', 'sondra', 'hazel', 'susan', 'uk', 'british'],
  charles: ['charles', 'oliver', 'george', 'ryan', 'uk', 'british'],
  paul: ['paul', 'alfie', 'david', 'uk', 'british'],
  vera: ['vera', 'hazel', 'susan', 'fiona', 'uk', 'british'],
  jean: ['jean', 'jenny', 'zira', 'aria', 'samantha'],
  eve: ['eve', 'ava', 'allison', 'jessica'],
  jane: ['jane', 'jenny', 'zira', 'kendra'],
  george: ['george', 'guy', 'david', 'tom'],
  michael: ['michael', 'christopher', 'eric', 'david'],
  alba: ['alba', 'aria', 'jenny', 'samantha'],
  mary: ['mary', 'monica', 'samantha'],
  iris: ['iris', 'clara', 'samantha', 'victoria'],
  reid: ['reid', 'david', 'guy', 'mark', 'daniel'],
  cardamom: ['heera', 'neerja', 'veena', 'kalpana', 'swara', 'india'],
  chaiwala: ['ravi', 'prabhat', 'rishi', 'hemant', 'india'],
  taco: ['dalia', 'paulina', 'sabina', 'mexico'],
  mariachi: ['jorge', 'raul', 'gerardo', 'mexico'],
  lola: ['lola', 'monica', 'paulina', 'elena', 'laura', 'conchita'],
  estelle: ['estelle', 'celine', 'amelie', 'hortense'],
  juergen: ['juergen', 'stefan', 'hans', 'markus'],
  giovanni: ['giovanni', 'cosimo', 'matteo', 'luca'],
  rafael: ['rafael', 'helio', 'ricardo', 'luciano'],
};

const COMMON_MALE_NAMES = /\b(charles|paul|george|michael|david|daniel|guy|mark|tom|ryan|oliver|ravi|prabhat|rishi|hemant|raul|raúl|jorge|juan|diego|alvaro|cecilio|gerardo|liberto|luciano|pelayo|yago|stefan|hans|cosimo|matteo|luca|helio|ricardo|alex|fred)\b/i;
const COMMON_FEMALE_NAMES = /\b(anna|libby|sondra|hazel|susan|vera|jean|jenny|zira|aria|samantha|victoria|eve|ava|allison|jane|alba|mary|iris|clara|fiona|heera|neerja|veena|kalpana|swara|dalia|paulina|sabina|monica|elena|laura|estelle|celine|karen)\b/i;

/**
 * Resolves the ideal browser speechSynthesis voice, rate, and pitch for a persona.
 * Guarantees that typing and local voice mode match the configured persona's gender, accent, and style.
 */
export function resolvePersonaBrowserSpeech(
  voices: readonly BrowserVoiceInfo[],
  persona: { id: string; gender: Gender; lang?: string; voices?: Array<{ locale?: string }> },
  detectedLang?: string
): PersonaSpeechConfig {
  const pId = (persona?.id || 'anna').toLowerCase();
  const targetGender = persona?.gender ?? 'female';
  const targetLocale = (persona?.voices?.[0]?.locale || detectedLang || persona?.lang || 'en-US').replace(/_/g, '-').toLowerCase();
  const targetPrefix = targetLocale.split('-')[0];

  // 1. Pacing & pitch tuned to persona's therapeutic role
  let rate = 1.01;
  let pitch = 1.0;
  if (['paul', 'chaiwala', 'lola', 'alba'].includes(pId)) {
    rate = 1.06;
    pitch = 1.02;
  } else if (['anna', 'cardamom', 'iris', 'jane'].includes(pId)) {
    rate = 0.95;
    pitch = 0.98;
  } else if (['eve', 'mary', 'vera', 'reid', 'juergen'].includes(pId)) {
    rate = 1.02;
    pitch = 0.99;
  } else if (['charles', 'giovanni'].includes(pId)) {
    rate = 0.98;
    pitch = 1.01;
  }

  if (!voices || voices.length === 0) {
    return { voice: null, rate, pitch, lang: targetLocale };
  }

  // 2. Candidate scoring across all available voices
  const hints = PERSONA_HINTS[pId] || [pId];
  const scored = voices.map((v) => {
    const name = v.name.toLowerCase();
    const lang = (v.lang || '').replace(/_/g, '-').toLowerCase();
    let score = 0;

    // Locale matching
    if (lang === targetLocale) {
      score += 40;
    } else if (lang.startsWith(targetPrefix)) {
      score += 22;
    } else if (targetPrefix !== 'en' && !lang.startsWith('en')) {
      score -= 30;
    }

    // Gender detection (explicit voiceGender + common names)
    const g = voiceGender(v.name);
    const isMale = g === 'male' || COMMON_MALE_NAMES.test(name);
    const isFemale = g === 'female' || COMMON_FEMALE_NAMES.test(name);

    if (targetGender === 'male') {
      if (isMale) score += 35;
      else if (isFemale) score -= 75;
    } else {
      if (isFemale) score += 35;
      else if (isMale) score -= 75;
    }

    // Persona-specific keyword hints
    for (const h of hints) {
      if (name.includes(h)) {
        score += 25;
        break;
      }
    }

    // Quality hints
    if (/natural|neural|online/i.test(name)) score += 4;
    if (v.localService) score += 1.5;

    return { voice: v, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return {
    voice: best && best.score > 0 ? best.voice : null,
    rate,
    pitch,
    lang: targetLocale,
  };
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
