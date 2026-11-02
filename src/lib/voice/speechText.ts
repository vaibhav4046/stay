/**
 * What the voice should be given: the words as a person would say them. Markdown marks, emoji, quotation marks (a voice
 * does not say "quote"), dashes and line breaks are removed or turned into the pause they stand for, so a reply never
 * sounds like it is reading a screen. The text shown in the chat is left as the model wrote it.
 */
export function toSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
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
}
