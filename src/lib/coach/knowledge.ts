/**
 * Clinical ADHD Knowledge & Realtime NLU Engine (VoiceAgentRAG pattern).
 * Grounded in CBT for Adult ADHD (Safren et al., Ramsay & Rostain, Barkley).
 * High-speed retrieval (<5ms) for real-time full-duplex voice streams.
 */

import type { BarrierType, StrategyKey } from '@/types/domain';

export interface ClinicalIntervention {
  id: string;
  barrier: BarrierType;
  strategy: StrategyKey;
  strategyTitle: string;
  evidenceSource: string;
  targetMechanism: string;
  defaultMinutes: 5 | 10 | 15;
  interventionPrompt: (taskDescription: string) => string;
  shrunkFirstStepGenerator: (taskDescription: string) => string;
  backchannelCues: string[];
}

export const CLINICAL_INTERVENTIONS: ClinicalIntervention[] = [
  {
    id: 'cbt-shrink-overwhelm',
    barrier: 'overwhelm',
    strategy: 'task_shrinking',
    strategyTitle: 'Task Shrinking (<2-min micro-entry)',
    evidenceSource: 'Safren et al. (2005) CBT for Adult ADHD; Barkley Executive Function Model',
    targetMechanism: 'De-saturates working memory by collapsing multi-step complexity into a single physical movement.',
    defaultMinutes: 5,
    interventionPrompt: (task) =>
      `This feels like a mountain because your working memory is trying to hold the whole project at once. We're only doing the first 90 seconds.`,
    shrunkFirstStepGenerator: (task) =>
      `Open "${task.replace(/[."']/g, '')}" and write just the title or one messy opening bullet point.`,
    backchannelCues: ['I hear you.', 'Totally normal.', 'One tiny piece first.', 'Deep breath.'],
  },
  {
    id: 'cbt-reframe-perfectionism',
    barrier: 'perfectionism_or_fear',
    strategy: 'reframing',
    strategyTitle: 'Rough Draft Permission (Cognitive Reframing)',
    evidenceSource: 'Ramsay & Rostain (2015) Cognitive Behavioral Therapy for Adult ADHD',
    targetMechanism: 'Neutralizes emotional self-protection and fear of negative evaluation by legalizing imperfect work.',
    defaultMinutes: 5,
    interventionPrompt: (task) =>
      `You are protecting yourself from getting it wrong. You have full permission to make this draft completely unpolished. Nobody sees it but you.`,
    shrunkFirstStepGenerator: (task) =>
      `Draft one deliberately rough sentence for "${task.replace(/[."']/g, '')}" without editing or backspacing.`,
    backchannelCues: ['No need to get it perfect.', 'Rough draft only.', 'I understand.', 'You can edit later.'],
  },
  {
    id: 'cbt-intent-unclear',
    barrier: 'unclear_next_step',
    strategy: 'implementation_intention',
    strategyTitle: 'If-Then Implementation Intention',
    evidenceSource: 'Gollwitzer & Sheeran (2006); Gawrilow et al. (2011) ADHD Implementation Intentions',
    targetMechanism: 'Substitutes effortful executive deliberation with an automated stimulus-response contingency.',
    defaultMinutes: 5,
    interventionPrompt: (task) =>
      `When the next move is foggy, the brain stalls. Let's bind an exact trigger to an immediate physical reaction.`,
    shrunkFirstStepGenerator: (task) =>
      `Locate the single file or tab for "${task.replace(/[."']/g, '')}" and leave it open in full screen.`,
    backchannelCues: ['Got it.', 'Let\'s clarify the very next move.', 'Makes complete sense.'],
  },
  {
    id: 'cbt-timebox-boredom',
    barrier: 'boredom_or_distraction',
    strategy: 'timeboxing',
    strategyTitle: 'Dopamine Timebox Sprint',
    evidenceSource: 'Knouse et al. (2017) Behavioral Activation in Adult ADHD',
    targetMechanism: 'Provides an artificial finish line to generate urgency and kickstart dopaminergic engagement.',
    defaultMinutes: 10,
    interventionPrompt: (task) =>
      `Routine tasks have zero dopamine. We aren't finishing this today; we're running a strict 5-minute sprint against the clock, then stopping.`,
    shrunkFirstStepGenerator: (task) =>
      `Set a timer and work on "${task.replace(/[."']/g, '')}" until the bell rings, with full permission to walk away immediately.`,
    backchannelCues: ['Just 5 minutes.', 'Sprint pace.', 'You can stop when the bell rings.'],
  },
  {
    id: 'cbt-somatic-panic',
    barrier: 'low_energy',
    strategy: 'task_shrinking',
    strategyTitle: 'Somatic Reset & Micro-Movement',
    evidenceSource: 'Porges Polyvagal Theory & Somatic Grounding in ADHD Burnout',
    targetMechanism: 'Down-regulates sympathetic nervous system overdrive to restore prefrontal cortex access.',
    defaultMinutes: 5,
    interventionPrompt: (task) =>
      `Your nervous system is drained. Before touching the task, let your shoulders drop and exhale completely.`,
    shrunkFirstStepGenerator: (task) =>
      `Take one sip of water and place your hands flat on the desk for "${task.replace(/[."']/g, '')}".`,
    backchannelCues: ['Take your time.', 'Shoulders down.', 'I\'m right here.', 'Exhale.'],
  },
];

/**
 * Real-time fast NLU extraction from streaming partial transcripts.
 * Analyzes intent, detected task, and active friction barrier mid-utterance.
 */
export interface RealtimeStreamingAnalysis {
  detectedTask: string | null;
  detectedBarrier: BarrierType;
  confidence: number;
  extractedKeywords: string[];
  suggestedBackchannel: string;
}

const BARRIER_TRIGGERS: Array<{ barrier: BarrierType; regex: RegExp; backchannel: string }> = [
  {
    barrier: 'overwhelm',
    regex: /\b(overwhelm|too much|drowning|massive|huge pile|can'?t handle|so many things|head is spinning|swamped)\b/i,
    backchannel: 'I hear how heavy that feels. Let\'s make it tiny.',
  },
  {
    barrier: 'perfectionism_or_fear',
    regex: /\b(scared|afraid|mess up|judge|wrong|stupid|fail|rejection|embarrass|anxious|nervous|ruin)\b/i,
    backchannel: 'No judgment here. You have permission to write a messy draft.',
  },
  {
    barrier: 'unclear_next_step',
    regex: /\b(don'?t know where to start|confused|lost|no idea|vague|foggy|unclear|which one)\b/i,
    backchannel: 'Let\'s find just the very first physical move.',
  },
  {
    barrier: 'boredom_or_distraction',
    regex: /\b(bored|boring|distracted|dull|tedious|can'?t focus|mind wandering|scrolling|procrastinating)\b/i,
    backchannel: 'Routine stuff has zero dopamine. We\'ll do a fast 5-minute sprint.',
  },
  {
    barrier: 'low_energy',
    regex: /\b(exhausted|tired|drained|no energy|fatigued|burnout|burned out|sleepy|zombie)\b/i,
    backchannel: 'Low battery mode. We will barely move the needle, no pressure.',
  },
];

const TASK_VERB_PATTERNS = [
  /(?:reply|email|message|write|send|call|contact)\s+(?:to\s+)?([^,.;!?\n]+?)(?:\s+(?:for|because|since|before|until|due to|but|and)\b|[.,;!?]|$)/i,
  /(?:finish|complete|do|work on|sort|organi[sz]e|file|clean)\s+([^,.;!?\n]+?)(?:\s+(?:for|because|since|before|until|due to|but|and)\b|[.,;!?]|$)/i,
  /(?:dreading|avoiding|stuck on|putting off)\s+([^,.;!?\n]+?)(?:\s+(?:for|because|since|before|until|due to|but|and)\b|[.,;!?]|$)/i,
];

export function analyzeStreamingUtterance(text: string): RealtimeStreamingAnalysis {
  const clean = text.trim();
  let detectedBarrier: BarrierType = 'overwhelm';
  let backchannel = 'I\'m listening. Take your time.';
  let confidence = 0.4;

  for (const item of BARRIER_TRIGGERS) {
    if (item.regex.test(clean)) {
      detectedBarrier = item.barrier;
      backchannel = item.backchannel;
      confidence = 0.88;
      break;
    }
  }

  let detectedTask: string | null = null;
  for (const p of TASK_VERB_PATTERNS) {
    const match = clean.match(p);
    if (match && match[1]) {
      detectedTask = match[1].trim().slice(0, 40);
      break;
    }
  }

  if (!detectedTask && clean.length > 5) {
    // Fallback: clean snippet of first 40 chars
    detectedTask = clean.slice(0, 40);
  }

  const words = clean.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  return {
    detectedTask,
    detectedBarrier,
    confidence,
    extractedKeywords: words.slice(0, 5),
    suggestedBackchannel: backchannel,
  };
}

/**
 * Retrieve targeted clinical intervention for a task and barrier.
 */
export function getClinicalIntervention(barrier: BarrierType): ClinicalIntervention {
  const found = CLINICAL_INTERVENTIONS.find((i) => i.barrier === barrier);
  return found || CLINICAL_INTERVENTIONS[0];
}

export const getInterventionForBarrier = getClinicalIntervention;

