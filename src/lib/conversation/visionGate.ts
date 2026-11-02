/**
 * The safety gate for what a vision model says. The person's own words are checked before any model runs; this checks the
 * other side: text the model read out of a picture or wrote about it, before Stay shows or speaks it.
 */
import { detectCrisisSignal, detectMedicationDirective } from '@/lib/safety/crisis';

/** Collects the words of a streamed (server-sent events) chat reply. */
export async function readSseText(res: Response): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        out += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content || '';
      } catch {
        // an unfinished line: the next read completes it
      }
    }
  }
  return out.trim();
}

export type VisionVerdict = 'ok' | 'crisis' | 'medication';

/**
 * What to do with a reply that came from looking at a picture. A crisis signal in text read from the picture goes to the
 * crisis screen; an instruction about medication (which a planted line in a picture may have talked the model into) is never shown.
 */
export function visionReplyVerdict(text: string): VisionVerdict {
  if (detectCrisisSignal(text).triggered) return 'crisis';
  if (detectMedicationDirective(text)) return 'medication';
  return 'ok';
}

/** True when the reply is safe to show. */
export function visionReplyIsSafe(text: string): boolean {
  return visionReplyVerdict(text) === 'ok';
}
