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
  park: /\bpark\s+(?:it|that|this)\b|\bparking lot\b|\bremind me later\b|\b(?:save|keep|put)\s+(?:that|this|it)\s+(?:for later|aside)\b|\bnote\s+(?:that|this|it)\s+down\b|\bcome back to\s+(?:that|this|it)\s+later\b|\bfor later\b/i,
};

export const GATED_ACTIONS = Object.keys(ASK);

export function mayDoAction(action: string, text: string): boolean {
  const re = ASK[action];
  return re ? re.test(text.replace(/[’‘]/g, "'")) : true;
}
