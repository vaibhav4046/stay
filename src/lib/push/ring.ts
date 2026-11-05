/**
 * The timer ping: a message at the moment a focus block ends, with the app closed.
 *
 * Web Push cannot be scheduled and a free scheduler only ticks hourly, so the wait is made of short serverless runs that hand over to each
 * other: each sleeps up to 48 seconds, looks at the person's record (still the same ring? then keep going), and at the moment sends the message
 * or starts the next run. If a hand-over ever fails, the record still holds the ring and the hourly tick sends it late rather than never.
 * The ring carries no words: the message is general and the device writes the sentence (public/sw-compose.js).
 */
import { RING_MESSAGE } from './schedule';
import { readRecord, removeRecord, saveRecord } from './store';
import { sendPush } from './send';

export const HOP_SLEEP_MS = 48_000; // a run may last 60 s on the free plan; this leaves room to read, send and hand over
const LAND_AFTER_MS = 250; // wake just after the moment, never just before it

export type RingStep = 'sent' | 'cancelled' | 'wait' | 'failed' | 'gone';

/** One look at the record: cancelled or replaced, not yet time, or time (send it). */
export async function ringStep(endpoint: string, ringAt: number, now: number): Promise<RingStep> {
  const rec = await readRecord(endpoint);
  if (!rec || rec.ringAt !== ringAt) return 'cancelled'; // the block was stopped, changed, or the person switched check-ins off
  if (now < ringAt) return 'wait';
  const result = await sendPush(rec.sub, RING_MESSAGE, 'timer');
  if (result === 'gone') {
    await removeRecord(endpoint).catch(() => undefined);
    return 'gone';
  }
  if (result !== 'ok') return 'failed'; // the record keeps the ring: the hourly tick will try again
  await saveRecord({ ...rec, ringAt: undefined });
  return 'sent';
}

export interface RingDeps {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Start the next run (an HTTP call to /api/push/ring). May throw; the hourly tick is the safety net. */
  hop: (endpoint: string, ringAt: number) => Promise<void>;
}

/** One run of the chain: sleep toward the moment, look, and either finish or hand over. */
export async function runRing(endpoint: string, ringAt: number, deps: RingDeps): Promise<RingStep> {
  const remaining = ringAt - deps.now();
  if (remaining > 0) await deps.sleep(Math.min(remaining + LAND_AFTER_MS, HOP_SLEEP_MS));
  const step = await ringStep(endpoint, ringAt, deps.now());
  if (step !== 'wait') return step;
  try {
    await deps.hop(endpoint, ringAt);
  } catch {
    // the hourly tick sends it late instead
  }
  return step;
}

/** The real dependencies: wall clock, setTimeout, and a call to this same app's ring route. */
export function liveDeps(origin: string): RingDeps {
  return {
    now: () => Date.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    hop: async (endpoint, ringAt) => {
      const res = await fetch(`${origin}/api/push/ring`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.PUSH_TICK_SECRET ?? ''}` },
        body: JSON.stringify({ endpoint, ringAt }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`ring hop ${res.status}`);
    },
  };
}
