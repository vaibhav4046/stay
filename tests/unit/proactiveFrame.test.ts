import { describe, expect, it } from 'vitest';
import { proactiveFrame, looksLikeInstruction } from '@/lib/voice/proactive';

/**
 * Soak, 3 Nov 2026: Stay's reply to the person was "The user's 2-minute focus timer just ended. Speak first: in under 20 words, warmly ask
 * whether they got started..." Instructions meant for the model were spoken word for word, because the hook guessed "words or instruction"
 * from the first word of the text and "The user's..." did not look like an instruction.
 */
describe('proactive messages: words to say are said, instructions go to the model', () => {
  const checkIn = `The user's 2-minute focus timer just ended. Speak first: in under 20 words, warmly ask whether they got started on "open the email". When they answer, call record_session_outcome.`;

  it('an instruction is never spoken verbatim on the fast path', () => {
    expect(proactiveFrame('instruct', checkIn, true)).toEqual({ type: 'reply.create', instructions: checkIn });
  });
  it('words to say are said as they are', () => {
    expect(proactiveFrame('say', 'Time is up. Nicely done.', true)).toEqual({ type: 'reply.say', text: 'Time is up. Nicely done.' });
  });
  it('the managed agent has only one way: reply.create', () => {
    expect(proactiveFrame('say', 'Hello there.', false).type).toBe('reply.create');
    expect(proactiveFrame('instruct', checkIn, false).type).toBe('reply.create');
  });
  it('text that reads like an instruction is never spoken, even if a caller says "say"', () => {
    for (const t of [checkIn, 'Say one very short, warm line.', `The user's 10-minute timer just ended. Say in under 10 words that their time is up.`, 'Gently remind the person: call mum.', 'Read this step aloud in one short sentence: open it.', 'Speak first: ask how it went.']) {
      expect(looksLikeInstruction(t), t).toBe(true);
      expect(proactiveFrame('say', t, true).type, t).toBe('reply.create');
    }
  });
  it('ordinary spoken lines do not look like instructions', () => {
    for (const t of ['Time is up. Nicely done.', 'Here are the voices. Tap one to hear it.', "I can't open other apps for you.", 'The capital of Australia is Canberra.']) expect(looksLikeInstruction(t), t).toBe(false);
  });
});
