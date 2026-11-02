import { describe, expect, it } from 'vitest';
import { answerAboutStay } from '@/lib/voice/aboutStay';

describe('answerAboutStay: questions about Stay get a straight answer', () => {
  it('answers the exact question from the field test: what more can you do, and why use you over ChatGPT or Claude', () => {
    const q = "What more you can do just for like completing a task? Another, what's your specialty and why should I use you and rather use ChatGPT or Claude?";
    const a = answerAboutStay(q);
    expect(a).not.toBeNull();
    expect(a).toMatch(/stuck|starting/i);
    expect(a).not.toMatch(/reward|stretch|reminder set/i);
  });

  it.each([
    ['what can you do', /start things|get you started/i],
    ['How can you help me?', /start things|get you started/i],
    ["why should I use you", /stuck|starting/i],
    ["better than ChatGPT?", /stuck|starting/i],
    ['who are you', /Stay/],
    ['is my data private', /device/],
    ['is it free', /nothing to pay/i],
    ['Then reply me.', /here|listening/i],
    ['talk to me', /here|listening/i],
  ])('%s', (q, re) => {
    expect(answerAboutStay(q)).toMatch(re);
  });

  it('leaves everything else to the model', () => {
    for (const q of ['I keep putting off my taxes', 'I feel overwhelmed', 'what can I do about my email', 'start a timer', 'yes', 'tell me a story about my landlord', '']) {
      expect(answerAboutStay(q), q).toBeNull();
    }
  });

  it('gives the same answer to the same question, and never claims more than the app does', () => {
    expect(answerAboutStay('what can you do')).toBe(answerAboutStay('what can you do'));
    for (const q of ['what can you do', 'why should I use you', 'who are you', 'is my data private', 'is it free', 'reply me']) {
      const a = answerAboutStay(q)!;
      expect(a, q).not.toMatch(/\b(?:better than|beats|smarter than|best|#1|medical|diagnos|cure|treat)\b(?! ChatGPT)/i);
      expect(a.split(/\s+/).length, q).toBeLessThan(60);
    }
  });
});
