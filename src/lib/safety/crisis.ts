export interface CrisisCheckResult {
  triggered: boolean;
  matchedPhrase?: string;
  message: string;
}

export interface MedicalBoundaryCheckResult {
  triggered: boolean;
  matchedPhrase?: string;
  message: string;
}

export const UK_CRISIS_RESOURCES = [
  {
    name: 'Emergency Services (UK)',
    contact: '999',
    href: 'tel:999',
    detail: 'Call 999 or go to your nearest A&E if you or someone else is in immediate physical danger.',
  },
  {
    name: 'NHS Mental Health Support',
    contact: '111',
    href: 'tel:111',
    detail: 'Call 111 and select the mental health option for urgent NHS mental health advice.',
  },
  {
    name: 'Samaritans (24/7, free)',
    contact: '116 123',
    href: 'tel:116123',
    detail: 'Free, confidential 24-hour listening support. You can also email jo@samaritans.org.',
  },
  {
    name: 'Shout Crisis Text Line (UK)',
    contact: 'Text SHOUT to 85258',
    href: 'sms:85258',
    detail: 'Free 24/7 text support for anyone in crisis across the UK.',
  },
  {
    name: '988 Suicide & Crisis Lifeline (US & Canada)',
    contact: '988',
    href: 'tel:988',
    detail: 'Free, confidential 24/7 support by call or text across the US and Canada.',
  },
] as const;

/** Lowercase, strip zero-width chars, unify quotes, collapse whitespace. */
function normalizeSafetyText(input: string): string {
  return (input || '')
    .normalize('NFKC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[‘’ʼ`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "k i l l  m y s e l f" / "kill-my.self" -> "killmyself" (defeats spacing evasion). */
function squashSafetyText(normalized: string): string {
  return normalized.replace(/[^\p{L}\p{N}]+/gu, '');
}

// English crisis phrasing. High recall on purpose: a false positive shows a kind resource card,
// a false negative can leave someone in danger with a productivity timer.
const CRISIS_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(kill(?:ing)?\s+my\s?self|kill\s+me\s+now|unalive\s+(?:my\s?self|me)|un-alive)\b/i, label: 'self-harm intent' },
  { regex: /(?<!\d\s?)\b(kms|kys)\b/i, label: 'self-harm shorthand' },
  { regex: /\b(end(?:ing)?\s+my\s+(?:own\s+)?life|take\s+my\s+own\s+life|taking\s+my\s+own\s+life|end\s+it\s+all|finish\s+it\s+all)\b/i, label: 'ending life' },
  { regex: /\b(?:thinking\s+(?:about|of)|feel(?:ing)?\s+like|going\s+to|gonna|want\s+to|planning\s+to|ready\s+to|about\s+to|need\s+to|should)\s+end(?:ing)?\s+(?:it|things|everything)\b/i, label: 'ending life' },
  { regex: /\b(suicide|suicidal|suicid)/i, label: 'suicidal thoughts' },
  { regex: /\b(?:want(?:ed)?\s+to\s+die|wanna\s+die|better\s+off\s+dead|wish\s+i\s+(?:were|was)\s+dead|wish\s+i\s+(?:could\s+)?(?:just\s+)?(?:die|disappear|never\s+wake\s+up)|wish\s+i\s+(?:wasn'?t|was\s+not|weren'?t)\s+(?:here|alive|born))\b/i, label: 'wanting to die' },
  { regex: /\b(?:don'?t|do\s+not|dont|no\s+longer|never)\s+want\s+to\s+(?:live|be\s+alive|be\s+here|exist|wake\s+up|go\s+on|continue\s+living)\b/i, label: 'life safety risk' },
  { regex: /\b(?:can'?t|cannot|won'?t)\s+(?:keep\s+living|go\s+on\s+living|live\s+like\s+this\s+anymore)\b/i, label: 'life safety risk' },
  { regex: /\bno\s+(?:point|reason|purpose)\s+(?:in|to)\s+(?:living|live|going\s+on|being\s+alive|continuing)\b/i, label: 'life safety risk' },
  { regex: /\b(?:want|going|gonna|plan(?:ning)?|ready)\s+to\s+disappear\b|\bdisappear\s+(?:forever|for\s+good)\b/i, label: 'wanting to disappear' },
  { regex: /\b(?:better\s+off\s+without\s+me|everyone\s+(?:would|will)\s+be\s+better\s+off|world\s+(?:would|will)\s+be\s+better\s+without\s+me)\b/i, label: 'burden / hopelessness' },
  { regex: /\b(hurt(?:ing)?\s+my\s?self|harm(?:ing)?\s+my\s?self|self[\s-]?harm|self[\s-]?injur)/i, label: 'self-harm' },
  { regex: /\b(?:cut(?:ting)?|burn(?:ing)?|hang(?:ing)?|drown(?:ing)?|shoot(?:ing)?|stab(?:bing)?|poison(?:ing)?|starv(?:e|ing))\s+my\s?self\b(?!\s+(?:some\s+slack|in\s+(?:work|the\s+foot|tasks)|out\b))/i, label: 'self-harm method' },
  { regex: /\bjump(?:ing)?\s+(?:off|from)\s+(?:a|the|my)\s+(?:bridge|building|roof|cliff|balcony|window|train)\b/i, label: 'self-harm method' },
  { regex: /\b(overdos(?:e|ed|ing)|(?:took|taken|taking|swallowed|swallow)\s+(?:too\s+many|all\s+(?:of\s+)?my)\s+(?:pills|tablets|meds|medication))\b/i, label: 'overdose risk' },
];

// Non-English crisis phrases (substring match; \b is meaningless outside Latin script).
const MULTILINGUAL_CRISIS_REGEX = new RegExp(
  [
    // Hindi / Devanagari
    'मरना चाहता', 'मरना चाहती', 'मर जाना चाहता', 'मर जाना चाहती', 'मर जाऊं', 'जीना नहीं चाहता', 'जीना नहीं चाहती', 'आत्महत्या', 'खुदकुशी', 'अपनी जान', 'ज़िंदगी खत्म', 'जिंदगी खत्म', 'जीने का कोई मतलब नहीं', 'खुद को मार', 'खुद को नुकसान', 'खुद को चोट',
    // Hinglish / romanised Hindi
    'mar\\s*jana\\s*chah', 'marna\\s*chah', 'mar\\s*jaana\\s*chah', 'khudkushi', 'khud\\s*kushi', 'atmahatya', 'jeena\\s*nahi\\s*chah', 'jeene\\s*ka\\s*koi\\s*matlab\\s*nahi', 'jaan\\s*de\\s*du', 'zindagi\\s*khatam', 'khud\\s*ko\\s*(?:maar|hurt|nuksan)',
    // Spanish
    'quiero\\s+morir', 'me\\s+quiero\\s+matar', 'quitarme\\s+la\\s+vida', 'no\\s+quiero\\s+vivir', 'acabar\\s+con\\s+mi\\s+vida', 'hacerme\\s+daño', 'autolesi', 'suicid',
    // French
    'je\\s+veux\\s+mourir', 'envie\\s+de\\s+mourir', 'me\\s+tuer', 'me\\s+suicider', 'mettre\\s+fin\\s+à\\s+(?:ma\\s+vie|mes\\s+jours)', 'plus\\s+envie\\s+de\\s+vivre', 'me\\s+faire\\s+du\\s+mal',
    // German
    'ich\\s+will\\s+sterben', 'umbringen', 'suizid', 'selbstmord', 'nicht\\s+mehr\\s+leben', 'mich\\s+töten', 'mir\\s+etwas\\s+antun', 'mich\\s+selbst\\s+verletzen',
    // Italian / Portuguese
    'voglio\\s+morire', 'uccidermi', 'togliermi\\s+la\\s+vita', 'non\\s+voglio\\s+più\\s+vivere', 'farmi\\s+del\\s+male', 'quero\\s+morrer', 'me\\s+matar', 'tirar\\s+minha\\s+vida', 'não\\s+quero\\s+mais\\s+viver', 'me\\s+machucar',
    // Japanese / Chinese / Korean
    '死にたい', '自殺', '消えたい', '生きていたくない', '死のう', 'リスカ', '自分を傷', '想死', '自杀', '不想活', '结束生命', '结束我的生命', '自残', '活不下去', '轻生', '結束生命', '죽고\\s*싶', '자살', '죽을래', '죽어버리', '살기\\s*싫', '자해',
    // Arabic
    'أريد أن أموت', 'اريد ان اموت', 'انتحار', 'أنتحر', 'أقتل نفسي', 'لا أريد أن أعيش', 'إيذاء نفسي',
    // Russian / Ukrainian / Turkish / Dutch / Polish / Vietnamese / Indonesian
    'хочу\\s+умереть', 'самоубийств', 'покончить\\s+с\\s+собой', 'убить\\s+себя', 'не\\s+хочу\\s+жить', 'хочу\\s+померти', 'самогубств', 'ölmek\\s+istiyorum', 'intihar', 'kendimi\\s+öldür', 'yaşamak\\s+istemiyorum', 'zelfmoord', 'niet\\s+meer\\s+leven', 'chcę\\s+umrzeć', 'samobójstw', 'muốn\\s+chết', 'tự\\s+tử', 'bunuh\\s+diri', 'ingin\\s+mati',
    // Bengali / Tamil / Telugu / Thai / Hebrew / Greek
    'আত্মহত্যা', 'মরতে\\s+চাই', 'தற்கொலை', 'சாக\\s+வேண்டும்', 'ఆత్మహత్య', 'చావాలని', 'ฆ่าตัวตาย', 'อยากตาย', 'להתאבד', 'רוצה\\s+למות', 'αυτοκτονία', 'θέλω\\s+να\\s+πεθάνω',
  ].join('|'),
  'iu'
);

// Spacing-evasion check on a letters-only form; only phrases with no innocent look-alikes.
const SQUASHED_CRISIS_REGEX = /(killmyself|killingmyself|endmylife|endingmylife|takemyownlife|suicide|suicidal|hurtmyself|harmmyself)/;

const MED_TERM =
  '(?:elvanse|vyvanse|ritalin|concerta|medikinet|equasym|xaggitin|delmosart|methylphenidate|lisdexamfetamine|dexamfetamine|dextroamphetamine|amphetamines?|adderall|dexedrine|atomoxetine|strattera|guanfacine|intuniv|clonidine|modafinil|medications?|medicines?|meds|my\\s+(?:pills?|tablets?|capsules?|prescription|dose|dosage)|dos(?:e|es|age)|\\d+\\s*mg)';

const MED_ADVICE_INTENT =
  "(?:should\\s+i|can\\s+i|could\\s+i|may\\s+i|do\\s+i\\s+need|is\\s+it\\s+(?:ok|okay|safe|fine|alright|bad)|is\\s+(?:this|that|it)\\s+(?:safe|dangerous|normal|bad|too)|how\\s+(?:much|many)|too\\s+(?:much|many|high|low|strong)|maximum|max\\s+dose|safe\\s+to|(?:ok|okay)\\s+to|mix(?:ing)?|combin(?:e|ing)|with\\s+(?:alcohol|caffeine|coffee|ibuprofen|antidepressants?|cannabis|weed|energy\\s+drinks?)|double(?:d)?|triple|increas(?:e|ing)|decreas(?:e|ing)|lower(?:ing)?|rais(?:e|ing)|skip(?:ping)?\\s+(?:my|a|the|today)|stop(?:ping)?\\s+(?:taking|my|the|using)|quit(?:ting)?|wean|snort|crush|inject|side\\s*effects?|withdrawals?|interact|dangerous|(?:makes|making|made)\\s+me\\s+(?:feel\\s+)?(?:shaky|sick|dizzy|anxious|jittery))";

const MEDICATION_ADVICE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  {
    // advice-intent phrase within 80 chars of a medication term, either order
    regex: new RegExp(`\\b${MED_ADVICE_INTENT}\\b[^.?!]{0,80}\\b${MED_TERM}\\b|\\b${MED_TERM}\\b[^.?!]{0,80}\\b${MED_ADVICE_INTENT}\\b`, 'i'),
    label: 'medication dosing/safety query',
  },
  {
    regex: /\b(?:what\s+dose|what\s+dosage|which\s+medication\s+should\s+i|what\s+medication\s+is\s+best|which\s+adhd\s+med|is\s+\d+\s*mg\s+too)\b/i,
    label: 'medication prescribing question',
  },
  {
    regex: /\b(?:take|taking)\s+\d+\s*mg\s+(?:or|and|\/)\s+\d+\s*mg\b/i,
    label: 'comparative dosing question',
  },
  {
    // non-English medication questions: med word + "may I / how much / increase" marker
    regex: /(?=.*(?:medicamento|pastilla|dosis|médicament|comprimé|medikament|tablette|farmaco|compressa|दवा|दवाई|गोली|खुराक|药|薬|약|용량|用量))(?=.*(?:puedo|debo|más|aumentar|dois-je|puis-je|augmenter|kann\s+ich|soll\s+ich|mehr|erhöhen|posso|devo|aumentare|क्या\s+मैं|कितनी|बढ़ा|可以|能不能|应该|增加|减少|해도|먹어도|飲んでもいい|増や|減ら))/iu,
    label: 'non-English medication query',
  },
];

export const CRISIS_FIXED_MESSAGE =
  'Coaching has paused because what you shared sounds like you may be in crisis or unsafe. Stay is not a crisis service. Please reach out for immediate human support right now: call 999 in an emergency, call NHS 111 for urgent mental health help, or call Samaritans free on 116 123. Outside the UK, call your local emergency number or visit findahelpline.com.';

export const MEDICAL_BOUNDARY_FIXED_MESSAGE =
  'Stay can log whether you took your prescribed treatment and any notes you want to show your clinician, but it cannot advise on medication choices, doses, or side effects. Please check your prescription label or speak with your prescribing clinician, GP, or pharmacist.';

export function detectCrisisSignal(input: string): CrisisCheckResult {
  const normalized = normalizeSafetyText(input);
  if (!normalized) {
    return { triggered: false, message: '' };
  }

  for (const item of CRISIS_PATTERNS) {
    if (item.regex.test(normalized)) {
      return { triggered: true, matchedPhrase: item.label, message: CRISIS_FIXED_MESSAGE };
    }
  }
  if (MULTILINGUAL_CRISIS_REGEX.test(normalized)) {
    return { triggered: true, matchedPhrase: 'multilingual crisis phrase', message: CRISIS_FIXED_MESSAGE };
  }
  if (SQUASHED_CRISIS_REGEX.test(squashSafetyText(normalized))) {
    return { triggered: true, matchedPhrase: 'obfuscated crisis phrase', message: CRISIS_FIXED_MESSAGE };
  }

  return { triggered: false, message: '' };
}

export function detectMedicationAdviceRequest(input: string): MedicalBoundaryCheckResult {
  const normalized = normalizeSafetyText(input);
  if (!normalized) {
    return { triggered: false, message: '' };
  }

  for (const item of MEDICATION_ADVICE_PATTERNS) {
    if (item.regex.test(normalized)) {
      return { triggered: true, matchedPhrase: item.label, message: MEDICAL_BOUNDARY_FIXED_MESSAGE };
    }
  }

  return { triggered: false, message: '' };
}

export interface SensoryGroundingResult {
  triggered: boolean;
  phrase?: string;
  guidePrompt: string;
}

export const GROUNDING_FIXED_PROMPT =
  "I am right here with you. Everything can wait. Let's ground right now with 5-4-3-2-1: Name 5 things you can see around you, 4 things you can physically touch, 3 sounds you can hear, 2 scents you notice, and 1 slow breath. Follow the breathing circle on screen.";

const GROUNDING_PATTERNS = [
  /\b(?:stay ground me|ground me|having a panic attack|panic attack|can't breathe|cannot breathe|sensory overload|everything is too loud|freaking out|hyperventilating|rsd meltdown|meltdown)\b/i,
];

export function detectSensoryGroundingRequest(input: string): SensoryGroundingResult {
  const normalized = (input || '').trim();
  if (!normalized) return { triggered: false, guidePrompt: '' };
  for (const re of GROUNDING_PATTERNS) {
    if (re.test(normalized)) {
      return {
        triggered: true,
        phrase: 'sensory_overload_or_panic',
        guidePrompt: GROUNDING_FIXED_PROMPT,
      };
    }
  }
  return { triggered: false, guidePrompt: '' };
}

export interface ImpulsePauseResult {
  triggered: boolean;
  reason?: string;
  message: string;
}

const IMPULSE_PATTERNS = [
  {
    regex: /\b(?:going to quit my job|about to quit my job|i'm quitting right now)\b/i,
    reason: 'career impulse pause',
  },
  {
    regex: /\b(?:send an angry (?:email|message|text)|tell them off right now)\b/i,
    reason: 'interpersonal communication impulse',
  },
  {
    regex: /\b(?:spend all my (?:savings|money)|drain my bank account|blow all my money|impulsively buy)\b/i,
    reason: 'financial impulsive action',
  },
];

export function detectImpulsiveActionRisk(input: string): ImpulsePauseResult {
  const normalized = (input || '').trim();
  if (!normalized) return { triggered: false, message: '' };
  for (const item of IMPULSE_PATTERNS) {
    if (item.regex.test(normalized)) {
      return {
        triggered: true,
        reason: item.reason,
        message:
          "ADHD Dopamine Pause: This feels intensely urgent right now, but big decisions deserve a 10-minute buffer. Let's take a 10-minute pause before sending or spending anything.",
      };
    }
  }
  return { triggered: false, message: '' };
}
