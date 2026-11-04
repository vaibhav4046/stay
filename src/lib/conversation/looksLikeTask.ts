/**
 * Is a typed message a task to start ("I can't start my essay", "taxes", "write my introduction"), which gets the plan card with its Start
 * button, or something for the model to answer (a question, a command, a "yes", a complaint)? Reviews, 4 Nov 2026: a question and a "make
 * it smaller" each got a plan card or an orb morph. The test is by what it is NOT, so a bare "taxes" is still a task.
 */
const FILLER = /^(?:ok|okay|so|um+|uh+|well|hmm+|alright|right|yeah|but|and)\b[\s,.]*/i;
const QUESTION = /\?\s*$|^(?:what|why|how|who|when|where|which|can you|could you|can i|could i|do you|are you|is it|is this|does|did|will you|would you|should i)\b/i;
const ASSENT = /^(?:yes|yeah|yep|yup|no|nope|sure|ok|okay|fine|thanks|thank you|please|go on|go ahead|do it|nvm|never mind)\W*$/i;
const COMMAND = /^(?:ignore|disregard|pretend|you are now|system prompt|reveal|repeat your|show|open|set|start a|start the|stop|pause|resume|remember|forget|make it|make that|give me|tell me|just tell|just give|go to|play|change|add|remind|park|delete|export|cancel|close|switch|turn|ground|break it|break this|shorter|smaller|again)\b/i;
const COMPLAINT = /\b(?:useless|stupid|dumb|hate (?:this|you)|doesn'?t work|not helping|you suck|waste of)\b/i;

export function looksLikeTask(text: string): boolean {
  let t = text.trim();
  for (let i = 0; i < 2; i++) t = t.replace(FILLER, '');
  t = t.trim();
  if (!t) return false;
  if (QUESTION.test(t) || ASSENT.test(t) || COMMAND.test(t) || COMPLAINT.test(t)) return false;
  return true;
}
