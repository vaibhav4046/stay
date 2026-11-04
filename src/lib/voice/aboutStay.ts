/**
 * Questions about Stay itself ("what can you do", "why should I use you and not ChatGPT") get a straight, honest answer at
 * once, instead of a coaching tip. Fixed wording means no model delay, no invented claims, and the same truth every time.
 * Everything said here is true of this app today; change a line only if the app changes.
 */

type Topic = 'can_do' | 'why_stay' | 'who' | 'privacy' | 'cost' | 'talk' | 'vision' | 'memory' | 'human' | 'languages' | 'maker' | 'voice_choice';

const PATTERNS: Array<[Topic, RegExp]> = [
  ['voice_choice', /\bwhy (?:are|did|do) you (?:pick|picking|picked|choose|choosing|chose|use|using|speak(?:ing)? in|have|sound(?:ing)? like) (?:this|that|a|the|such a) (?:\w+ )?voice\b|\bwho (?:is|picked|chose) (?:this|that|the) voice\b|\bwhat(?:'s| is) (?:this|that|the) voice\b/i],
  ['why_stay', /\b(?:what(?:'s| is) your (?:main )?(?:differentiator|difference|advantage|unique|usp|point)|differentiator|what makes you (?:different|special|unique)|what(?:'s| is) special about you|why (?:use|pick|choose|need) (?:you|stay)|why (?:should|would|do) i (?:use|pick|choose|need) (?:you|stay)|(?:rather|instead of|over|better than|vs\.?|versus) (?:use |using )?(?:chat ?gpt|gpt|claude|gemini|copilot|siri|alexa)|why not (?:just )?(?:use )?(?:chat ?gpt|claude|gemini)|what makes you (?:different|special|better)|how are you different|what(?:'s| is) your (?:specialty|speciality|edge|usp))\b/i],
  // asked the way people say it out loud (the film, 4 Nov 2026: "Why would I use this and not just ask a regular chatbot?" went to the model)
  ['why_stay', /\bwhy (?:would|should|do) i (?:use|need) (?:this|it)\b|\b(?:not|instead of|rather than|over) (?:just )?(?:ask(?:ing)?|us(?:e|ing) )?(?:a |an |the )?(?:regular |normal |big |general |other )?(?:chat ?bot|ai app|ai assistant|voice assistant|assistant)\b/i],
  ['can_do', /\b(?:what (?:more )?(?:can|could) you do|what do you do|how can you help|what are you (?:able|good)|what are your (?:features|abilities|skills)|what can i use you for|what(?:'s| is) this (?:app|for))\b/i],
  ['who', /\b(?:who are you|what are you|what is stay|tell me about (?:yourself|stay))\b/i],
  ['privacy', /\b(?:is (?:my|this|the) (?:data|voice|conversation|chat|info)s? (?:private|safe|secure|saved|stored)|do you (?:save|store|record|keep|sell)|who can (?:see|hear|read) (?:this|my|what i))\b/i],
  ['cost', /\b(?:how much (?:does|do|is)|is (?:this|it|stay) free|do i have to pay|what(?:'s| is) the (?:price|pricing|cost))\b/i],
  ['vision', /\b(?:can|could|do) you (?:see|look at|watch) (?:my|the|what)\b|\bcan you see me\b|\bdo you (?:have|use) (?:a )?(?:camera|vision)\b|\bhow (?:do|can) i (?:show|share|send) (?:you|stay)\b/i],
  ['memory', /\b(?:do|will|can) you (?:remember|keep track of|know) (?:what|my|me|things|anything|everything)\b|\bdo you have (?:a )?memory\b/i],
  ['human', /\b(?:are you (?:a |an )?(?:real|human|robot|bot|ai|person|actual|doctor|therapist|clinician|nurse|machine)|am i (?:talking|speaking|chatting) (?:to|with) (?:a |an )?(?:real |actual )?(?:human|person|ai|bot|robot|machine))\b/i], // claims-lint-allow: words a person might say
  ['languages', /\b(?:what|which) languages\b|\b(?:do|can) you (?:speak|understand|talk in|support) (?:other |another |any |more )?(?:languages?|spanish|french|german|italian|portuguese|hindi|japanese|chinese|korean|arabic)\b/i],
  ['maker', /\bwho (?:made|built|created|developed|designed|programmed) (?:you|stay|this)\b|\bwho(?:'s| is) behind (?:you|stay|this)\b/i],
  ['talk', /^\s*(?:(?:then|ok(?:ay)?|so|please|just)\s+)*(?:reply|talk|speak|answer|say something|respond)(?:\s+(?:to|with))?\s*(?:me|something|now)?\s*[.!?]*\s*$/i],
];

const ANSWERS: Record<Topic, string[]> = {
  can_do: [
    "I help you start things, like the task you keep putting off. I also run a timer beside you, sort a messy brain dump into a short list, keep your list and remind you. You can show me your screen or a photo, and I'll look at it with you.",
    "Mostly I get you started and stay with you. One small step on a task, a timer, a brain dump sorted into a short list, reminders, and a memory of what helps. You can show me your screen or a picture too.",
  ],
  why_stay: [
    "I'm for the moment you're stuck. Tell me what you're avoiding and I give you one tiny first step, start the clock with you, and wait through your pauses. When time's up I check in, and I remember what helped.",
    "Starting is the hard part, so I start with you: one tiny step, a clock running while I'm here, no talking over your pauses, a check-in when time's up, and a memory of what worked. Your list and history stay on your device.",
  ],
  voice_choice: ["That's the voice currently selected, one of AssemblyAI's. You can change it any time: say \"change voice\", or open the voice menu."],
  who: ["I'm Stay, a voice companion for the things you keep putting off. Talk or type, and I'll keep it small."],
  privacy: [
    "Your history, memory and list stay on this device. Your voice goes to AssemblyAI to be heard, your words go to a language model to write the reply, and a picture goes to an AI model to be looked at. Stay doesn't save recordings or pictures.",
  ],
  cost: ["There's nothing to pay in this version."],
  vision: [
    "Only what you choose to show me. Tap the plus button beside the message box to share your screen, use the camera or add a picture, then ask me about it. I look when you ask, and I don't keep what you show me.",
  ],
  memory: [
    "On this device, yes: your list, your timer history and the things you ask me to remember are kept in this browser. I only save a memory when you ask me to, and you can delete everything in Settings.",
  ],
  human: ["No, I'm an AI, not a person. I'm also not a doctor or a therapist, so I can't diagnose anything or advise on medication."],
  languages: [
    "I work best in English, Spanish, French, German, Italian and Portuguese. Many other languages worked in my tests and some did not; for those I use your browser's speech recognition. Talk to me in your language and I'll answer in it.",
  ],
  maker: ["I was built by one developer as a hackathon project. I use AssemblyAI to hear and speak, and a language model to think."],
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
