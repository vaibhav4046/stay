/**
 * What Stay says when it cannot answer. Plain words, true, never a stand-in answer: if the model fails, the person is told
 * so and can try again. (A stock coaching line in place of an answer is the failure this file exists to prevent.)
 */

export type FailureKind = 'unavailable' | 'rate_limited' | 'vision' | 'config' | 'timeout';

/** A screen question with nothing shared: say so, and say how to share. */
export const NOTHING_SHOWN =
  'Nothing is shared with me yet, so I cannot see anything. Tap the plus button to share your screen, use the camera or add a picture, then ask again.';

export function honestFailureMessage(kind: FailureKind): string {
  switch (kind) {
    case 'rate_limited':
      return 'I am getting too many requests right now, so I cannot answer yet. Give it a minute and ask again.';
    case 'vision':
      return 'I could not look at that just now. Show it to me again in a moment.';
    case 'config':
      return 'My thinking service is not set up on this server, so I cannot answer questions here.';
    case 'timeout':
      return 'That took too long and I lost it. Please ask me again.';
    default:
      return 'I could not reach my thinking service just now, so I do not have an answer. Try again in a moment, or type it.';
  }
}

/** Map a provider error code (see src/lib/llm/provider.ts) to the honest message. */
export function failureKindFromError(error: string | undefined, vision = false): FailureKind {
  if (vision) return 'vision';
  if (error === 'rate_limited' || error === 'quota') return 'rate_limited';
  if (error === 'no_server_key' || error === 'invalid_key' || error === 'bad_endpoint') return 'config';
  if (error === 'unreachable') return 'timeout';
  return 'unavailable';
}

/** The reply to a turn that sets off the safety gate while a picture is attached or has just been read. */
export const VISION_SAFETY_FLAG = 'crisis_in_vision_text';

/** True when a reply is one of Stay's own "I cannot answer" lines. Those are never remembered as something Stay said: the model copies them. */
export function isFailureLine(text: string): boolean {
  const t = text.trim();
  return (['unavailable', 'rate_limited', 'vision', 'config', 'timeout'] as const).some((k) => t.startsWith(honestFailureMessage(k)));
}
