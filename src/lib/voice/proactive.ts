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

export function proactiveFrame(mode: ProactiveMode, text: string, fast: boolean): { type: 'reply.say'; text: string; when: 'idle' } | { type: 'reply.create'; instructions: string; when: 'idle' } {
  // `when: 'idle'`: the voice waits for a quiet moment instead of cutting into a reply or talking over the person
  if (fast && mode === 'say' && !looksLikeInstruction(text)) return { type: 'reply.say', text, when: 'idle' };
  return { type: 'reply.create', instructions: text, when: 'idle' };
}

/**
 * What Stay is told to do when a focus block ends. One question at a time: first whether they got started, and only after the outcome
 * is recorded a second short one, about what helped (or what got in the way), so the next block can use it. "Nothing" and "skip" are
 * fine answers; the second question is never pressed.
 */
export function timerEndedInstruction(minutes: number, firstStep: string): string {
  return `The user's ${minutes}-minute focus timer just ended. Speak first: in under 20 words, warmly ask whether they got started on "${firstStep}". Ask just that one question. When they answer, call record_session_outcome. Then, in under 12 words, ask one short follow-up: what helped if it went well, or what got in the way if it did not. If they say nothing, skip, or do not know, accept that kindly and stop; never ask it twice.`;
}

/** A timer with no plan behind it: say the time is up, ask nothing. */
export function timerEndedNoPlanInstruction(minutes: number): string {
  return `The user's ${minutes}-minute timer just ended. Say in under 10 words that their time is up. Ask nothing.`;
}
