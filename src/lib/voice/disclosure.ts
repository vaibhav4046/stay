/**
 * T0.7: the first voice session on a device starts by saying that Stay is an AI. The same words go on screen,
 * because the greeting is shown as text. After that it is not repeated on this device.
 */
export const AI_DISCLOSED_KEY = 'stay:ai_disclosed:v1';

const LINES: Record<string, string> = {
  en: "Just so you know, I'm an AI, not a person.",
  es: 'Para que lo sepas, soy una IA, no una persona.',
  fr: 'Pour que tu le saches, je suis une IA, pas une personne.',
  de: 'Zur Info: Ich bin eine KI, kein Mensch.',
  it: "Ti dico subito che sono un'IA, non una persona.",
  pt: 'Só para você saber, eu sou uma IA, não uma pessoa.',
  hi: 'बता दूँ, मैं एक एआई हूँ, इंसान नहीं।',
};

/** The line for a language; languages without a translation here get the English line rather than none. */
export function aiDisclosureLine(lang: string): string {
  return LINES[lang.split('-')[0].toLowerCase()] ?? LINES.en;
}

/**
 * The line to put at the front of the greeting, the first time on this device only (null after that).
 * If storage is blocked it is said every time, which is the safe side.
 */
export function takeAiDisclosure(lang: string, storage: Pick<Storage, 'getItem' | 'setItem'> | null): string | null {
  try {
    if (storage?.getItem(AI_DISCLOSED_KEY) === '1') return null;
    storage?.setItem(AI_DISCLOSED_KEY, '1');
  } catch {
    // storage blocked: say it
  }
  return aiDisclosureLine(lang);
}
