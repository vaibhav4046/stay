export type ConversationState =
  | 'IDLE'
  | 'CONNECTING'
  | 'LISTENING'
  | 'USER_SPEAKING'
  | 'THINKING'
  | 'AGENT_SPEAKING'
  | 'INTERRUPTED';

export type VoiceEvent =
  | { type: 'user_audio_started'; at: number }
  | { type: 'user_partial'; text: string; confidence?: number }
  | { type: 'user_utterance'; text: string }
  | { type: 'user_turn_final'; text: string; turnId: string }
  | { type: 'assistant_text_delta'; text: string }
  | { type: 'assistant_audio_chunk'; pcm: ArrayBuffer; sequence: number }
  | { type: 'assistant_started' }
  | { type: 'assistant_stopped'; reason: 'finished' | 'barge_in' | 'safety' }
  | { type: 'safety_intervention'; level: 'low' | 'urgent' | 'emergency' };

export interface WordBoundary {
  text: string;
  start: number;
  end: number;
}

export interface ProgressiveCaptionInput {
  elapsedMs: number;
  wordBoundaries: WordBoundary[];
  fallbackText: string;
  expectedAudioDurationMs: number;
  replyDoneReceived: boolean;
}

export interface ProgressiveCaptionResult {
  text: string;
  finished: boolean;
}

/**
 * Deterministic conversation state machine transition function:
 * IDLE -> CONNECTING -> LISTENING -> USER_SPEAKING -> THINKING -> AGENT_SPEAKING -> INTERRUPTED -> LISTENING
 */
export function transitionConversationState(
  current: ConversationState,
  event:
    | { type: 'connect_start' }
    | { type: 'session_ready' }
    | { type: 'disconnect' }
    | VoiceEvent
): ConversationState {
  switch (event.type) {
    case 'connect_start':
      return 'CONNECTING';
    case 'session_ready':
      return 'LISTENING';
    case 'disconnect':
      return 'IDLE';
    case 'user_audio_started':
      return current === 'AGENT_SPEAKING' ? 'INTERRUPTED' : 'USER_SPEAKING';
    case 'user_partial':
    case 'user_utterance':
      return current === 'INTERRUPTED' ? 'INTERRUPTED' : 'USER_SPEAKING';
    case 'user_turn_final':
      return 'THINKING';
    case 'assistant_started':
    case 'assistant_audio_chunk':
      return 'AGENT_SPEAKING';
    case 'assistant_text_delta':
      return current === 'AGENT_SPEAKING' ? 'AGENT_SPEAKING' : 'THINKING';
    case 'assistant_stopped':
      if (event.reason === 'barge_in') return 'INTERRUPTED';
      if (event.reason === 'safety') return 'IDLE';
      return 'LISTENING';
    case 'safety_intervention':
      return event.level === 'emergency' ? 'IDLE' : 'LISTENING';
    default:
      return current;
  }
}

/**
 * Computes progressive live caption words synchronized to the actual audio playback clock (`elapsedMs`).
 * Never dumps the full paragraph ahead of playback even if network tokens or `reply.done` arrive early.
 */
export function computeProgressiveCaption(input: ProgressiveCaptionInput): ProgressiveCaptionResult {
  const { elapsedMs, wordBoundaries, fallbackText, expectedAudioDurationMs, replyDoneReceived } = input;
  const cleanFallback = fallbackText.trim();

  // Still in prebuffer before first audio sample is audible
  if (elapsedMs < 0) {
    return { text: '', finished: false };
  }

  if (wordBoundaries.length > 0) {
    const spokenWords = wordBoundaries.filter((w) => w.start <= elapsedMs + 50).map((w) => w.text);
    const lastBoundaryEnd = wordBoundaries[wordBoundaries.length - 1]?.end ?? 0;
    const allFallbackWords = cleanFallback ? cleanFallback.split(/\s+/).filter(Boolean) : [];

    // If multi-sentence text arrived ahead of the second flush's WordBoundaries and playback has passed flush 1
    if (elapsedMs > lastBoundaryEnd + 180 && allFallbackWords.length > wordBoundaries.length) {
      const extraElapsed = elapsedMs - (lastBoundaryEnd + 180);
      const extraCount = Math.min(
        allFallbackWords.length - wordBoundaries.length,
        Math.max(1, Math.floor(extraElapsed / 210) + 1)
      );
      const combined = [
        ...wordBoundaries.map((w) => w.text),
        ...allFallbackWords.slice(wordBoundaries.length, wordBoundaries.length + extraCount),
      ]
        .join(' ')
        .trim();
      const targetEndMs = Math.max(expectedAudioDurationMs - 40, lastBoundaryEnd + extraCount * 200);
      const isDone = replyDoneReceived && elapsedMs >= targetEndMs;
      return {
        text: isDone && cleanFallback ? cleanFallback : combined,
        finished: isDone,
      };
    }

    const revealed = spokenWords.join(' ').trim();
    const targetEndMs = Math.max(expectedAudioDurationMs - 40, lastBoundaryEnd);
    const isDone = replyDoneReceived && elapsedMs >= targetEndMs;
    const fullWordsText = cleanFallback || wordBoundaries.map((w) => w.text).join(' ').trim();
    return {
      text: isDone ? fullWordsText : revealed || (elapsedMs >= 0 ? wordBoundaries[0]?.text ?? '' : ''),
      finished: isDone,
    };
  }

  // Fallback path when provider does not emit WordBoundaries (e.g. Managed Voice Agent or early chunk)
  const words = cleanFallback ? cleanFallback.split(/\s+/).filter(Boolean) : [];
  if (words.length === 0) {
    return {
      text: '',
      finished: replyDoneReceived && elapsedMs >= Math.max(0, expectedAudioDurationMs - 40),
    };
  }

  const msPerWord =
    replyDoneReceived && expectedAudioDurationMs > 120
      ? Math.max(120, Math.min(300, (expectedAudioDurationMs * 0.92) / words.length))
      : 210;

  const count = Math.min(words.length, Math.max(1, Math.floor(elapsedMs / msPerWord) + 1));
  const isDone =
    replyDoneReceived &&
    (elapsedMs >= expectedAudioDurationMs - 40 || (expectedAudioDurationMs < 60 && count >= words.length));

  return {
    text: isDone ? cleanFallback : words.slice(0, count).join(' '),
    finished: isDone,
  };
}
