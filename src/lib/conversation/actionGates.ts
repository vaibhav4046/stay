/**
 * Actions that change something (end a brain dump, stop a timer, go quiet, delete or export data, remember or forget, add to the list, set a
 * reminder, park a thought) are offered to the model, and run, only when the person's words ask for them. Soak, 3 Nov 2026: a question about
 * the sky made the model end a brain dump nobody had started, and Stay said "That did not work: no brain dump is running." Actions that are
 * not listed here are unchanged.
 */
const ASK: Record<string, RegExp> = {
  dump_end: /\b(?:end|stop|finish|close|done with)\b[^.?!]{0,25}\b(?:dump|dumping)\b|\b(?:i'?m|i am)\s+(?:done|finished)\b|\bthat'?s (?:it|all)\b/i,
  dump: /\bbrain[- ]?dump\b|\b(?:dump|get)\b[^.?!]{0,20}\b(?:out of my head|off my mind|all out)\b|\blet me (?:ramble|vent|dump)\b/i,
  timer_stop: /\b(?:stop|cancel|end|clear|kill|turn off)\b[^.?!]{0,20}\b(?:timer|countdown|clock|block)\b/i,
  quiet: /\b(?:be quiet|quiet mode|mute|shush|silence|stop talking|don'?t talk|go quiet|keep quiet|hush)\b/i,
  pause: /^\W*(?:pause|hold on|hang on|one (?:sec|second|moment|minute))\b|\bpause (?:for|the (?:call|session|talking)|it|please|everything|here)\b|\b(?:give me a|wait a) (?:sec|second|moment|minute)\b/i,
  delete_data: /\bdelete\b[^.?!]{0,25}\b(?:my |all |everything|data|history|account)|\berase (?:my|all|everything)\b|\bwipe\b/i,
  export_data: /\b(?:export|download|back ?up)\b[^.?!]{0,25}\b(?:my |all |everything|data|history)|\bsave (?:all )?my data\b/i,
  memory_forget: /\bforget\b(?!ting)(?![^.?!]{0,12}\b(?:my (?:keys|phone|wallet|password)|to\b))/i,
  memory_add: /(?:^|[.!?,;]\s*|\b(?:please|can you|could you|would you|also|and|stay)[, ]+)(?:remember|note|make a note)\b|\b(?:don'?t forget|keep in mind|write (?:that|this) down|save (?:that|this) (?:to|in) (?:memory|notes)|note (?:that|this) down)\b/i,
  list_add: /\b(?:add|put|stick|pop)\b[^.?!]{0,60}\b(?:list|today|to-?do|tasks?)\b/i,
  remind: /\b(?:remind me|set a reminder|reminder for|check in (?:with me )?(?:in|at|after)|ping me|nudge me)\b/i,
  // The actions below start a whole program (a plan, steps with timers, a card, a check-in). Live use and a long watched run, 4 Nov 2026:
  // "Just tell me what to do right now" turned into a four-step plan with a timer button on screen, and a timer started by itself. They run
  // only when the words ask for a plan, steps, the next step, picking something up again, or a wrap-up.
  plan_day: /\bplan (?:my |the )?(?:day|today|tomorrow|week|afternoon|evening|morning)\b|\bwhat should i (?:do|work on|focus on) (?:today|first|next)\b|\bprioriti[sz]e\b/i,
  break_down: /\b(?:break|split|cut|divide|chop)\b[^.?!]{0,25}\b(?:down|up|steps?|smaller|pieces|chunks)\b|\b(?:in|into)\b[^.?!]{0,12}\bsteps\b|\b(?:make|give|build|write)\b[^.?!]{0,15}\b(?:a |the )?(?:plan|steps|checklist)\b|\bwhat are the steps\b|\bstep[- ]by[- ]step\b/i,
  step_next: /\b(?:next (?:step|one)|what'?s next|what now|i(?:'m| am) done|i (?:did|finished) (?:it|that|the)|done with (?:that|it|this)|move on|keep going|ready for the next)\b/i,
  resume: /\b(?:pick (?:it |that |things )?up|resume|continue (?:with|where|from)|where (?:was|were) (?:i|we)|go back to|back to (?:it|that|what))\b/i,
  wrap_up: /\b(?:wrap (?:it |things )?up|end of (?:the )?day|call it a day|what did (?:i|we) (?:actually )?(?:get done|do|finish)|how (?:did|was) (?:today|my day)|summar(?:y|ise|ize) (?:my|the|today))\b/i,
  // Same run: "I just avoid it. Every time I open the text my stomach drops." opened a panel on screen. Anything that opens, shows, plays or
  // changes something needs words that ask for it.
  open: /\b(?:open|show|take me to|go to|pull up|bring up|let me see|can i see|display|switch to)\b/i,
  plan: /\b(?:plan|break (?:it |this |that )?down|steps?|first step|how (?:do|should) i (?:start|begin)|help me (?:start|begin|get started|figure out)|where (?:do|should) i (?:start|begin)|make it smaller)\b/i,
  memory_show: /\b(?:what do you (?:remember|know)|show (?:me )?(?:my )?(?:memory|memories|notes)|my (?:memory|memories)|what have you (?:saved|stored))\b/i,
  park_show: /\b(?:parked|parking lot|what did i park|my parked)\b/i,
  list_show: /\b(?:my list|today'?s? list|to-?do|what'?s on (?:my )?(?:list|today))\b|\bshow\b[^.?!]{0,15}\blist\b/i,
  list_edit: /\b(?:remove|delete|rename|edit|cross off|tick off|mark)\b[^.?!]{0,40}\b(?:list|item|it|that|done)\b/i,
  game: /\b(?:game|play|distract me)\b/i,
  routine: /\b(?:routine|morning routine|evening routine)\b/i,
  voice: /\b(?:change (?:your |the )?voice|different voice|another voice|voice picker|sound like)\b/i,
  style: /\b(?:be (?:shorter|briefer|gentler|blunter|more direct|less chatty)|shorter replies|longer replies|how you talk|your style)\b/i,
  learning: /\b(?:what have you learned|learned about me|what patterns|what do you notice about me)\b/i,
  park: /\bpark\s+(?:it|that|this)\b|\bparking lot\b|\bremind me later\b|\b(?:save|keep|put)\s+(?:that|this|it)\s+(?:for later|aside)\b|\bnote\s+(?:that|this|it)\s+down\b|\bcome back to\s+(?:that|this|it)\s+later\b|\bfor later\b/i,
};

export const GATED_ACTIONS = Object.keys(ASK);

/** Other ordinary ways of asking for the same things (a review, 4 Nov 2026, found these were refused). */
const ALSO: Record<string, RegExp> = {
  step_next: /^\W*(?:(?:okay|ok|alright|yeah)[, ]+)?(?:done|finished|next)\W*$|\bwhat(?:'s| is| do i do)? next\b/i,
  timer_stop: /\bturn (?:the |my )?(?:timer|clock|countdown|block) off\b|^\W*(?:stop|cancel)(?: it| that)?\W*$/i,
  quiet: /\bshut up\b/i,
  break_down: /\bmake (?:it|this|that) smaller\b|\bchunk\b|\bdesglos\w*|\ben pasos\b|\bpaso a paso\b|\b(?:in|into) (?:small|tiny) (?:bits|bites)\b/i,
  plan_day: /\b(?:plan|organi[sz]e)\b[^.?!]{0,12}\b(?:day|today|tomorrow|week)\b/i,
  remind: /\btell me when\b|\bcheck on me\b/i,
  resume: /\bcontinue\b|\blet(?:'s| us) continue\b/i,
  wrap_up: /\b(?:done|finished) for (?:the day|today|tonight)\b|\bhow did i do today\b/i,
  list_add: /\badd\b[^.?!]{0,60}\b(?:shopping|groceries|grocery)\b/i,
  open: /\bi want to see\b|\bwhere (?:is|are) my\b/i,
};

/** A bare yes, ok or please: it asks for whatever Stay's own last line offered. */
const ASSENT = /^\W*(?:yes|yeah|yep|yup|sure|ok|okay|please|do it|go ahead|sounds good)\b[\W\w]{0,12}$/i;
/** Never started by a bare yes: these change or remove what the person keeps. */
const NEVER_BY_YES = new Set(['delete_data', 'export_data', 'memory_forget', 'memory_add']);

/** \`lastAssistant\`: Stay's line just before these words, so "yes please" to "Want me to break this into steps?" counts as asking. */
export function mayDoAction(action: string, text: string, lastAssistant = ''): boolean {
  const re = ASK[action];
  if (!re) return true;
  const t = text.replace(/[’‘]/g, "'");
  if (re.test(t) || ALSO[action]?.test(t)) return true;
  if (NEVER_BY_YES.has(action) || !ASSENT.test(t.trim())) return false;
  const offer = lastAssistant.replace(/[’‘]/g, "'");
  return offer.includes('?') && (re.test(offer) || Boolean(ALSO[action]?.test(offer)));
}
