/**
 * What Stay sends to its voice when the app, not the person, starts a turn (a timer ending, a gentle reminder, a nudge).
 * Two different things go through here and they must never be mixed up: WORDS TO SAY (spoken exactly) and INSTRUCTIONS for the model
 * ("ask whether they got started"). The old hook guessed from the first word; an instruction that began "The user's..." was read to the
 * person word for word (soak, 3 Nov 2026).
 */
export type ProactiveMode = 'say' | 'instruct';

const INSTRUCTION_START = /^\s*(?:the user'?s\b|say\b|speak\b|gently remind\b|read this\b|ask\b|tell the (?:user|person)\b|you are\b|remind the\b)/i;
const INSTRUCTION_TELLS = /\b(?:call record_session_outcome|in (?:under|less than) \d+ words|ask nothing|speak first)\b/i;

export function looksLikeInstruction(text: string): boolean {
  return INSTRUCTION_START.test(text) || INSTRUCTION_TELLS.test(text);
}

export function proactiveFrame(mode: ProactiveMode, text: string, fast: boolean): { type: 'reply.say'; text: string } | { type: 'reply.create'; instructions: string } {
  if (fast && mode === 'say' && !looksLikeInstruction(text)) return { type: 'reply.say', text };
  return { type: 'reply.create', instructions: text };
}
