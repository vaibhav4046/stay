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
] as const;

const CRISIS_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(kill\s+myself|killing\s+myself)\b/i, label: 'self-harm intent' },
  { regex: /\b(end\s+my\s+life|ending\s+my\s+life|end\s+it\s+all)\b/i, label: 'ending life' },
  { regex: /\b(suicide|suicidal)\b/i, label: 'suicidal thoughts' },
  { regex: /\b(want\s+to\s+die|wanna\s+die|better\s+off\s+dead|wish\s+i\s+were\s+dead|wish\s+i\s+was\s+dead)\b/i, label: 'wanting to die' },
  { regex: /\b(hurt\s+myself|harm\s+myself|self[\s-]?harm)\b/i, label: 'self-harm' },
  { regex: /\b(overdose|take\s+all\s+my\s+pills|swallow\s+all\s+my\s+pills)\b/i, label: 'overdose risk' },
  { regex: /\b(don'?t\s+want\s+to\s+be\s+alive|can'?t\s+keep\s+living|no\s+reason\s+to\s+live)\b/i, label: 'life safety risk' },
];

const MEDICATION_ADVICE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  {
    regex: /\b(?:should\s+i|can\s+i|ought\s+i\s+to|do\s+i)\s+(?:take|try|stop\s+taking|start\s+taking|double|increase|decrease|lower|raise|change|stop|skip|split|switch)\b.*?\b(?:dose|dosage|medication|meds|pill|pills|tablet|tablets|capsule|capsules|elvanse|vyvanse|ritalin|concerta|methylphenidate|lisdexamfetamine|adderall|atomoxetine|strattera|\d+\s*mg)\b/i,
    label: 'medication dosing/intake query',
  },
  {
    regex: /\b(?:what\s+dose|what\s+dosage|how\s+many\s+mg|how\s+much\s+mg|which\s+medication\s+should\s+i|what\s+medication\s+is\s+best|which\s+adhd\s+med)\b/i,
    label: 'medication prescribing question',
  },
  {
    regex: /\b(?:is\s+\d+\s*mg\s+too\s+(?:high|low|much|dangerous|safe)|extra\s+\d+\s*mg|double\s+(?:my\s+)?dose|double\s+(?:my\s+)?\d+\s*mg|stop\s+taking\s+my\s+(?:meds|medication|pills|elvanse|concerta|ritalin))\b/i,
    label: 'dosage adjustment question',
  },
  {
    regex: /\b(?:double|increase|decrease|lower|raise|cut\s+in\s+half)\s+(?:my\s+)?(?:\d+\s*mg\s+)?(?:dose|dosage)\b/i,
    label: 'dose alteration',
  },
  {
    regex: /\b(?:take|taking)\s+\d+\s*mg\s+(?:or|and|\/)\s+\d+\s*mg\b/i,
    label: 'comparative dosing question',
  },
  {
    regex: /\b(?:side\s+effects?\s+of|withdrawals?\s+from)\s+(?:elvanse|vyvanse|ritalin|concerta|methylphenidate|lisdexamfetamine|adderall|strattera|medication|meds)\b/i,
    label: 'medication side effect query',
  },
];

export const CRISIS_FIXED_MESSAGE =
  'Coaching has paused because what you shared sounds like you may be in crisis or unsafe. Stay is not a crisis service. Please reach out for immediate human support right now: call 999 in an emergency, call NHS 111 for urgent mental health help, or call Samaritans free on 116 123.';

export const MEDICAL_BOUNDARY_FIXED_MESSAGE =
  'Stay can log whether you took your prescribed treatment and any notes you want to show your clinician, but it cannot advise on medication choices, doses, or side effects. Please check your prescription label or speak with your prescribing clinician, GP, or pharmacist.';

export function detectCrisisSignal(input: string): CrisisCheckResult {
  const normalized = (input || '').trim();
  if (!normalized) {
    return { triggered: false, message: '' };
  }

  for (const item of CRISIS_PATTERNS) {
    if (item.regex.test(normalized)) {
      return {
        triggered: true,
        matchedPhrase: item.label,
        message: CRISIS_FIXED_MESSAGE,
      };
    }
  }

  return { triggered: false, message: '' };
}

export function detectMedicationAdviceRequest(input: string): MedicalBoundaryCheckResult {
  const normalized = (input || '').trim();
  if (!normalized) {
    return { triggered: false, message: '' };
  }

  for (const item of MEDICATION_ADVICE_PATTERNS) {
    if (item.regex.test(normalized)) {
      return {
        triggered: true,
        matchedPhrase: item.label,
        message: MEDICAL_BOUNDARY_FIXED_MESSAGE,
      };
    }
  }

  return { triggered: false, message: '' };
}
