import { describe, expect, it } from 'vitest';
import { mayPark } from '@/lib/conversation/capabilities';

/** File-mic run, 3 Nov 2026: "So I need to send that email and I keep thinking about how to start it" got "Parked." */
describe('a thought is parked only when the person asks', () => {
  it.each(['park it: I need to call the dentist', 'park that for later', 'remind me later to call mum', 'put that in the parking lot', 'save that for later', 'note that down', 'write that down for me', 'come back to that later'])('yes: %s', (t) => {
    expect(mayPark(t), t).toBe(true);
  });
  it.each(['So I need to, um, send that email and, uh, and I keep thinking about how to start it.', 'I keep avoiding my taxes', 'What is the capital of Australia?', 'I parked the car outside'])('no: %s', (t) => {
    expect(mayPark(t), t).toBe(false);
  });
});
