import { DEFAULT_PERSONA_ID, NATIVE_PERSONA_FOR_LANG, chooseVoice, personaById, type VoicePersona } from '../personas';
import type { TtsCaps, VoiceRef } from './types';

/** AssemblyAI TTS language names, by the two-letter code of the conversation language. */
export const TTS_LANGUAGE_NAME: Record<string, string> = { en: 'english', es: 'spanish', fr: 'french', de: 'german', it: 'italian', pt: 'portuguese' };

export interface SpeechPlan {
  personaId: string;
  /** The voice that will speak. Always set: when the persona's own voice is unusable, an AssemblyAI voice of the right language. */
  ref: VoiceRef;
  /** For a browser voice: the installed voice's name. */
  browserVoiceName?: string;
  /** The AssemblyAI voice to open the default TTS socket with (also the fallback when another engine fails to start). */
  assemblyVoice: string;
  ttsLanguage: string;
  /** Set when the persona's own voice could not be used and another voice speaks instead. Said out loud in the UI, never hidden. */
  fellBack?: string;
}

const base = (lang: string) => (lang || 'en').split('-')[0].toLowerCase();

/** The AssemblyAI persona that natively speaks `lang`: the language's native voice, or Anna for English and anything else. */
export function nativePersonaFor(lang: string): VoicePersona {
  return personaById(NATIVE_PERSONA_FOR_LANG[base(lang)] ?? DEFAULT_PERSONA_ID);
}

/**
 * Which voice speaks, given the persona the person chose, the conversation language and what this device can do.
 *  - persona speaks the language and its engine is usable -> that voice;
 *  - persona speaks the language but needs setup (no Azure key, no device voice) -> the language's AssemblyAI voice, with `fellBack` saying why;
 *  - persona speaks another language -> the language's native AssemblyAI voice (Spanish conversation + Anna -> Lola).
 */
export function planSpeech(personaId: string, lang: string, caps: TtsCaps): SpeechPlan {
  const l = base(lang);
  const persona = personaById(personaId);
  const ttsLanguage = TTS_LANGUAGE_NAME[l] ?? 'english';
  const native = nativePersonaFor(l);
  const nativeRef = native.voices[0];
  const fallback = (fellBack?: string): SpeechPlan => ({ personaId: native.id, ref: nativeRef, assemblyVoice: nativeRef.voice, ttsLanguage, fellBack });

  if (persona.lang !== l) return fallback();
  const choice = chooseVoice(persona, caps);
  if (!choice.ref) return fallback(choice.needs);
  const assemblyVoice = choice.ref.engine === 'assemblyai' ? choice.ref.voice : nativeRef.voice;
  return { personaId: persona.id, ref: choice.ref, browserVoiceName: choice.browserVoiceName, assemblyVoice, ttsLanguage };
}

/** The persona id to use after the conversation language changes: keep the current one if it speaks the language, else the native one. */
export function personaAfterLanguageChange(currentId: string, lang: string): string {
  const l = base(lang);
  const cur = personaById(currentId);
  if (cur.lang === l) return cur.id;
  if (l === 'en') return DEFAULT_PERSONA_ID;
  const native = NATIVE_PERSONA_FOR_LANG[l];
  if (native) return native;
  // a language with no fast voice (Hindi, Japanese...): leave English personas alone, move a native-language one back to Anna
  return cur.lang === 'en' ? cur.id : DEFAULT_PERSONA_ID;
}

/** The AssemblyAI voice for the managed Voice Agent, which only knows AssemblyAI voices. */
export function agentVoiceFor(personaId: string): string {
  const ref = personaById(personaId).voices.find((v) => v.engine === 'assemblyai');
  return ref ? ref.voice : DEFAULT_PERSONA_ID;
}
