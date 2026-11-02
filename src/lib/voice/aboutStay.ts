/**
 * Questions about Stay itself ("what can you do", "why should I use you and not ChatGPT") get a straight, honest answer at
 * once, instead of a coaching tip. Fixed wording means no model delay, no invented claims, and the same truth every time.
 * Everything said here is true of this app today; change a line only if the app changes.
 */

type Topic = 'can_do' | 'why_stay' | 'who' | 'privacy' | 'cost' | 'talk';

const PATTERNS: Array<[Topic, RegExp]> = [
  ['why_stay', /\b(?:why (?:should|would|do) i (?:use|pick|choose|need) (?:you|stay)|(?:rather|instead of|over|better than|vs\.?|versus) (?:use |using )?(?:chat ?gpt|gpt|claude|gemini|copilot|siri|alexa)|why not (?:just )?(?:use )?(?:chat ?gpt|claude|gemini)|what makes you (?:different|special|better)|how are you different|what(?:'s| is) your (?:specialty|speciality|edge|usp))\b/i],
  ['can_do', /\b(?:what (?:more )?(?:can|could) you do|what do you do|how can you help|what are you (?:able|good)|what are your (?:features|abilities|skills)|what can i use you for|what(?:'s| is) this (?:app|for))\b/i],
  ['who', /\b(?:who are you|what are you|what is stay|tell me about (?:yourself|stay))\b/i],
  ['privacy', /\b(?:is (?:my|this|the) (?:data|voice|conversation|chat|info)s? (?:private|safe|secure|saved|stored)|do you (?:save|store|record|keep|sell)|who can (?:see|hear|read) (?:this|my|what i))\b/i],
  ['cost', /\b(?:how much (?:does|do|is)|is (?:this|it|stay) free|do i have to pay|what(?:'s| is) the (?:price|pricing|cost))\b/i],
  ['talk', /^\s*(?:(?:then|ok(?:ay)?|so|please|just)\s+)*(?:reply|talk|speak|answer|say something|respond)(?:\s+(?:to|with))?\s*(?:me|something|now)?\s*[.!?]*\s*$/i],
];

const ANSWERS: Record<Topic, string[]> = {
  can_do: [
    "I help you start things. Tell me what you're avoiding and I'll shrink it to one tiny step, run a timer with you, sort a messy brain dump, and keep your list. You can also show me your screen or a photo, and I'll look at it with you.",
    "Mostly I get you started and stay with you. One small step, a timer beside you, a brain dump sorted into a short list, reminders, and a memory of what helps. You can show me your screen or a picture too.",
  ],
  why_stay: [
    "I'm not trying to be smarter than ChatGPT or Claude. I'm built for one job: getting you started and staying with you. I wait through your pauses, keep your list and timer in one place, and remember what helps you. For everything else, they're great.",
    "Use whatever helps. What I do differently is stay small: I wait for you to finish thinking, give you one step instead of an essay, and keep your timer, list and history together. I don't claim to beat the big assistants at everything.",
  ],
  who: ["I'm Stay, a voice companion for the things you keep putting off. Talk or type, and I'll keep it small."],
  privacy: [
    "Your history, memory and list stay on this device. Your voice goes to AssemblyAI to be heard and answered, and a picture goes to an AI model to be looked at. Stay doesn't save recordings or pictures.",
  ],
  cost: ["There's nothing to pay in this version."],
  talk: ["I'm here. Tell me what's going on, even if it's messy.", "I'm listening. What's on your mind?"],
};

/** The fixed answer to a question about Stay, or null when the message is about something else. */
export function answerAboutStay(text: string): string | null {
  const t = text.trim();
  if (!t || t.length > 200) return null;
  const hit = PATTERNS.find(([, re]) => re.test(t));
  if (!hit) return null;
  const options = ANSWERS[hit[0]];
  return options[t.length % options.length]; // varied by wording, never random: the same question gets the same answer
}
