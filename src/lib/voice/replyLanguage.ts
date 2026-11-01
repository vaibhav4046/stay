/**
 * Which language Stay should answer in, given what the person is speaking.
 * AssemblyAI TTS speaks six languages. Hindi is answered in Hinglish (Hindi in Roman letters) so the voice can say it;
 * every other language gets a short English answer and one honest note that the voice cannot speak it yet.
 */
const TTS_LANGUAGES: Record<string, string> = { es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese' };

export function replyLanguageInstruction(base: string, label?: string): string {
  const code = (base || 'en').toLowerCase().split(/[-_]/)[0];
  if (code === 'en') return 'The user is speaking English. Reply in English.';
  const tts = TTS_LANGUAGES[code];
  if (tts) return `The user is speaking ${tts}. Reply in ${tts}.`;
  if (code === 'hi') {
    return 'The user is speaking Hindi. Reply in Hinglish: Hindi written in Roman letters, never Devanagari, so the voice can say it clearly.';
  }
  const name = label || code;
  return `The user is speaking ${name}. The voice cannot speak ${name} yet: reply in English, briefly, and say so once.`;
}
