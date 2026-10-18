import type {
  BarrierType,
  CareContext,
  CoachPlanProposal,
  StrategyKey,
} from '@/types/domain';
import {
  detectCrisisSignal,
  detectMedicationAdviceRequest,
  UK_CRISIS_RESOURCES,
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
    label: 'Too big / overwhelming',
    shortPrompt: 'There are too many moving parts to hold in working memory.',
    defaultStrategy: 'task_shrinking',
  },
  unclear_next_step: {
    key: 'unclear_next_step',
    label: 'Unclear first step',
    shortPrompt: 'The goal is clear, but the physical first move is blurry.',
    defaultStrategy: 'implementation_intention',
  },
  perfectionism_or_fear: {
    key: 'perfectionism_or_fear',
    label: 'Worry about getting it wrong',
    shortPrompt: 'High stakes, fear of judgment, or pressure to make it polished.',
    defaultStrategy: 'reframing',
  },
  boredom_or_distraction: {
    key: 'boredom_or_distraction',
    label: 'Boredom / under-stimulation',
    shortPrompt: 'Repetitive admin that feels tedious or pulls attention elsewhere.',
    defaultStrategy: 'timeboxing',
  },
  low_energy: {
    key: 'low_energy',
    label: 'Low mental or physical energy',
    shortPrompt: 'Fatigue or late-day executive depletion.',
    defaultStrategy: 'task_shrinking',
  },
  other: {
    key: 'other',
    label: 'Something else / just stuck',
    shortPrompt: 'General task friction without one obvious cause.',
    defaultStrategy: 'task_shrinking',
  },
};

export const STRATEGY_DEFINITIONS: Record<StrategyKey, StrategyDefinition> = {
  task_shrinking: {
    key: 'task_shrinking',
    label: 'Make it tiny',
    evidenceBasis: 'CBT behavioral activation & executive-function task decomposition',
    shortDescription: 'Cut the task down to a physical setup move that takes under two minutes.',
    howItWorks: 'Removes working-memory load by separating opening the work from finishing it.',
    defaultTimerMinutes: 5,
  },
  implementation_intention: {
    key: 'implementation_intention',
    label: 'If-then step',
    evidenceBasis: 'Gollwitzer implementation intentions & ADHD CBT skills modules',
    shortDescription: 'Pair an immediate physical cue with one specific action.',
    howItWorks: 'Replaces open-ended deciding with a pre-committed trigger ("When timer starts, I will...").',
    defaultTimerMinutes: 10,
  },
  reframing: {
    key: 'reframing',
    label: 'Permission for a rough draft',
    evidenceBasis: 'CBT cognitive restructuring for ADHD perfectionism & avoidance',
    shortDescription: 'Lower the bar explicitly to a messy, private first pass.',
    howItWorks: 'Disarms all-or-nothing paralysis by making a flawed version the official target.',
    defaultTimerMinutes: 10,
  },
  timeboxing: {
    key: 'timeboxing',
    label: 'A short block with a clean exit',
    evidenceBasis: 'Structured time-horizon bounding in adult ADHD coaching',
    shortDescription: 'Work for a fixed 5–10 minute window with full permission to stop at the bell.',
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
        personalizedReason: `Selected ${def.label} because you started in ${best.startedCount} of ${best.attempts} logged sessions using it.`,
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

export function buildDeterministicFirstStep(
  taskText: string,
  strategyKey: StrategyKey
): string {
  const cleaned = deJargonChaoticTask(taskText);
  const lang = detectTaskLanguage(cleaned);

  if (lang === 'hi') {
    return `"${cleaned}" के लिए बस पहला छोटा कदम उठाएं: संबंधित ऐप या सामग्री खोलें और केवल 2 मिनट का सेटअप करें।`;
  }
  if (lang === 'es') {
    return `Abre la herramienta o archivo para "${cleaned}" y haz solo los primeros 90 segundos de preparación.`;
  }
  if (lang === 'fr') {
    return `Ouvre l'outil ou le document pour "${cleaned}" et fais uniquement les 90 premières secondes de préparation.`;
  }
  if (lang === 'de') {
    return `Öffne das Dokument oder die App für "${cleaned}" und mach nur die ersten 90 Sekunden Vorbereitung.`;
  }

  const lower = cleaned.toLowerCase();
  const isMessageTask = /(email|reply|message|text|write to|landlord|client|professor|manager|gp)/i.test(lower);
  const isDocTask = /(report|essay|slides|presentation|doc|proposal|application|cv|resume)/i.test(lower);
  const isAdminTask = /(form|tax|invoice|bill|bank|portal|appointment|insurance|expense)/i.test(lower);
  const isSpaceTask = /(clean|tidy|desk|kitchen|laundry|room|dishes|pack)/i.test(lower);

  if (strategyKey === 'task_shrinking') {
    if (isMessageTask) {
      return `Open the message thread for "${cleaned}" and type one rough sentence in the draft box without sending it.`;
    }
    if (isDocTask) {
      return `Open the document for "${cleaned}", write a working title at the top, and list three bullet fragments.`;
    }
    if (isAdminTask) {
      return `Open the webpage or folder for "${cleaned}" and place the first required document or reference number on screen.`;
    }
    if (isSpaceTask) {
      return `Pick up just five visible items related to "${cleaned}" and put them in one pile.`;
    }
    return `Open the exact tool or surface you need for "${cleaned}" and do the first 90 seconds of setup only.`;
  }

  if (strategyKey === 'implementation_intention') {
    if (isMessageTask) {
      return `When the timer starts, I will open the reply window for "${cleaned}" and write the first line: "Hi — quick update on this:"`;
    }
    return `When the timer starts, I will put everything else out of sight, open "${cleaned}", and complete the first visible field or bullet.`;
  }

  if (strategyKey === 'reframing') {
    if (isMessageTask) {
      return `Write a deliberately clumsy, private 2-sentence draft for "${cleaned}" that nobody sees yet—you only need raw words on screen.`;
    }
    return `Create a "version 0" scratch pass of "${cleaned}" where spelling, polish, and completeness do not count for the next 10 minutes.`;
  }

  // timeboxing
  return `Work on "${cleaned}" for one bounded timer block only. You have full permission to stop the moment the timer rings.`;
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
      checkinPrompt: 'Please connect with 999, NHS 111, or Samaritans on 116 123.',
      safetyFlag: 'crisis',
      resources: UK_CRISIS_RESOURCES,
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
  let spokenResponse = `I'm right here with you. Let's make this tiny: ${firstStep} Whenever you're ready, we'll run a gentle ${timerMinutes}-minute focus block, and I'll check in the moment it wraps up.`;
  let checkinPrompt = `Your ${timerMinutes}-minute block is complete. Did you get started on "${firstStep}"?`;

  if (lang === 'hi') {
    spokenResponse = `मैं आपके साथ हूँ। चलिए इसे बहुत आसान बनाते हैं: ${firstStep} जब भी आप तैयार हों, हम ${timerMinutes} मिनट का शांत फोकस ब्लॉक शुरू करेंगे।`;
    whyThisFits = 'जब शुरुआत करना भारी लगे, तो काम को बहुत छोटा करने से सारा मानसिक तनाव दूर हो जाता है।';
    checkinPrompt = `आपका ${timerMinutes} मिनट का ब्लॉक पूरा हुआ। क्या आप शुरू कर पाए?`;
  } else if (lang === 'es') {
    spokenResponse = `Estoy aquí contigo. Hagámoslo muy pequeño: ${firstStep} Cuando estés listo, haremos un bloque de enfoque de ${timerMinutes} minutos.`;
    whyThisFits = 'Hacer el primer paso diminuto elimina toda la presión inicial de golpe.';
    checkinPrompt = `Tu bloque de ${timerMinutes} minutos terminó. ¿Pudiste empezar?`;
  } else if (lang === 'fr') {
    spokenResponse = `Je suis là avec toi. Faisons ça tout en douceur : ${firstStep} Dès que tu te sens prêt, on lance un bloc de ${timerMinutes} minutes.`;
    whyThisFits = 'Réduire la première étape à un geste minuscule élimine immédiatement toute pression.';
    checkinPrompt = `Ton bloc de ${timerMinutes} minutes est terminé. As-tu pu démarrer ?`;
  } else if (lang === 'de') {
    spokenResponse = `Ich bin hier bei dir. Lass es uns ganz leicht machen: ${firstStep} Sobald du bereit bist, starten wir einen sanften ${timerMinutes}-Minuten-Fokusblock.`;
    whyThisFits = 'Ein winziger erster Schritt nimmt sofort den gesamten Druck weg.';
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
