/**
 * What is the person asking for? Decided before any model is called, so a question gets an answer, naming a task gets a
 * first step, a feeling gets support, and a question about the screen uses only what is shown.
 * Rules, not a model: fast, testable, and it cannot be talked into anything by text inside a picture.
 */
import { answerAboutStay } from '@/lib/voice/aboutStay';
import { isSmallTalk } from '@/lib/voice/smallTalk';

export type ConvIntent = 'screen_question' | 'stay_question' | 'feeling' | 'task_start' | 'question' | 'follow_up' | 'small_talk' | 'other';

const SCREEN_QUESTION =
  /\b(?:what(?:'s| is| am i)? (?:on|in) my (?:screen|page|window|tab)|what am i (?:looking at|seeing)|what do you see|find the (?:button|link|field|menu)|which (?:button|link) (?:do i|should i)|what (?:do|should) i (?:click|press|tap)|explain this (?:error|message|page|screen)|read (?:this|the) (?:page|screen|error|form)|compare this (?:screen|page|picture)|is this (?:form )?(?:complete|filled|right)|guide me (?:while|through))\b/i;
const FEELING = /\b(?:i (?:feel|am feeling)|i'?m (?:so |really |very )?(?:sad|anxious|overwhelmed|stressed|tired|exhausted|lonely|scared|panicking|ashamed|stuck)|i can'?t cope|i hate (?:myself|this|my brain))\b/i;
const TASK_START =
  /\b(?:i (?:can'?t|cannot|won'?t|couldn'?t) (?:start|begin|get started|do)|i keep (?:putting off|avoiding|procrastinating)|i(?:'ve| have) been (?:avoiding|putting off)|i (?:need|have|got) to (?:do|write|send|finish|start|call|email|file|pay|clean|study)|help me (?:start|begin|get started|with))\b/i;
const QUESTION = /\?\s*$|^\s*(?:what|why|how|who|where|when|which|can you|could you|do you|does|is |are |explain|tell me|define|compare|translate)\b/i;
const FOLLOW_UP = /^\s*(?:and |so |ok(?:ay)? |then )?(?:(?:show|give|tell) me (?:a |an |one )?(?:quick |simple |short )?(?:example|more)|tell me more|how (?:do|can|should) i (?:fix|do|change|use) (?:it|that|this)|why (?:is|does|did) (?:it|that|this)|what (?:about|does) (?:it|that|this)|can you (?:explain|show) (?:it|that|more)|and then|what next|why)\b/i;

export interface IntentContext {
  /** is a picture, screen frame or video attached to this turn */
  hasVisualSource: boolean;
  /** has the conversation already got a subject (so "how do I fix it" means something) */
  hasHistory: boolean;
}

export function classifyIntent(text: string, ctx: IntentContext = { hasVisualSource: false, hasHistory: false }): ConvIntent {
  const t = text.trim();
  if (!t) return 'other';
  if (SCREEN_QUESTION.test(t)) return 'screen_question';
  if (ctx.hasVisualSource && /\b(?:this|it|here|these)\b/i.test(t) && QUESTION.test(t)) return 'screen_question';
  if (answerAboutStay(t)) return 'stay_question';
  if (FEELING.test(t) && !QUESTION.test(t)) return 'feeling';
  if (TASK_START.test(t)) return 'task_start';
  if (ctx.hasHistory && t.split(/\s+/).length <= 8 && FOLLOW_UP.test(t)) return 'follow_up';
  if (isSmallTalk(t)) return 'small_talk';
  if (QUESTION.test(t)) return 'question';
  return 'other';
}
