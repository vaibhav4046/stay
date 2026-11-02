/**
 * T1.5: when the person's words show they are overloaded, Stay answers shorter, one idea per sentence.
 * Judged from the words only, never from the sound of the voice. A match changes how long the reply is, nothing else:
 * crisis and medication are decided elsewhere and first.
 */
const OVERLOAD =
  /\b(?:overwhelm(?:ed|ing)|too much|can'?t think|cannot think|brain (?:is )?(?:fried|mush|melting|foggy|stuck)|my brain(?:'s| is)? (?:fried|mush|melting|foggy|stuck)|brain fog|drowning|spiral(?:l)?ing|shut(?:ting)? down|shutdown|frozen|paralys(?:ed|ed)|paralyz(?:ed|ing)|so much (?:to do|on my plate)|everything at once|can'?t cope|losing it|burn(?:ed|t)? out|burnout|falling apart|don'?t know where to (?:start|begin)|too many (?:things|tasks))\b/i;

export function isOverloaded(text: string): boolean {
  return OVERLOAD.test(text.replace(/[’‘]/g, "'"));
}

/** Added to the instructions when the person sounds overloaded. */
export const OVERLOAD_INSTRUCTION =
  'They sound overloaded. Keep it very short: at most two sentences, one idea each, ten words or fewer per sentence. At most one tiny step. No lists and no choices.';
