import { describe, it, expect } from 'vitest';
import { cleanReply } from '@/lib/voice/replyHygiene';

describe('cleanReply', () => {
  it('removes quotation marks around a drafted sentence', () => {
    expect(cleanReply('Write a quick note: “I’ll go to the gym tomorrow at 6 pm.” Then set an alarm.')).toBe('Write a quick note: I’ll go to the gym tomorrow at 6 pm. Then set an alarm.');
  });
  it('unwraps square-bracket placeholders', () => {
    expect(cleanReply('Take three slow breaths, then type just “Hi [Name],” and send.')).toBe('Take three slow breaths, then type just Hi Name, and send.');
  });
  it('drops a markdown rule', () => {
    expect(cleanReply('You scroll when anxious. --- Got it.')).toBe('You scroll when anxious. Got it.');
  });
  it('drops the stock lines the prompt bans', () => {
    expect(cleanReply('Close the app now. Need anything else?')).toBe('Close the app now.');
    expect(cleanReply('I hear you. Pick one small task and start it.')).toBe('Pick one small task and start it.');
  });
  it('never empties a chunk, and leaves ordinary words, numbers and apostrophes alone', () => {
    expect(cleanReply('I hear you.')).toBe('I hear you.');
    expect(cleanReply("It's 5 pm. Set a 25-minute timer for the 3 steps.")).toBe("It's 5 pm. Set a 25-minute timer for the 3 steps.");
  });
});
