import type {
  BarrierType,
  CareContext,
  CoachPlanProposal,
  StrategyKey,
} from '@/types/domain';
import {
  detectCrisisSignal,
  detectMedicationAdviceRequest,
  CRISIS_RESOURCES,
} from '@/lib/safety/crisis';

export interface BarrierDefinition {
  key: BarrierType;
  label: string;
  shortPrompt: string;
  defaultStrategy: StrategyKey;
}

export interface StrategyDefinition {
  key: StrategyKey;
  label: string;
  evidenceBasis: string;
  shortDescription: string;
  howItWorks: string;
  defaultTimerMinutes: 5 | 10 | 15;
}

export const BARRIER_DEFINITIONS: Record<BarrierType, BarrierDefinition> = {
  overwhelm: {
    key: 'overwhelm',
    label: 'Too big',
    shortPrompt: 'There are too many parts to hold in your head at once.',
    defaultStrategy: 'task_shrinking',
  },
  unclear_next_step: {
    key: 'unclear_next_step',
    label: 'Unclear first step',
    shortPrompt: 'You know the goal, but not what to do first.',
    defaultStrategy: 'implementation_intention',
  },
  perfectionism_or_fear: {
    key: 'perfectionism_or_fear',
    label: 'Worry about getting it wrong',
    shortPrompt: 'The stakes feel high, or it has to come out polished.',
    defaultStrategy: 'reframing',
  },
  boredom_or_distraction: {
    key: 'boredom_or_distraction',
    label: 'Boredom',
    shortPrompt: 'It is dull, repetitive work, and something else keeps pulling at you.',
    defaultStrategy: 'timeboxing',
  },
  low_energy: {
    key: 'low_energy',
    label: 'Low energy',
    shortPrompt: 'You are tired, in body or in head.',
    defaultStrategy: 'task_shrinking',
  },
  other: {
    key: 'other',
    label: 'Something else',
    shortPrompt: 'It is hard to start, and there is no one clear reason.',
    defaultStrategy: 'task_shrinking',
  },
};

export const STRATEGY_DEFINITIONS: Record<StrategyKey, StrategyDefinition> = {
  task_shrinking: {
    key: 'task_shrinking',
    label: 'Make it tiny',
    evidenceBasis: 'CBT behavioral activation & executive-function task decomposition',
    shortDescription: 'A step this small is easier to start than the whole task.',
    howItWorks: 'Removes working-memory load by separating opening the work from finishing it.',
    defaultTimerMinutes: 5,
  },
  implementation_intention: {
    key: 'implementation_intention',
    label: 'If-then step',
    evidenceBasis: 'Gollwitzer implementation intentions & ADHD CBT skills modules',
    shortDescription: 'Deciding now what you will do when the timer starts leaves less to decide later.',
    howItWorks: 'Replaces open-ended deciding with a pre-committed trigger ("When timer starts, I will...").',
    defaultTimerMinutes: 10,
  },
  reframing: {
    key: 'reframing',
    label: 'Permission for a rough draft',
    evidenceBasis: 'CBT cognitive restructuring for ADHD perfectionism & avoidance',
    shortDescription: 'A rough first version is allowed. It only has to exist.',
    howItWorks: 'Disarms all-or-nothing paralysis by making a flawed version the official target.',
    defaultTimerMinutes: 10,
  },
  timeboxing: {
    key: 'timeboxing',
    label: 'A short block with a clean exit',
    evidenceBasis: 'Structured time-horizon bounding in adult ADHD coaching',
    shortDescription: 'A short block with a clear end is easier to begin than an open-ended one.',
    howItWorks: 'Replaces an infinite horizon with a short, visible finish line.',
    defaultTimerMinutes: 10,
  },
};

export function inferBarrierFromTask(taskText: string): BarrierType {
  const lower = taskText.toLowerCase();
  if (/(email|reply|message|apolog|boss|client|landlord|call|tell|ask)/i.test(lower)) {
    return 'perfectionism_or_fear';
  }
  if (/(tax|form|invoice|expense|clean|tidy|laundry|dishes|sort|pack)/i.test(lower)) {
    return 'boredom_or_distraction';
  }
  if (/(tired|exhausted|sleepy|drained|late|headache)/i.test(lower)) {
    return 'low_energy';
  }
  if (/(plan|figure out|where to start|research|outline|decide)/i.test(lower)) {
    return 'unclear_next_step';
  }
  return 'overwhelm';
}

export function chooseBestStrategy(params: {
  barrierType: BarrierType;
  preferredStrategy?: StrategyKey;
  strategyHistory?: Array<{
    strategyKey: StrategyKey;
    attempts: number;
    startedCount: number;
  }>;
}): { strategyKey: StrategyKey; personalizedReason: string | null } {
  if (params.preferredStrategy) {
    return {
      strategyKey: params.preferredStrategy,
      personalizedReason: null,
    };
  }

  const defaultForBarrier = BARRIER_DEFINITIONS[params.barrierType].defaultStrategy;

  if (params.strategyHistory && params.strategyHistory.length > 0) {
    const eligible = params.strategyHistory
      .filter((item) => item.attempts >= 3)
      .map((item) => ({
        ...item,
        rate: item.startedCount / item.attempts,
      }))
      .sort((a, b) => b.rate - a.rate || b.attempts - a.attempts);

    if (eligible.length > 0 && eligible[0].rate >= 0.6) {
      const best = eligible[0];
      const def = STRATEGY_DEFINITIONS[best.strategyKey];
      return {
        strategyKey: best.strategyKey,
        personalizedReason: `I picked "${def.label}" because you started in ${best.startedCount} of ${best.attempts} logged sessions that used it.`,
      };
    }
  }

  return {
    strategyKey: defaultForBarrier,
    personalizedReason: null,
  };
}

export function detectTaskLanguage(text: string): 'hi' | 'es' | 'fr' | 'de' | 'en' {
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[äöüß]/i.test(text) || /\b(ich|du|er|sie|es|wir|ihr|der|die|das|und|nicht|ein|eine|mit|für|machen)\b/i.test(text)) return 'de';
  if (/[œæçèêëîïôûù]/i.test(text) || /\b(je|tu|il|elle|nous|vous|ils|le|la|les|un|une|des|du|dans|pour|avec|est|sur|veux|faire|mon|mémoire)\b/i.test(text)) return 'fr';
  if (/[¿¡ñáíóú]/i.test(text) || /\b(el|la|los|las|un|una|de|en|por|para|con|como|tarea|hacer|empezar|quiero|puedo|esta)\b/i.test(text)) return 'es';
  return 'en';
}

export function deJargonChaoticTask(raw: string): string {
  const trimmed = raw.trim().replace(/\.$/, '');
  if (!/\b(brain is|completely fried|tabs open|idk|don't know where to start|can't even move|so stuck on|ugh|uhh)\b/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed
    .replace(/^(?:ugh+|uh+|um+|honestly|literally|like|wait|okay|so|\s|,)+/gi, '')
    .replace(/\b(?:my\s+brain\s+is\s+(?:completely\s+)?(?:fried|cooked|mush)(?:\s+right\s+now)?|i\s+have\s+(?:like\s+)?(?:\d+|ten)\s+tabs\s+open|i\s+am\s+so\s+stuck\s+on)\b[,;\s]*/gi, '')
    .replace(/[,;\s]*(?:and\s+i\s+can'?t\s+even\s+move|idk\s+where\s+to\s+start|and\s+i'?m\s+just\s+doomscrolling.*|i\s+need\s+an?\s+ice\s+cream\s+reward\s+after.*)$/gi, '')
    .replace(/^(?:and|but|like|\s|,)+/gi, '')
    .trim() || trimmed;
}

const RECIPIENT = /\b(landlord|landlady|boss|manager|client|professor|tutor|teacher|supervisor|doctor|dentist|vet|plumber|electrician|gp|mum|mom|dad|friend|sister|brother|neighbou?r|bank|council|pharmacy|school)\b/i;
const WRITTEN_WORDS = /\b(?:emails?|repl(?:y|ies)|messages?|texts?|write to|letter)\b/i;
const CALL_TASK = /\b(?:call|phone|ring|book|rebook|cancel|arrange)\b/i;
const MESSAGE_TASK = /\b(?:emails?|repl(?:y|ies)|messages?|texts?|write to|landlord|client|professor|manager|gp)\b/i;
const DOC_TASK = /\b(report|essay|slides|presentation|proposal|application|cv|resume|cover letter|thesis|assignment|docs?|documents?)s?\b/i;
const ADMIN_TASK = /\b(?:forms?|tax(?:es)?|invoices?|bills?|bank|portal|appointment|insurance|expenses?)\b/i;
const SPACE_TASK = /\b(?:clean|tidy|tidying|desk|kitchen|laundry|room|dishes|pack)(?:s|ing|ed)?\b/i;

/** Who a message is for, said the way Stay would say it ("your landlord"), or null when the sentence does not say. */
function recipientOf(text: string): string | null {
  const who = RECIPIENT.exec(text)?.[1]?.toLowerCase();
  if (!who) return null;
  if (who === 'gp') return 'your GP';
  return ['bank', 'council', 'pharmacy', 'school'].includes(who) ? `the ${who}` : `your ${who}`;
}

/** The document a task is about ("the report", "your CV"). Never the person's whole sentence. */
function documentOf(text: string): string {
  const doc = DOC_TASK.exec(text)?.[1]?.toLowerCase();
  if (!doc || doc.startsWith('doc')) return 'the document';
  if (doc === 'cv') return 'your CV';
  if (doc === 'resume' || doc === 'cover letter') return `your ${doc}`;
  return `the ${doc}`;
}

/** The paperwork a task is about ("the form", "your tax paperwork"). */
function paperworkOf(text: string): string {
  if (/\b(?:tax(?:es)?|vat|hmrc|irs)\b/i.test(text)) return 'your tax paperwork';
  if (/\binsurance\b/i.test(text)) return 'your insurance paperwork';
  if (/\bbank\b/i.test(text)) return 'your bank site';
  if (/\bappointment\b/i.test(text)) return 'the booking page';
  if (/\binvoices?\b/i.test(text)) return 'the invoice';
  if (/\bbills?\b/i.test(text)) return 'the bill';
  if (/\bexpenses?\b/i.test(text)) return 'the expenses';
  if (/\bportal\b/i.test(text)) return 'the portal';
  return 'the form';
}

function tidyStep(text: string): string {
  if (/\bdishes\b/i.test(text)) return 'Put five dishes next to the sink.';
  if (/\blaundry\b/i.test(text)) return 'Put five things in the laundry basket.';
  if (/\bpack/i.test(text)) return 'Put five things you need to pack in one pile.';
  const place = /\bdesk\b/i.test(text) ? 'the desk' : /\bkitchen\b/i.test(text) ? 'the kitchen' : /\broom\b/i.test(text) ? 'the room' : null;
  return place ? `Pick up five things from ${place} and put them in one pile.` : 'Pick up five things that are out of place and put them in one pile.';
}

/**
 * One small first step for a task. The step names the thing it is about ("the landlord", "the report") when the sentence says what that
 * is, and otherwise says "this". It never pastes the person's own sentence: that can be long, half a thought, or in another language,
 * and a step that quotes it is read aloud cut off in the middle.
 */
export function buildDeterministicFirstStep(
  taskText: string,
  strategyKey: StrategyKey
): string {
  const cleaned = deJargonChaoticTask(taskText);
  const lang = detectTaskLanguage(cleaned);

  if (lang === 'hi') return 'जिस ऐप या फ़ाइल की ज़रूरत है उसे खोलें। बस 2 मिनट का छोटा कदम लें।';
  if (lang === 'es') return 'Abre lo que necesites para esto y haz solo los primeros 90 segundos de preparación.';
  if (lang === 'fr') return 'Ouvre ce dont tu as besoin pour ça et fais uniquement les 90 premières secondes de préparation.';
  if (lang === 'de') return 'Öffne, was du dafür brauchst, und mach nur die ersten 90 Sekunden Vorbereitung.';

  const isCall = CALL_TASK.test(cleaned) && !WRITTEN_WORDS.test(cleaned);
  const isMessage = !isCall && MESSAGE_TASK.test(cleaned);
  const isDoc = !isCall && DOC_TASK.test(cleaned);
  const isAdmin = !isCall && ADMIN_TASK.test(cleaned);
  const isSpace = !isCall && SPACE_TASK.test(cleaned);
  const to = recipientOf(cleaned);
  const doc = documentOf(cleaned);
  const paperwork = paperworkOf(cleaned);

  if (strategyKey === 'task_shrinking') {
    if (isCall) return `Find the number${to ? ` for ${to}` : ''} and put it on screen. You do not have to dial yet.`;
    if (isMessage) return `Open a blank message${to ? ` to ${to}` : ''} and type one rough sentence. Do not send it.`;
    if (isDoc) return `Open ${doc}, type a working title, and list three rough bullets.`;
    if (isAdmin) return `Open ${paperwork} and put the first document or reference number it needs on screen.`;
    if (isSpace) return tidyStep(cleaned);
    return 'Open whatever you need for this and do only the first 90 seconds of setup.';
  }

  if (strategyKey === 'implementation_intention') {
    if (isCall) return 'When the timer starts, I will find the number and put it on screen.';
    if (isMessage) return 'When the timer starts, I will open a reply and type only the greeting.';
    if (isDoc) return `When the timer starts, I will close everything else, open ${doc}, and write the title.`;
    if (isAdmin) return `When the timer starts, I will close everything else, open ${paperwork}, and do the first thing it asks.`;
    return 'When the timer starts, I will close everything else, open what I need for this, and do the first small bit.';
  }

  if (strategyKey === 'reframing') {
    if (isCall) return `Write down the one thing you need to say${to ? ` to ${to}` : ''}. Nobody hears it yet.`;
    if (isMessage) return `Write two rough sentences ${to ? `to ${to}` : 'of the message'}. Nobody sees them yet.`;
    if (isDoc) return `Make a rough first version of ${doc}. Spelling and polish do not count.`;
    return 'Do a rough first pass at this. It does not have to be good or finished.';
  }

  // timeboxing
  const thing = isCall ? (to ? `the call to ${to}` : 'the call') : isMessage ? (to ? `the message to ${to}` : 'the message') : isDoc ? doc : isAdmin ? paperwork : 'this';
  return `Work on ${thing} until the timer rings. You can stop the moment it does.`;
}

export function buildDeterministicCoachPlan(params: {
  taskText: string;
  barrierType?: BarrierType;
  preferredStrategy?: StrategyKey;
  careContext?: CareContext;
  preferredMinutes?: number;
  strategyHistory?: Array<{
    strategyKey: StrategyKey;
    attempts: number;
    startedCount: number;
  }>;
}): CoachPlanProposal {
  const crisis = detectCrisisSignal(params.taskText);
  if (crisis.triggered) {
    return {
      spokenResponse: crisis.message,
      taskText: params.taskText,
      barrierType: 'other',
      strategyKey: 'task_shrinking',
      strategyLabel: 'Crisis Resources & Immediate Support',
      firstStep: 'Pause task coaching and connect with human crisis support right now.',
      whyThisFits: 'Immediate personal safety comes before any task.',
      timerMinutes: 0,
      checkinPrompt: 'Please reach out for human support now. Numbers for your country are listed here, and findahelpline.com has more.',
      safetyFlag: 'crisis',
      resources: CRISIS_RESOURCES,
    };
  }

  const medBoundary = detectMedicationAdviceRequest(params.taskText);
  if (medBoundary.triggered) {
    return {
      spokenResponse: medBoundary.message,
      taskText: params.taskText,
      barrierType: 'other',
      strategyKey: 'task_shrinking',
      strategyLabel: 'Prescriber / Pharmacist Referral',
      firstStep: 'Consult your prescribing clinician or pharmacist regarding medication queries.',
      whyThisFits: 'Stay never gives medication or dosing advice.',
      timerMinutes: 0,
      checkinPrompt: 'Please speak with your prescribing clinician or pharmacist.',
      safetyFlag: 'medical_boundary',
    };
  }

  const barrierType = params.barrierType || inferBarrierFromTask(params.taskText);
  const { strategyKey, personalizedReason } = chooseBestStrategy({
    barrierType,
    preferredStrategy: params.preferredStrategy,
    strategyHistory: params.strategyHistory,
  });

  const strategy = STRATEGY_DEFINITIONS[strategyKey];
  const barrier = BARRIER_DEFINITIONS[barrierType];
  const firstStep = buildDeterministicFirstStep(params.taskText, strategyKey);
  const timerMinutes: number =
    params.preferredMinutes ||
    (barrierType === 'low_energy' || barrierType === 'overwhelm'
      ? 5
      : strategy.defaultTimerMinutes);

  const lang = detectTaskLanguage(params.taskText);

  let whyThisFits =
    personalizedReason ||
    strategy.shortDescription;

  // The spoken reply is the step and one question about the timer. The step is short and never quotes the person's sentence, so it is
  // spoken whole. No opener: a stock "I'm right here with you" before every step read as canned.
  let spokenResponse = `${firstStep} Want a ${timerMinutes}-minute timer?`;
  let checkinPrompt = `Your ${timerMinutes}-minute block is up. Did you get started?`;

  if (lang === 'hi') {
    spokenResponse = `${firstStep} क्या ${timerMinutes} मिनट का टाइमर लगाऊँ?`;
    whyThisFits = 'बहुत छोटा पहला कदम शुरू करना आसान होता है।';
    checkinPrompt = `आपका ${timerMinutes} मिनट का ब्लॉक पूरा हुआ। क्या आप शुरू कर पाए?`;
  } else if (lang === 'es') {
    spokenResponse = `${firstStep} ¿Pongo un temporizador de ${timerMinutes} minutos?`;
    whyThisFits = 'Un primer paso diminuto es más fácil de empezar.';
    checkinPrompt = `Tu bloque de ${timerMinutes} minutos terminó. ¿Pudiste empezar?`;
  } else if (lang === 'fr') {
    spokenResponse = `${firstStep} Je lance un minuteur de ${timerMinutes} minutes ?`;
    whyThisFits = 'Une toute petite première étape est plus facile à commencer.';
    checkinPrompt = `Ton bloc de ${timerMinutes} minutes est terminé. As-tu pu démarrer ?`;
  } else if (lang === 'de') {
    spokenResponse = `${firstStep} Soll ich einen ${timerMinutes}-Minuten-Timer stellen?`;
    whyThisFits = 'Ein winziger erster Schritt ist leichter zu beginnen.';
    checkinPrompt = `Dein ${timerMinutes}-Minuten-Block ist beendet. Konntest du starten?`;
  }

  return {
    spokenResponse,
    taskText: params.taskText.trim(),
    barrierType,
    strategyKey,
    strategyLabel: strategy.label,
    firstStep,
    whyThisFits,
    timerMinutes,
    checkinPrompt,
    safetyFlag: 'none',
  };
}
