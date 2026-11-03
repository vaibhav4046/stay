/**
 * What Stay can and cannot do, said plainly and decided before any model runs. Field test, 2 Nov 2026: asked to "open Netflix for
 * five minutes" Stay started a timer and called an `open` tool it cannot honour, then, told to "close it now", did nothing and said
 * nothing true. The fix is to be straight about the limit and offer the thing it really does: a timer that tells you when to stop.
 */

const EXTERNAL =
  '(?:netflix|youtube|spotify|instagram|tiktok|facebook|twitter|reddit|whatsapp|snapchat|twitch|prime video|disney|hulu|gmail|chrome|safari|firefox|edge|browser|tabs?|windows?|websites?|sites?|another app|other apps?|games?|discord|slack|zoom|steam|the app|that app)';
const OPEN_VERB = '(?:open|launch|pull up|bring up|go to|take me to|play|put on|turn on|switch to|start up)';
const CLOSE_VERB = '(?:close|shut|quit|exit|kill|turn off|block|lock)';

const OPEN_EXTERNAL = new RegExp(`\\b${OPEN_VERB}\\b[^.?!]{0,30}\\b${EXTERNAL}\\b`, 'i');
const CLOSE_EXTERNAL = new RegExp(`\\b${CLOSE_VERB}\\b[^.?!]{0,30}\\b${EXTERNAL}\\b`, 'i');
/** "close it now", "shut that", "close it" with no object: it means something said earlier */
const CLOSE_PRONOUN = /\b(?:close|shut|quit|exit|kill|turn off)\s+(?:it|that|this|them)\b/i;
const EXTERNAL_RE = new RegExp(`\\b${EXTERNAL}\\b`, 'i');

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };

/** "five minutes", "10 min" -> 5, 10 */
export function minutesIn(text: string): number | null {
  const m = /\b(\d{1,3}|one|two|three|four|five|ten|fifteen|twenty|thirty)[- ]?(?:min(?:ute)?s?)\b/i.exec(text);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1].toLowerCase()];
  return n >= 1 && n <= 180 ? n : null;
}

/**
 * The straight answer when the person asks Stay to open or close something outside Stay, or null when it is not that.
 * `recent` is the last few lines of the conversation, so "close it now" can be tied to what "it" was.
 */
export function unsupportedActionAnswer(text: string, recent: string[] = []): string | null {
  const t = text.trim();
  if (!t || t.length > 200) return null;
  const mins = minutesIn(t) ?? recent.map(minutesIn).find((m) => m !== null) ?? null;
  const offer = mins ? `Want me to start a ${mins}-minute timer?` : 'Want a timer for it?';
  if (OPEN_EXTERNAL.test(t)) {
    return `I can't open other apps or sites for you. What I can do is start a timer and tell you when your time is up. ${offer}`;
  }
  const pronounOnExternal = CLOSE_PRONOUN.test(t) && recent.slice(-4).some((r) => EXTERNAL_RE.test(r));
  if (CLOSE_EXTERNAL.test(t) || pronounOnExternal) {
    return "I can't close tabs or other apps. When the time is up I'll tell you, and you close it yourself. Say the word and I'll start the timer.";
  }
  return null;
}

const TIMER_WORD = /\b(?:timers?|countdown|stopwatch|pomodoro|focus (?:block|session)|time me)\b/i;
const START_VERB = /\b(?:start|set|begin|run|give me|let's|let us|for|do)\b/i;
const YES = /^(?:yes|yeah|yep|sure|okay|ok|do it|go ahead|please)\b/i;

/**
 * May Stay start a timer on this turn? Only if the person asked for one, or is saying yes to Stay's own offer of one. A model once
 * started a 5-minute timer from "open Netflix", and a person who only wanted to talk found a timer running.
 */
export function mayStartTimer(text: string, recent: string[] = []): boolean {
  const t = text.trim();
  if (TIMER_WORD.test(t)) return true;
  if (minutesIn(t) !== null && START_VERB.test(t)) return true;
  if (YES.test(t)) return /\btimer\b/i.test(recent.at(-1) ?? '');
  return false;
}

const LOOK_WORD = /\b(?:orb|shapes?|colou?rs?|theme|palette|aurora|sunset|ocean|cyber|emerald|morph|turn (?:it |you )?into|change (?:it |you |your )?(?:in)?to|look like|become)\b/i;

/**
 * Whether the words ask to change how the orb looks. The shape and colour actions are offered to the model only then: in a persona
 * run "show me exactly how you'd log a sprint" made it set the orb's shape to "exactly" and the app said "Done" to a question.
 */
export function mayChangeLook(text: string): boolean {
  return LOOK_WORD.test(text);
}

/**
 * Whether the words ask Stay to put a thought aside. The park action is offered to the model only then (file-mic run, 3 Nov 2026: a person
 * thinking out loud about how to start an email got "Parked.").
 */
const PARK_WORD = /\b(?:park\s+(?:it|that|this)|parking lot|remind me later|(?:save|keep|put)\s+(?:that|this|it)\s+(?:for later|aside)|note\s+(?:that|this|it)\s+down|write\s+(?:that|this|it)\s+down|come back to\s+(?:that|this|it)\s+later|for later)\b/i;

export function mayPark(text: string): boolean {
  return PARK_WORD.test(text);
}

/** The opening words of Stay's recent replies, so the next one does not begin the same way (the "I'm right here with you" loop). */
export function recentOpeners(assistantReplies: string[], words = 5, count = 3): string[] {
  return assistantReplies
    .slice(-count)
    .map((r) => r.trim().split(/\s+/).slice(0, words).join(' ').replace(/[.,!?;:]+$/, ''))
    .filter((s) => s.split(' ').length >= 2);
}
