/**
 * Groundedness checks: a reply that ignores the question, sees what is not there, or reaches for a stock coaching line is a
 * failure, not an answer. Used by the tests and the live eval that guard against generic replies; it is not run on replies
 * at run time. Pure; no network.
 */
// the shape of a model answer being checked

export interface GroundingInput {
  /** what the person just said or typed */
  question: string;
  response: { text: string; intent?: string; groundedEvidence?: Array<{ source: string; summary: string }>; suggestedAction?: { action: string }; followUpQuestion?: string };
  /** earlier turns, newest last: a short follow-up ("how do I fix it?") borrows its subject from here */
  history?: string[];
  /** is a picture, screen frame or video actually attached to this turn */
  hasVisualSource: boolean;
  /** a tool the answer talks about, and whether it worked */
  tool?: { name: string; ok: boolean };
}

export type GroundingFailure =
  | 'empty'
  | 'claims_vision_without_source'
  | 'generic_coaching_phrase'
  | 'reminder_not_requested'
  | 'ignores_subject'
  | 'tool_failure_reported_as_success'
  | 'no_evidence_for_visual_claim';

/** Stock lines that used to come back for questions that had nothing to do with them. */
export const GENERIC_PHRASES: RegExp[] = [
  /\bpick one small reward\b/i,
  /\b(?:5|five)[-\s‐-―]minute stretch\b/i, // any hyphen or space, including the non-breaking hyphen a model may write
  /^\s*(?:i appreciate that|thanks for asking|good question)[.!]?\s*$/i,
  /\bthat(?:'s| is) (?:a lot|understandable)\.?\s*(?:open|pick|take)\b/i,
];

const VISION_CLAIM = /\b(?:i (?:can )?see|i(?:'m| am) (?:looking at|seeing)|on your screen|in (?:the|this) (?:image|picture|photo|screenshot|video|frame)|the (?:screenshot|image|photo|picture|video) (?:shows|has|contains)|your (?:camera|screen) (?:shows|is showing))\b/i;
const REMINDER_WORDS = /\b(?:remind(?:er)?s?|set an? (?:alarm|reminder)|check[- ]in later)\b/i;
const ASKED_REMINDER = /\b(?:remind|reminder|alarm|check[- ]?in|notify|ping me|later today|tomorrow)\b/i;
const SUCCESS_CLAIM = /\b(?:done|i(?:'ve| have) (?:set|saved|started|added|sent)|all set|it(?:'s| is) (?:set|saved|started))\b/i;

const STOP = new Set('about above after again also another apart because been before being between both could does doing each from have having here into just like make more most much need only other over same should some such than that their them then there these they this those through under until very what when where which while will with would your you are can the and for not but how why who'.split(' '));
const tokens = (t: string) => (t.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []).filter((w) => !STOP.has(w)).map((w) => w.replace(/(?:ing|ed|es|s)$/, ''));

/** The words a good answer should be about: the question's own, or (for a short follow-up) the last few turns'. */
export function subjectTokens(question: string, history: string[] = []): string[] {
  const own = tokens(question);
  if (own.length >= 2) return own;
  return [...own, ...history.slice(-3).flatMap(tokens)];
}

export function checkGrounded(i: GroundingInput): { ok: boolean; failures: GroundingFailure[] } {
  const f: GroundingFailure[] = [];
  const text = i.response.text.trim();
  if (!text) return { ok: false, failures: ['empty'] };

  if (!i.hasVisualSource && VISION_CLAIM.test(text)) f.push('claims_vision_without_source');
  if (i.hasVisualSource && VISION_CLAIM.test(text) && !(i.response.groundedEvidence ?? []).some((e) => ['screen', 'camera', 'image', 'video'].includes(e.source))) f.push('no_evidence_for_visual_claim');
  if (GENERIC_PHRASES.some((re) => re.test(text)) && i.question.trim().length > 3) f.push('generic_coaching_phrase');
  if ((REMINDER_WORDS.test(text) || i.response.suggestedAction?.action === 'set_reminder' || REMINDER_WORDS.test(i.response.followUpQuestion || '')) && !ASKED_REMINDER.test(i.question) && i.response.intent !== 'reminder' && i.response.intent !== 'stay_question') f.push('reminder_not_requested'); // describing what Stay can do is not offering one
  if (i.tool && !i.tool.ok && SUCCESS_CLAIM.test(text)) f.push('tool_failure_reported_as_success');

  // the answer must be about what was asked: share at least one content word with the question (or the subject it follows up on)
  const want = subjectTokens(i.question, i.history);
  const asksSomething = /\?|^\s*(?:what|why|how|can|could|do|does|is|are|who|where|when|explain|tell|show|find|read|compare)\b/i.test(i.question);
  if (asksSomething && want.length >= 2) {
    const have = new Set(tokens(`${text} ${i.response.followUpQuestion || ''} ${(i.response.groundedEvidence ?? []).map((e) => e.summary).join(' ')}`));
    if (!want.some((w) => have.has(w))) f.push('ignores_subject');
  }
  return { ok: f.length === 0, failures: f };
}

/** the "three beats" for starting a task: a short acknowledgement, one tiny step, a check-in question */
export function hasThreeBeats(text: string): boolean {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const words = text.trim().split(/\s+/).length;
  return sentences.length >= 2 && sentences.length <= 4 && words <= 45 && /\?\s*$/.test(text.trim()) && !/^[-*\d]/m.test(text);
}
