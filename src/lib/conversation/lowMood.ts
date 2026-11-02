/**
 * Low mood that has lasted, or nothing feeling worth doing: not a crisis (that is decided first, elsewhere, and goes to urgent help),
 * but a warning sign that deserves more than a mirrored sentence. Judge panel, 2 Nov 2026: to "I've been feeling really low for a few
 * weeks and nothing feels worth doing" Stay only reflected the words back, while a plain assistant suggested talking to someone.
 * Judged from the words only. A match adds one instruction: acknowledge it, suggest a doctor or someone they trust, point to urgent
 * help if they ever feel unsafe. Never a diagnosis.
 */
const LASTED = /\b(?:feel(?:ing)?|felt|been|am|i'?m)\s+(?:really\s+|so\s+|pretty\s+|very\s+|kind\s+of\s+)?(?:low|down|depressed|empty|numb|flat|hopeless|miserable|awful)\b[^.?!]{0,60}\b(?:for\s+)?(?:weeks?|months?|a\s+while|ages|days\s+now|a\s+long\s+time|all\s+(?:year|month))\b/i;
const NOTHING_WORTH = /\b(?:nothing\s+(?:feels|seems|is)\s+(?:worth|worthwhile|good|fun|enjoyable)|(?:can'?t|cannot)\s+(?:enjoy|feel)\s+anything|lost\s+interest\s+in\s+everything|no\s+point\s+(?:in\s+)?(?:doing\s+)?anything|don'?t\s+(?:care|enjoy)\s+about\s+anything\s+anymore)\b/i;

export function isPersistentLowMood(text: string): boolean {
  const t = text.replace(/[’‘]/g, "'");
  return LASTED.test(t) || NOTHING_WORTH.test(t);
}

export const LOW_MOOD_INSTRUCTION =
  'They describe low mood that has lasted, or nothing feeling worth doing. In two or three warm, plain sentences: say back what they told you in a few words; say it is worth talking to a doctor or someone they trust about it, because it has lasted; and say that if they ever feel unsafe they should call their local emergency number straight away (in the UK, Samaritans on 116 123; in the US or Canada, 988), and that Urgent help in Stay lists more. No diagnosis, no task, no step, no advice about medication.';
