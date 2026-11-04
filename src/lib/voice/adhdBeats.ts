/**
 * ADHD 3-Beat Spoken Reply Post-Processor & Pacing Engine (§8.4)
 * Enforces:
 * 1. Acknowledgement <= 6 words
 * 2. ONE tiny next action <= 15 words
 * 3. Optional question <= 8 words
 * Safety, consent, and error messages are NEVER truncated.
 */

export interface ThreeBeatReply {
  ack: string;
  action: string;
  question?: string;
  fullSpokenText: string;
}

export type PacingProfile =
  | 'calm_default'
  | 'overwhelmed'
  | 'impatient'
  | 'rambler'
  | 'fast_speaker'
  | 'emotional'
  | 'noisy_room'
  | 'indecisive'
  | 'crisis';

export function detectPacingProfile(userUtterance: string, wordsPerSec = 0): PacingProfile {
  const t = userUtterance.toLowerCase().trim();

  if (/\b(die|kill myself|suicide|end it all|can't go on)\b/i.test(t)) {
    return 'crisis';
  }
  if (/\b(overwhelmed|too much|drowning|paralyzed|frozen|can't breathe)\b/i.test(t)) {
    return 'overwhelmed';
  }
  if (/\b(quick|hurry|fast|just tell me|action|give me the step)\b/i.test(t)) {
    return 'impatient';
  }
  if (/\b(i don't know|not sure|maybe|either|or maybe|can't decide)\b/i.test(t)) {
    return 'indecisive';
  }
  if (t.split(/\s+/).length > 40 || wordsPerSec > 4.2) {
    return 'rambler';
  }
  if (wordsPerSec > 3.5) {
    return 'fast_speaker';
  }
  if (/\b(crying|sad|upset|angry|frustrated|scared|anxious)\b/i.test(t)) {
    return 'emotional';
  }
  return 'calm_default';
}

/**
 * Trims words to a specified maximum word count, keeping natural endings.
 */
function trimWords(clause: string, maxWords: number): string {
  const words = clause.trim().split(/\s+/);
  if (words.length <= maxWords) return clause.trim();
  const trimmed = words.slice(0, maxWords).join(' ');
  return trimmed.replace(/[,;:]$/, '') + '.';
}

/**
 * Post-processes model output into the ADHD 3-beat rhythm (§8.4).
 */
export function formatThreeBeatReply(rawText: string, profile: PacingProfile = 'calm_default'): ThreeBeatReply {
  const clean = rawText.trim();

  // Safety, consent, and crisis texts are NEVER truncated (§8.4)
  if (
    clean.includes('988') ||
    clean.includes('emergency') ||
    clean.includes('crisis') ||
    clean.toLowerCase().includes('not medical advice')
  ) {
    return {
      ack: '',
      action: clean,
      fullSpokenText: clean,
    };
  }

  // Split into sentences
  const sentences = clean
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return {
      ack: '',
      action: 'Take one slow breath.',
      fullSpokenText: 'Take one slow breath.',
    };
  }

  // Profile-specific handling
  if (profile === 'impatient') {
    // Action first, no acknowledgement
    const action = trimWords(sentences[0] || 'Start with just 60 seconds.', 15);
    return {
      ack: '',
      action,
      fullSpokenText: action,
    };
  }

  if (sentences.length === 1) {
    const single = sentences[0];
    if (single.endsWith('?')) {
      const q = trimWords(single, 8);
      return {
        ack: '',
        action: 'Let us start.',
        question: q,
        fullSpokenText: `Let us start. ${q}`,
      };
    }
    const act = trimWords(single, 15);
    return {
      ack: '',
      action: act,
      fullSpokenText: act,
    };
  }

  // 2+ sentences:
  // Beat 1: acknowledgement <= 6 words
  const rawAck = sentences[0];
  const ack = trimWords(rawAck, 6);

  // Beat 2: one tiny next action <= 15 words
  const rawAction = sentences[1];
  const action = trimWords(rawAction, 15);

  // Beat 3: optional question <= 8 words
  let question: string | undefined;
  const rawQ = sentences.slice(2).find((s) => s.endsWith('?'));
  if (rawQ) {
    question = trimWords(rawQ, 8);
  }

  const parts = [ack, action, question].filter(Boolean);
  return {
    ack,
    action,
    question,
    fullSpokenText: parts.join(' '),
  };
}
